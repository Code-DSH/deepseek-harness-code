import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";

import {
  createHarnessLaunchSpec,
  resolveHarnessDataPaths,
  createSecureWebPreferences,
  createStartupPagePath,
  createTrayIconPath,
  createWindowChromeOptions,
} from "./host-config.js";
import { registerDesktopIpc } from "./ipc-handlers.js";
import {
  resolveCloseAction,
  type PersistedCloseBehavior,
} from "./lifecycle/close-preferences.js";
import {
  reserveLoopbackPort,
  startWithPortRetries,
} from "./lifecycle/port-retry.js";
import {
  HarnessRuntimeController,
  type HarnessChild,
} from "./lifecycle/runtime-controller.js";
import { fetchOkWithTimeout } from "./lifecycle/http-health.js";
import {
  redactStartupDiagnostic,
  startupFailureFromDiagnostics,
} from "./lifecycle/startup-diagnostics.js";
import { WatchdogHost } from "./lifecycle/watchdog-host.js";
import {
  ensureNodeRuntime,
  getPortableNodeArchive,
  inspectNodeRuntime,
  resolveNodeRuntimePaths,
  type NodeRuntimePaths,
} from "./lifecycle/node-runtime.js";
import { replaceWindowKeepingHostAlive } from "./lifecycle/window-recovery.js";
import {
  ensureOfficialHarnessInstall,
  installAnchoredStandardPresetForStartup,
  installSuperpowersSkillsForStartup,
  migrateLegacyHarnessHome,
} from "./lifecycle/desktop-plugin-link.js";
import {
  installRoutingPresetsForStartup,
  type RoutingPresetStartupResult,
} from "./lifecycle/routing-suite-link.js";
import { classifyNavigation } from "./security/navigation-policy.js";
import type {
  DesktopPreferences,
  DesktopPreferencesState,
  RuntimeNotice,
} from "./shared/contracts.js";
import {
  DEFAULT_DESKTOP_PREFERENCES,
  parsePersistedDesktopPreferences,
} from "./shared/contracts.js";
import {
  createApplicationMenuTemplate,
  isMacControlPaste,
} from "./application-menu.js";

let mainWindow: BrowserWindow | undefined;
let controller: HarnessRuntimeController | undefined;
let harnessOrigin = "";
let healthTimer: ReturnType<typeof setInterval> | undefined;
let watchdogHost: WatchdogHost | undefined;
let tray: Tray | undefined;
let quitting = false;
let preferences: DesktopPreferencesState = { ...DEFAULT_DESKTOP_PREFERENCES };
let anchoredPresetNotice: RuntimeNotice | undefined;
let routingSuiteNotice: RuntimeNotice | undefined;
let nodeRuntimePaths: NodeRuntimePaths | undefined;

// Preserve sessions and credentials across the product rename. This is an
// intentional compatibility path; no user data is copied into the app bundle.
app.setPath(
  "userData",
  join(app.getPath("appData"), "deepseek-harness-desktop"),
);

function settingsPath(): string {
  return join(app.getPath("userData"), "desktop-settings.json");
}

async function getPreferences(): Promise<DesktopPreferencesState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(settingsPath(), "utf8"));
    return parsePersistedDesktopPreferences(parsed);
  } catch {
    // A missing or malformed local preference safely falls back to a prompt.
  }
  return { ...DEFAULT_DESKTOP_PREFERENCES };
}

async function setPreferences(value: DesktopPreferences): Promise<void> {
  const target = settingsPath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function chooseCloseBehavior(): Promise<PersistedCloseBehavior> {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: "question",
    buttons: ["Keep running in tray", "Quit DeepSeek Harness Code"],
    defaultId: 0,
    cancelId: 0,
    title: "Close DeepSeek Harness Code",
    message: "What should happen when you close this window?",
  });
  return result.response === 1 ? "quit" : "minimize";
}

function configureWindowNavigation(
  window: BrowserWindow,
  allowStartupPage: boolean,
): void {
  const startupPageUrl = pathToFileURL(
    createStartupPagePath(app.getAppPath()),
  ).href;
  const handleNavigation = (event: Electron.Event, url: string) => {
    const decision = classifyNavigation(
      url,
      harnessOrigin,
      allowStartupPage ? startupPageUrl : undefined,
    );
    if (decision === "allow-in-app") return;
    event.preventDefault();
    if (decision === "open-external") void shell.openExternal(url);
  };
  window.webContents.on("will-navigate", handleNavigation);
  window.webContents.on("will-redirect", handleNavigation);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      classifyNavigation(
        url,
        harnessOrigin,
        allowStartupPage ? startupPageUrl : undefined,
      ) === "open-external"
    ) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function createWindow(showStartupPage = true): BrowserWindow {
  const window = new BrowserWindow({
    ...createWindowChromeOptions(process.platform),
    // Windows/Linux have no macOS-style global menu bar: the Electron
    // application menu would render as an extra black bar under the native
    // title bar. Keep the menu installed (its Edit roles power clipboard
    // accelerators) but hide the bar; Alt reveals it temporarily.
    autoHideMenuBar: process.platform !== "darwin",
    width: 1280,
    height: 860,
    minWidth: 920,
    minHeight: 640,
    show: false,
    webPreferences: createSecureWebPreferences(join(__dirname, "preload.js")),
  });
  mainWindow = window;
  configureWindowNavigation(window, showStartupPage);
  window.on("ready-to-show", () => window.show());
  window.webContents.on("render-process-gone", () =>
    controller?.handleRendererGone(),
  );
  window.webContents.on("unresponsive", () =>
    controller?.handleRendererUnresponsive(),
  );
  window.webContents.on("responsive", () =>
    controller?.handleRendererResponsive(),
  );
  window.webContents.on("before-input-event", (event, input) => {
    if (!isMacControlPaste(process.platform, input)) return;
    event.preventDefault();
    window.webContents.paste();
  });
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    void handleWindowClose(window).catch(reportRuntimeFailure);
  });
  if (showStartupPage)
    void window.loadFile(createStartupPagePath(app.getAppPath()));
  return window;
}

async function handleWindowClose(window: BrowserWindow): Promise<void> {
  const action = await resolveCloseAction(
    preferences.closeBehavior,
    chooseCloseBehavior,
    async (value) => {
      const next = { ...preferences, closeBehavior: value };
      await setPreferences(next);
      preferences = next;
    },
  );
  if (action === "minimize") {
    window.hide();
    return;
  }
  app.quit();
}

function waitForChildExit(
  child: HarnessChild,
  timeoutMs: number,
): Promise<boolean> {
  if (!(child instanceof Object) || !("once" in child))
    return Promise.resolve(false);
  const processChild = child as ChildProcess;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    processChild.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function httpOk(url: string): Promise<boolean> {
  return fetchOkWithTimeout(url, 5_000);
}

function isHarnessChildAlive(child: HarnessChild): boolean {
  const processChild = child as ChildProcess;
  return processChild.exitCode === null && !processChild.killed;
}

async function waitForHarnessReady(
  child: HarnessChild,
  origin: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (!isHarnessChildAlive(child)) return false;
    if (await httpOk(origin)) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function captureStartupDiagnostics(child: ChildProcess): {
  read: () => string;
  dispose: () => void;
} {
  let diagnostics = "";
  const writeDiagnostic = (
    source: "stdout" | "stderr",
    chunk: Buffer | string,
  ) => {
    const diagnostic = redactStartupDiagnostic(String(chunk));
    if (diagnostic !== "") {
      diagnostics = `${diagnostics}\n${diagnostic}`.slice(-2_000);
      process.stderr.write(`[Harness startup ${source}] ${diagnostic}\n`);
    }
  };
  const stdout = (chunk: Buffer | string) => writeDiagnostic("stdout", chunk);
  const stderr = (chunk: Buffer | string) => writeDiagnostic("stderr", chunk);
  child.stdout?.on("data", stdout);
  child.stderr?.on("data", stderr);
  return {
    read: () => diagnostics,
    dispose: () => {
      child.stdout?.removeListener("data", stdout);
      child.stderr?.removeListener("data", stderr);
    },
  };
}

async function retireFailedStartupChild(child: HarnessChild): Promise<void> {
  if (!isHarnessChildAlive(child)) return;
  child.kill("SIGTERM");
  if (!(await waitForChildExit(child, 8_000))) child.kill("SIGKILL");
}

function nodeRuntimeResourcePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "node-runtime")
    : join(app.getAppPath(), "config", "node-runtime");
}

async function showNodeRuntimeChoice(
  archive: ReturnType<typeof getPortableNodeArchive>,
  failedError?: Error,
): Promise<"download" | "open-link" | "quit"> {
  const options: Electron.MessageBoxOptions = {
    type: failedError === undefined ? "question" : "error",
    buttons:
      failedError === undefined
        ? ["Download Node.js automatically", "Open download page", "Quit"]
        : ["Retry automatic download", "Open download page", "Quit"],
    defaultId: 0,
    cancelId: 2,
    title: "Node.js runtime required",
    message:
      failedError === undefined
        ? "DeepSeek Harness Code needs Node.js 24 to run the local Harness."
        : "The portable Node.js runtime could not be installed.",
    detail:
      failedError === undefined
        ? `The installer no longer bundles Node.js to keep its size small. You can download it now or open ${archive.url} in your browser.`
        : `${failedError.message.slice(0, 2_000)}\n\nAutomatic download: ${archive.url}`,
  };
  const result =
    mainWindow === undefined || mainWindow.isDestroyed()
      ? await dialog.showMessageBox(options)
      : await dialog.showMessageBox(mainWindow, options);
  return (
    (["download", "open-link", "quit"] as const)[result.response] ?? "quit"
  );
}

async function prepareManagedNodeRuntime(): Promise<NodeRuntimePaths> {
  const userDataPath = app.getPath("userData");
  const runtimeResourcePath = nodeRuntimeResourcePath();
  const archive = getPortableNodeArchive();
  const readiness = await inspectNodeRuntime(userDataPath, runtimeResourcePath);
  if (readiness.ready) {
    nodeRuntimePaths = resolveNodeRuntimePaths(userDataPath);
    return nodeRuntimePaths;
  }

  const initialChoice = await showNodeRuntimeChoice(archive);
  if (initialChoice === "open-link") {
    await shell.openExternal(archive.url);
    throw new Error(
      `Node.js ${archive.fileName} was not downloaded. Open ${archive.url}, install Node.js, or relaunch and choose automatic download.`,
    );
  }
  if (initialChoice === "quit") {
    throw new Error("Node.js runtime is required for the local Harness.");
  }

  for (;;) {
    try {
      const installed = await ensureNodeRuntime({
        userDataPath,
        runtimeResourcePath,
      });
      nodeRuntimePaths = installed.paths;
      if (installed.installed) {
        process.stderr.write(
          `Installed portable Node.js runtime and pinned Harness packages under ${userDataPath}/node-runtime.\n`,
        );
      }
      return nodeRuntimePaths;
    } catch (error) {
      const failedError =
        error instanceof Error ? error : new Error("Unknown runtime error");
      const choice = await showNodeRuntimeChoice(archive, failedError);
      if (choice === "open-link") {
        await shell.openExternal(archive.url);
        throw failedError;
      }
      if (choice === "quit") throw failedError;
    }
  }
}

function managedNodeRuntimePaths(): NodeRuntimePaths {
  if (nodeRuntimePaths === undefined) {
    throw new Error("Managed Node.js runtime is not prepared");
  }
  return nodeRuntimePaths;
}

async function startHarness(): Promise<HarnessChild> {
  const runtime = managedNodeRuntimePaths();
  const dshEntry = runtime.dshEntry;
  const pluginRoot = app.isPackaged
    ? join(process.resourcesPath, "desktop-plugin")
    : join(app.getAppPath(), "packages", "desktop-plugin");
  const anchoredPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "anchored-standard-plugin")
    : join(app.getAppPath(), "packages", "anchored-standard-plugin");
  const uiMotionPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "dsh-ui-motion")
    : join(app.getAppPath(), "packages", "dsh-ui-motion");
  const modelSelectorPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "dsh-model-two-level-selector")
    : join(app.getAppPath(), "packages", "dsh-model-two-level-selector");
  const superpowersSkillsRoot = app.isPackaged
    ? join(process.resourcesPath, "superpowers-skills")
    : join(app.getAppPath(), "packages", "superpowers-skills");
  const bundledRoutingSuiteRoot = app.isPackaged
    ? join(process.resourcesPath, "routing-suite")
    : join(app.getAppPath(), "build", "routing-suite");
  const { dshHome, legacyHome } = resolveHarnessDataPaths(
    app.getPath("userData"),
  );
  const migration = await migrateLegacyHarnessHome({ legacyHome, dshHome });
  if (migration.conflicts.length > 0) {
    process.stderr.write(
      `Legacy Harness data preserved at the official Home without overwriting existing entries: ${migration.conflicts.join(", ")}\n`,
    );
  }
  if (migration.skippedSymlinks.length > 0) {
    process.stderr.write(
      `Legacy Harness migration skipped symbolic links: ${migration.skippedSymlinks.join(", ")}\n`,
    );
  }
  await ensureOfficialHarnessInstall({
    dshEntry,
    dshHome,
    nodeExecutable: runtime.nodeExecutable,
    pnpmEntry: join(nodeRuntimeResourcePath(), "pnpm.mjs"),
    pnpmStoreDir: runtime.pnpmStoreDir,
    runtimeBinRoot: join(app.getPath("userData"), "runtime-bin"),
    integratedPlugins: [
      {
        packageName: "deepseek-harness-desktop-plugin",
        packageRoot: pluginRoot,
      },
      {
        packageName: "dsh-ui-motion",
        packageRoot: uiMotionPluginRoot,
      },
      {
        packageName: "dsh-model2-selector",
        packageRoot: modelSelectorPluginRoot,
      },
      {
        packageName: "@dsh-external/dsh-super-injector",
        packageRoot: join(bundledRoutingSuiteRoot, "injector"),
      },
      {
        packageName: "@dsh-external/dsh-mode-boost",
        packageRoot: join(bundledRoutingSuiteRoot, "mode-boost"),
      },
      {
        packageName: "dsh-find-plugin",
        packageRoot: runtime.dshFindPluginRoot,
      },
    ],
    legacyPluginSpecs: migration.legacyPluginSpecs,
  });
  const anchoredPreset = await installAnchoredStandardPresetForStartup(
    dshHome,
    anchoredPluginRoot,
  );
  anchoredPresetNotice =
    anchoredPreset.status === "conflict"
      ? "anchored-preset-conflict"
      : anchoredPreset.status === "unavailable"
        ? "anchored-preset-unavailable"
        : undefined;
  if (anchoredPreset.status === "conflict") {
    process.stderr.write(
      "Anchored Standard preset installation skipped: an unmanaged or locally modified preset already uses that ID.\n",
    );
  } else if (anchoredPreset.status === "unavailable") {
    process.stderr.write(
      "Anchored Standard preset is unavailable; Standard startup will continue.\n",
    );
  }
  const superpowersSkills = await installSuperpowersSkillsForStartup(
    dshHome,
    superpowersSkillsRoot,
  );
  if (superpowersSkills.status === "unavailable") {
    process.stderr.write(
      "Bundled Superpowers skills are unavailable; Harness startup will continue.\n",
    );
  } else if (superpowersSkills.summary.conflicts.length > 0) {
    process.stderr.write(
      `Bundled Superpowers skills skipped user-owned directories: ${superpowersSkills.summary.conflicts.join(", ")}.\n`,
    );
  }
  // Assemble the reviewed, immutable dsh-routing-suite snapshot bundled with
  // this app release. Startup never downloads or executes mutable code.
  const routingSuite: RoutingPresetStartupResult =
    await installRoutingPresetsForStartup(dshHome, bundledRoutingSuiteRoot);
  if (routingSuite.status === "unavailable") {
    routingSuiteNotice = "routing-suite-unavailable";
    process.stderr.write(
      "Routing suite is unavailable; Standard startup will continue.\n",
    );
  } else {
    const conflicts = routingSuite.summary.presets.filter(
      (preset) => preset.status === "conflict",
    );
    if (conflicts.length > 0) {
      routingSuiteNotice = "routing-suite-conflict";
      process.stderr.write(
        `Routing suite presets skipped user-owned directories: ${conflicts.map((preset) => preset.id).join(", ")}.\n`,
      );
    }
  }
  return startWithPortRetries(reserveLoopbackPort, async (port) => {
    harnessOrigin = `http://127.0.0.1:${port}`;
    const spec = createHarnessLaunchSpec({
      nodeExecutable: runtime.nodeExecutable,
      dshEntry,
      dshHome,
      port,
    });
    const child = spawn(spec.command, spec.args, {
      env: { ...process.env, ...spec.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const diagnostics = captureStartupDiagnostics(child);
    try {
      const startupResult = await Promise.race([
        waitForHarnessReady(child, harnessOrigin).then((ready) => ({
          type: "ready" as const,
          ready,
        })),
        new Promise<{ type: "error"; error: Error }>((resolve) => {
          child.once("error", (error) => resolve({ type: "error", error }));
        }),
      ]);
      if (startupResult.type === "error") {
        await retireFailedStartupChild(child);
        throw startupResult.error;
      }
      if (!startupResult.ready) {
        await retireFailedStartupChild(child);
        throw startupFailureFromDiagnostics(diagnostics.read());
      }
    } finally {
      diagnostics.dispose();
    }
    child.once("exit", () => void controller?.handleChildExit(child));
    return child;
  });
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate(process.platform, {
        open: () => mainWindow?.show(),
        publishStatus: () => {
          if (mainWindow === undefined || mainWindow.isDestroyed()) return;
          if (mainWindow.webContents.isDestroyed()) return;
          mainWindow.webContents.send(
            "runtime:changed",
            controller?.getState(),
          );
        },
        restartHarness: () =>
          void controller?.restart().catch(reportRuntimeFailure),
        openLogs: () => void shell.openPath(app.getPath("logs")),
        quit: () => app.quit(),
        pasteFocused: () =>
          BrowserWindow.getFocusedWindow()?.webContents.paste(),
      }),
    ),
  );
}

function createTray(): void {
  if (tray !== undefined) return;
  const image = nativeImage
    .createFromPath(
      createTrayIconPath(
        app.getAppPath(),
        process.resourcesPath,
        app.isPackaged,
        process.platform,
      ),
    )
    .resize({ width: 18, height: 18 });
  if (process.platform === "darwin") image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("DeepSeek Harness Code");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open", click: () => mainWindow?.show() },
      {
        label: "Restart Harness",
        click: () => void controller?.restart().catch(reportRuntimeFailure),
      },
      {
        label: "Open Logs",
        click: () => void shell.openPath(app.getPath("logs")),
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => mainWindow?.show());
}

async function launch(): Promise<void> {
  watchdogHost = new WatchdogHost({
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
    electronExecutable: process.execPath,
    isPackaged: app.isPackaged,
  });
  const watchdogResult = watchdogHost.start();
  if (watchdogResult.status === "failed") {
    reportRuntimeFailure(
      new Error(`Watchdog launch failed: ${watchdogResult.diagnostic}`),
    );
  }
  createWindow();
  await prepareManagedNodeRuntime();
  controller = new HarnessRuntimeController({
    origin: () => harnessOrigin,
    startHarness,
    probeHealth: httpOk,
    waitForReady: async (child, origin) =>
      isHarnessChildAlive(child) && httpOk(origin),
    isChildAlive: isHarnessChildAlive,
    runtimeNotice: () => routingSuiteNotice ?? anchoredPresetNotice,
    onReady: async (origin) => {
      await mainWindow?.loadURL(origin);
    },
    onState: (state) => {
      if (mainWindow === undefined || mainWindow.isDestroyed()) return;
      if (mainWindow.webContents.isDestroyed()) return;
      mainWindow.webContents.send("runtime:changed", state);
    },
    rebuildWindow: () => {
      const oldWindow = mainWindow;
      mainWindow = replaceWindowKeepingHostAlive(
        oldWindow,
        () => createWindow(false),
        harnessOrigin,
      );
    },
    reloadRenderer: () => void mainWindow?.webContents.reloadIgnoringCache(),
    waitForExit: waitForChildExit,
  });
  registerDesktopIpc(ipcMain, {
    getRuntimeState: () => controller!.getState(),
    restartHarness: () => controller!.restart(),
    openLogs: async () => {
      await shell.openPath(app.getPath("logs"));
    },
    getPreferences: () => preferences,
    setPreferences: async (value) => {
      await setPreferences(value);
      preferences = value;
    },
    paste: (target) => target.paste(),
  });
  buildMenu();
  createTray();
  if (process.platform === "darwin") app.dock?.show();
  preferences = await getPreferences();
  await controller.start();
  healthTimer = setInterval(
    () => void controller?.checkHealth().catch(reportRuntimeFailure),
    5_000,
  );
}

function reportRuntimeFailure(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message.slice(0, 2_000)
      : "Desktop host operation failed";
  console.error(`[DeepSeek Harness Code] ${message}`);
}

function reportLaunchFailure(error: unknown): void {
  reportRuntimeFailure(error);
  const message =
    error instanceof Error
      ? error.message.slice(0, 2_000)
      : "The local Harness could not start.";
  dialog.showErrorBox("DeepSeek Harness Code could not start", message);
}

app
  .whenReady()
  .then(() => {
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else mainWindow?.show();
    });
    return launch();
  })
  .catch(reportLaunchFailure);
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  if (healthTimer !== undefined) clearInterval(healthTimer);
  void shutdownNormally();
});

async function shutdownNormally(): Promise<void> {
  try {
    await watchdogHost?.shutdown();
  } catch (error) {
    reportRuntimeFailure(error);
  }
  try {
    await controller?.stop();
  } catch (error) {
    reportRuntimeFailure(error);
  }
  app.quit();
}
