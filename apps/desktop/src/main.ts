import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { networkInterfaces } from "node:os";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  clipboard,
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
  createSingleFlightAction,
  registerDesktopLifecycle,
} from "./lifecycle/app-lifecycle.js";
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
import { writeEvidenceAtomically } from "./lifecycle/atomic-evidence.js";
import {
  buildSmokeFinalEvidence,
  buildSmokeReadyEvidence,
  awaitSmokeAcknowledgement,
  completeSmokeShutdown,
  parseSmokeConfig,
  resolveApplicationUserDataPath,
  validateSmokeRuntimeProvenance,
  type SmokeReadyEvidence,
} from "./lifecycle/smoke-contract.js";
import { UpdaterHost } from "./lifecycle/updater-host.js";
import { createUpdaterStatusStore } from "./lifecycle/updater-status.js";
import { LanProxyHost } from "./lifecycle/lan-proxy.js";
import {
  LanAccessController,
  resolveLanIpv4Addresses,
} from "./lifecycle/lan-access-controller.js";
import { DesktopPreferencesStore } from "./lifecycle/desktop-preferences-store.js";
import {
  ensureRuntimePackages,
  type NodeRuntimePaths,
} from "./lifecycle/node-runtime.js";
import {
  adoptBundledGlobalAgentPrompt,
  installGlobalAgentPromptForStartup,
} from "./lifecycle/global-agent-prompt-link.js";
import { ensureGlobalDshCli } from "./lifecycle/global-cli-link.js";
import {
  MINIMUM_NODE_VERSION,
  NODE_DOWNLOAD_PAGE_URL,
  resolveSystemNode,
  type ResolvedSystemNode,
} from "./lifecycle/system-node.js";
import { getNodeDownloadUrls } from "./lifecycle/node-downloader.js";
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
  DesktopPreferencesState,
  RuntimeNotice,
  UpdaterStatus,
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
let updaterHost: UpdaterHost | undefined;
const updaterStatusStore = createUpdaterStatusStore();
const lanProxyHost = new LanProxyHost({
  getUpdaterStatus: () => updaterStatusStore.get(),
  subscribeUpdaterStatus: (listener) =>
    updaterStatusStore.subscribe(listener, { replay: false }),
});
let tray: Tray | undefined;
const preferencesStore = new DesktopPreferencesStore(
  DEFAULT_DESKTOP_PREFERENCES,
  setPreferences,
);
const lanAccessController = new LanAccessController({
  proxy: lanProxyHost,
  persistEnabled: async (enabled) => {
    await preferencesStore.update({ lanAccessEnabled: enabled });
  },
  persistPasswordHash: persistLanAccessPasswordHash,
  resolveAddresses: () => resolveLanIpv4Addresses(networkInterfaces()),
  writeClipboard: (value) => clipboard.writeText(value),
});
let anchoredPresetNotice: RuntimeNotice | undefined;
let routingSuiteNotice: RuntimeNotice | undefined;
let nodeRuntimePaths: NodeRuntimePaths | undefined;
let systemNodeRuntime: ResolvedSystemNode | undefined;
const smokeConfig = parseSmokeConfig(process.env, {
  isPackaged: app.isPackaged,
});
const smokeStartedAt = smokeConfig?.startedAt ?? new Date().toISOString();
let smokeReadyEvidence: SmokeReadyEvidence | undefined;
let smokeFailureWritten = false;

async function writeSmokeEvidence(value: unknown): Promise<void> {
  if (smokeConfig === undefined) return;
  await writeEvidenceAtomically(smokeConfig.path, value);
}

async function writeSmokeFailure(error: unknown): Promise<void> {
  if (smokeConfig === undefined || smokeFailureWritten) return;
  smokeFailureWritten = true;
  await writeSmokeEvidence({
    schema: 2,
    runId: smokeConfig.runId,
    startedAt: smokeStartedAt,
    failure:
      error instanceof Error
        ? error.message.slice(0, 2_000)
        : "smoke startup failed",
  });
}

// Preserve sessions and credentials across the product rename. This is an
// intentional compatibility path; no user data is copied into the app bundle.
app.setPath(
  "userData",
  resolveApplicationUserDataPath(
    join(app.getPath("appData"), "deepseek-harness-desktop"),
    smokeConfig,
  ),
);

// One window per user data directory. Without the lock, every relaunch while
// a stale instance is stuck would spawn another Harness child against the
// same profile, and the pile-up makes the app appear to hang.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  dialog.showErrorBox(
    "DeepSeek Harness Code 已在运行",
    "另一实例正在运行（可能是崩溃后 watchdog 自动重启的实例）。请在任务管理器中结束残留进程后重试。",
  );
  app.exit(0);
}

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

async function setPreferences(value: DesktopPreferencesState): Promise<void> {
  const target = settingsPath();
  await mkdir(dirname(target), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    if (typeof parsed === "object" && parsed !== null) {
      existing = parsed as Record<string, unknown>;
    }
  } catch {
    // Missing or malformed settings are replaced with the validated state.
  }
  await writeFile(target, JSON.stringify({ ...existing, ...value }), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function getLanAccessPasswordHash(): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(settingsPath(), "utf8"));
    const hash =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>).lanAccessPasswordHash
        : undefined;
    return typeof hash === "string" && hash.startsWith("scrypt-v1$")
      ? hash
      : undefined;
  } catch {
    return undefined;
  }
}

async function persistLanAccessPasswordHash(
  passwordHash: string | undefined,
): Promise<void> {
  const target = settingsPath();
  await mkdir(dirname(target), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(target, "utf8"));
    if (typeof parsed === "object" && parsed !== null) {
      existing = parsed as Record<string, unknown>;
    }
  } catch {
    // The preferences writer will fill the remaining fields later.
  }
  if (passwordHash === undefined) delete existing.lanAccessPasswordHash;
  else existing.lanAccessPasswordHash = passwordHash;
  await writeFile(target, JSON.stringify(existing), {
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
    if (lifecycle.isQuitting()) return;
    event.preventDefault();
    void handleWindowClose(window).catch(reportRuntimeFailure);
  });
  if (showStartupPage)
    void window.loadFile(createStartupPagePath(app.getAppPath()));
  return window;
}

async function handleWindowClose(window: BrowserWindow): Promise<void> {
  const action = await resolveCloseAction(
    preferencesStore.get().closeBehavior,
    chooseCloseBehavior,
    async (value) => {
      await preferencesStore.update({ closeBehavior: value });
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
    : join(app.getAppPath(), "build", "node-runtime");
}

async function showNodeRequiredDialog(
  failedError?: Error,
): Promise<"manual" | "retry" | "quit"> {
  const isMissing = failedError === undefined;
  const buttons = isMissing
    ? ["Show Installer Link", "Retry detection", "Quit"]
    : ["Retry detection", "Show Installer Link", "Quit"];
  const options: Electron.MessageBoxOptions = {
    type: isMissing ? "question" : "error",
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    title: "Node.js required",
    message: isMissing
      ? "DeepSeek Harness Code needs an official system Node.js installation to run the local Harness."
      : "The pinned Harness packages could not be installed.",
    detail: isMissing
      ? `No usable Node.js installation was detected. Install Node.js from the official installer, then retry detection. Version ${MINIMUM_NODE_VERSION} or newer is required.`
      : `${failedError.message.slice(0, 2_000)}\n\nOfficial Node.js download: ${NODE_DOWNLOAD_PAGE_URL}`,
  };
  const result =
    mainWindow === undefined || mainWindow.isDestroyed()
      ? await dialog.showMessageBox(options)
      : await dialog.showMessageBox(mainWindow, options);
  const response = result.response;
  if (isMissing) {
    return (["manual", "retry", "quit"] as const)[response] ?? "quit";
  }
  return (["retry", "manual", "quit"] as const)[response] ?? "quit";
}

async function prepareSystemNodeRuntime(): Promise<void> {
  const userDataPath = app.getPath("userData");
  const runtimeResourcePath = nodeRuntimeResourcePath();
  for (;;) {
    const node = resolveSystemNode();
    if (node === undefined) {
      const choice = await showNodeRequiredDialog();
      if (choice === "manual") {
        const urls = getNodeDownloadUrls(process.platform, process.arch);
        const manualOpts: Electron.MessageBoxOptions = {
          type: "info",
          title: "Node.js installer link",
          message: "Install Node.js manually",
          detail: `Download and run the Node.js installer:\n${urls.installerUrl}\n\nAfter installing, click "Retry detection".`,
          buttons: ["Open link", "Close"],
        };
        if (mainWindow && !mainWindow.isDestroyed()) {
          await dialog.showMessageBox(mainWindow, manualOpts);
        } else {
          await dialog.showMessageBox(manualOpts);
        }
        await shell.openExternal(urls.installerUrl);
        continue;
      }
      if (choice === "quit") {
        throw new Error(
          "An official Node.js installation is required for the local Harness.",
        );
      }
      continue;
    }
    process.stderr.write(
      `Using system Node.js ${node.version === null ? "(unknown version)" : `v${node.version}`} from ${node.executable} (${node.source}).\n`,
    );
    try {
      const ensured = await ensureRuntimePackages({
        userDataPath,
        runtimeResourcePath,
        systemNode: node,
      });
      nodeRuntimePaths = ensured.paths;
      systemNodeRuntime = node;
      if (ensured.installed) {
        process.stderr.write(
          `Installed pinned Harness packages under ${userDataPath}/node-runtime.\n`,
        );
      }
      // Best-effort official CLI availability: never block startup on it.
      const globalCli = await ensureGlobalDshCli({
        nodeExecutable: node.executable,
        runtimeResourcePath,
      }).catch((error: unknown): { status: "failed"; message?: string } => ({
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      }));
      if (globalCli.status === "installed") {
        process.stderr.write(
          `Installed the official dsh@${globalCli.pinnedVersion} command globally; it is available in new terminal sessions.\n`,
        );
      } else if (
        globalCli.status !== "present" &&
        globalCli.message !== undefined
      ) {
        process.stderr.write(`Global dsh CLI: ${globalCli.message}\n`);
      }
      return;
    } catch (error) {
      const failedError =
        error instanceof Error ? error : new Error("Unknown runtime error");
      const choice = await showNodeRequiredDialog(failedError);
      if (choice === "manual") {
        const urls = getNodeDownloadUrls(process.platform, process.arch);
        await shell.openExternal(urls.installerUrl);
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

function systemNodeExecutable(): string {
  if (systemNodeRuntime === undefined) {
    throw new Error("System Node.js runtime is not prepared");
  }
  return systemNodeRuntime.executable;
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
  const uiPolishPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "dsh-ui-polish")
    : join(app.getAppPath(), "packages", "dsh-ui-polish");
  const updaterCheckPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "dsh-updater-check")
    : join(app.getAppPath(), "packages", "dsh-updater-check");
  const lanAccessPluginRoot = app.isPackaged
    ? join(process.resourcesPath, "dsh-lan-access")
    : join(app.getAppPath(), "packages", "dsh-lan-access");
  const promptPrinciplesRoot = app.isPackaged
    ? join(process.resourcesPath, "prompt-principles-plugin")
    : join(app.getAppPath(), "packages", "prompt-principles-plugin");
  const superpowersSkillsRoot = app.isPackaged
    ? join(process.resourcesPath, "superpowers-skills")
    : join(app.getAppPath(), "packages", "superpowers-skills");
  const globalAgentPromptRoot = app.isPackaged
    ? join(process.resourcesPath, "global-agent-prompt")
    : join(app.getAppPath(), "config", "global-agent-prompt");
  const bundledRoutingSuiteRoot = app.isPackaged
    ? join(process.resourcesPath, "routing-suite")
    : join(app.getAppPath(), "build", "routing-suite");
  const runtimeBinRoot = join(app.getPath("userData"), "runtime-bin");
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
    nodeExecutable: systemNodeExecutable(),
    pnpmEntry: join(nodeRuntimeResourcePath(), "pnpm.mjs"),
    pnpmStoreDir: runtime.pnpmStoreDir,
    runtimeBinRoot: runtimeBinRoot,
    releaseIdentity: app.getVersion(),
    serverEverythingRoot: runtime.serverEverythingRoot,
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
        packageName: "dsh-ui-polish",
        packageRoot: uiPolishPluginRoot,
      },
      {
        packageName: "dsh-updater-check",
        packageRoot: updaterCheckPluginRoot,
      },
      {
        packageName: "dsh-lan-access",
        packageRoot: lanAccessPluginRoot,
      },
      {
        packageName: "dsh-superpowers",
        packageRoot: runtime.dshSuperpowersRoot,
      },
      {
        packageName: "dsh-prompt-principles",
        packageRoot: promptPrinciplesRoot,
      },
      {
        packageName: "dsh-better-sidebar",
        packageRoot: runtime.dshBetterSidebarRoot,
      },
      {
        packageName: "deepseek-harness-composition",
        packageRoot: runtime.deepseekHarnessCompositionRoot,
      },
      {
        packageName: "@deepseek-ai/dsh-subagent-codex",
        packageRoot: runtime.dshSubagentCodexRoot,
        linkOnly: true,
      },
      {
        packageName: "@deepseek-ai/dsh-subagent-claude-code",
        packageRoot: runtime.dshSubagentClaudeCodeRoot,
        linkOnly: true,
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
      {
        packageName: "dsh-vision-router",
        packageRoot: runtime.dshVisionRouterRoot,
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
  const globalPrompt = await installGlobalAgentPromptForStartup({
    dshHome,
    resourceRoot: globalAgentPromptRoot,
  });
  if (globalPrompt.status === "installed") {
    process.stderr.write(
      "Installed the bundled global AGENTS.md prompt under the official Harness home.\n",
    );
  } else if (globalPrompt.status === "updated") {
    process.stderr.write(
      "Updated the app-managed global AGENTS.md prompt to this release's bundled version.\n",
    );
  } else if (globalPrompt.status === "conflict") {
    process.stderr.write(
      'Bundled global AGENTS.md prompt skipped: a user-owned global prompt is already present. Use "Use Bundled Global Prompt…" in the app menu to switch.\n',
    );
  } else if (globalPrompt.status === "unavailable") {
    process.stderr.write(
      "Bundled global AGENTS.md prompt resource is unavailable; Harness startup will continue.\n",
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
      nodeExecutable: systemNodeExecutable(),
      dshEntry,
      dshHome,
      port,
    });
    const child = spawn(spec.command, spec.args, {
      // The harness may spawn bundled tooling (for example the dsh-npx
      // launcher behind the MCP bridge) whose commands resolve through
      // PATH. A GUI launch inherits a minimal PATH, so prepend the
      // runtime-bin launchers and the detected system Node directory.
      env: {
        ...process.env,
        ...spec.env,
        // The runtime-bin/pnpm launcher resolves Node + pnpm + the store dir
        // through these env vars. The first-launch install sets them, but the
        // running Harness (and its one-click plugin updates, which re-invoke
        // pnpm) must inherit them too, or the launcher's `exec` gets an empty
        // Node path ("exec: : not found").
        DHC_NODE_EXECUTABLE: systemNodeExecutable(),
        DHC_PNPM_ENTRY: join(nodeRuntimeResourcePath(), "pnpm.mjs"),
        DHC_PNPM_STORE_DIR: runtime.pnpmStoreDir,
        PATH: [
          runtimeBinRoot,
          dirname(systemNodeExecutable()),
          process.env.PATH,
        ]
          .filter((entry) => entry !== undefined && entry !== "")
          .join(delimiter),
      },
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

async function adoptBundledGlobalPrompt(): Promise<void> {
  const { dshHome } = resolveHarnessDataPaths(app.getPath("userData"));
  const resourceRoot = app.isPackaged
    ? join(process.resourcesPath, "global-agent-prompt")
    : join(app.getAppPath(), "config", "global-agent-prompt");
  const confirmOptions: Electron.MessageBoxOptions = {
    type: "question",
    buttons: ["Back up and switch", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    title: "Use Bundled Global Prompt",
    message:
      "Replace the global AGENTS.md with the bundled Global Agent Operating Protocol?",
    detail:
      "The current file is backed up as AGENTS.md.backup-<timestamp> in the same directory. The new prompt takes effect from the next Harness session.",
  };
  const confirm =
    mainWindow !== undefined && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, confirmOptions)
      : await dialog.showMessageBox(confirmOptions);
  if (confirm.response !== 0) return;
  try {
    const result = await adoptBundledGlobalAgentPrompt({
      dshHome,
      resourceRoot,
    });
    if (result.status === "unavailable") {
      await dialog.showMessageBox({
        type: "warning",
        message: "Bundled global prompt unavailable",
        detail:
          "The bundled AGENTS.md resource is missing from this installation.",
      });
      return;
    }
    await dialog.showMessageBox({
      type: "info",
      title: "Global prompt updated",
      message: "The global AGENTS.md now uses the bundled prompt.",
      detail:
        result.backupPath === undefined
          ? "No previous prompt existed, so no backup was created."
          : `Previous prompt backed up at: ${result.backupPath}`,
    });
  } catch (error) {
    const failedError =
      error instanceof Error ? error : new Error("Unknown error");
    dialog.showErrorBox(
      "Global prompt switch failed",
      failedError.message.slice(0, 2_000),
    );
  }
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
        adoptBundledGlobalPrompt: () =>
          void adoptBundledGlobalPrompt().catch(reportRuntimeFailure),
        quit: () => app.quit(),
        pasteFocused: () =>
          BrowserWindow.getFocusedWindow()?.webContents.paste(),
      }),
    ),
  );
}

function publishUpdaterStatus(status: UpdaterStatus): void {
  updaterStatusStore.publish(status);
  if (mainWindow === undefined || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send("updater:changed", status);
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
  await prepareSystemNodeRuntime();
  controller = new HarnessRuntimeController({
    origin: () => harnessOrigin,
    startHarness,
    probeHealth: httpOk,
    waitForReady: async (child, origin) =>
      isHarnessChildAlive(child) && httpOk(origin),
    isChildAlive: isHarnessChildAlive,
    runtimeNotice: () => routingSuiteNotice ?? anchoredPresetNotice,
    onReady: async (origin, child) => {
      await lanAccessController
        .onHarnessReady(origin)
        .catch(reportRuntimeFailure);
      await mainWindow?.loadURL(origin);
      if (smokeConfig === undefined || child.pid === undefined) return;
      const provenance = {
        harnessHome: resolveHarnessDataPaths(app.getPath("userData")).dshHome,
        resourceRoot: process.resourcesPath,
        systemNode: {
          executable: systemNodeRuntime?.executable ?? "",
          version:
            spawnSync(systemNodeRuntime?.executable ?? "", ["--version"], {
              encoding: "utf8",
              windowsHide: true,
            })
              .stdout?.trim()
              .match(/^v(\d+\.\d+\.\d+)$/u)?.[1] ?? null,
        },
      };
      validateSmokeRuntimeProvenance(provenance, [
        app.getPath("userData"),
        process.resourcesPath,
      ]);
      smokeReadyEvidence = buildSmokeReadyEvidence(smokeConfig, {
        harnessOrigin: origin,
        appPid: process.pid,
        harnessPid: child.pid,
        listenerPid: child.pid,
        readinessProbePassed: true,
        packaged: app.isPackaged,
        resources: [
          join(process.resourcesPath, "desktop-plugin", "package.json"),
          join(
            process.resourcesPath,
            "anchored-standard-plugin",
            "package.json",
          ),
          join(process.resourcesPath, "dsh-lan-access", "package.json"),
          join(process.resourcesPath, "node-runtime", "package.json"),
          join(process.resourcesPath, "routing-suite", "versions.json"),
        ],
        harnessHome: provenance.harnessHome,
        resourceRoot: provenance.resourceRoot,
        systemNode: provenance.systemNode,
      });
      await writeSmokeEvidence({
        schema: 2,
        runId: smokeConfig.runId,
        ready: smokeReadyEvidence,
        startedAt: smokeStartedAt,
      });
      await awaitSmokeAcknowledgement(
        {
          acknowledgementPath: smokeConfig.acknowledgementPath ?? "",
          runId: smokeConfig.runId,
          appPid: process.pid,
          timeoutMs: 30_000,
          pollIntervalMs: 100,
        },
        {
          now: performance.now.bind(performance),
          delay: (milliseconds) =>
            new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
          requestQuit: () => queueMicrotask(() => app.quit()),
        },
      );
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
    getAppInfo: () => ({
      name: "DeepSeek Harness Code",
      version: app.getVersion(),
    }),
    getRuntimeState: () => controller!.getState(),
    restartHarness: () => controller!.restart(),
    openLogs: async () => {
      await shell.openPath(app.getPath("logs"));
    },
    getPreferences: () => preferencesStore.get(),
    setPreferences: async (value) => {
      await preferencesStore.update(value);
    },
    getLanAccess: () => lanAccessController.get(),
    setLanAccess: (value) => lanAccessController.set(value),
    copyLanAccessUrl: async (value) => lanAccessController.copyUrl(value),
    paste: (target) => target.paste(),
    getUpdaterStatus: () => updaterStatusStore.get(),
    checkForUpdates: () =>
      updaterHost?.check() ?? Promise.resolve({ available: false }),
    applyUpdate: () =>
      updaterHost?.apply() ?? Promise.resolve({ available: false }),
    restartForUpdate: () => updaterHost?.restart() ?? Promise.resolve(),
    listBundledPlugins: () => [],
  });
  buildMenu();
  createTray();
  if (process.platform === "darwin") app.dock?.show();
  preferencesStore.load(await getPreferences());
  lanAccessController.loadPersistedEnabled(
    preferencesStore.get().lanAccessEnabled,
  );
  lanAccessController.loadPersistedPassword(await getLanAccessPasswordHash());
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
  const stack = error instanceof Error ? `\n${error.stack ?? ""}` : "";
  console.error(`[DeepSeek Harness Code] ${message}${stack}`);
}

function reportLaunchFailure(error: unknown): void {
  reportRuntimeFailure(error);
  void writeSmokeFailure(error).catch(reportRuntimeFailure);
  const message =
    error instanceof Error
      ? error.message.slice(0, 2_000)
      : "The local Harness could not start.";
  dialog.showErrorBox("DeepSeek Harness Code could not start", message);
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    if (mainWindow === undefined) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

const launchOnce = createSingleFlightAction(async () => {
  await launch();
  updaterHost = new UpdaterHost({ publishStatus: publishUpdaterStatus });
});

const lifecycle = hasSingleInstanceLock
  ? registerDesktopLifecycle(
      {
        whenReady: () => app.whenReady(),
        onActivate: (listener) => app.on("activate", listener),
        onBeforeQuit: (listener) => app.on("before-quit", listener),
      },
      {
        activate: () => {
          if (BrowserWindow.getAllWindows().length === 0) createWindow();
          else mainWindow?.show();
        },
        launch: launchOnce,
        shutdown: shutdownNormally,
        clearHealthTimer: () => {
          if (healthTimer !== undefined) clearInterval(healthTimer);
        },
        reportLaunchFailure,
      },
    )
  : { isQuitting: () => false };

async function shutdownNormally(): Promise<void> {
  let watchdogAcked = false;
  let harnessRetired = false;
  try {
    await lanProxyHost.stop();
  } catch (error) {
    reportRuntimeFailure(error);
  }
  try {
    watchdogAcked = (await watchdogHost?.shutdown())?.status === "acknowledged";
  } catch (error) {
    reportRuntimeFailure(error);
  }
  try {
    harnessRetired = (await controller?.stop())?.retired ?? true;
  } catch (error) {
    reportRuntimeFailure(error);
  }
  await completeSmokeShutdown({
    writeFinalEvidence: async () => {
      if (smokeConfig === undefined || smokeReadyEvidence === undefined) return;
      const finalEvidence = buildSmokeFinalEvidence(smokeConfig, {
        ready: smokeReadyEvidence,
        watchdogAcked,
        harnessRetired,
      });
      await writeSmokeEvidence({
        schema: 2,
        runId: smokeConfig.runId,
        ready: smokeReadyEvidence,
        final: finalEvidence,
        startedAt: smokeStartedAt,
      });
    },
    quit: () => app.quit(),
    reportFailure: (message) =>
      console.error(`[DeepSeek Harness Code] ${message}`),
  });
}
