import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { ensureMaintainedHarnessInstall } from "../../apps/desktop/src/lifecycle/desktop-plugin-link.js";
import { reserveLoopbackPort } from "../../apps/desktop/src/lifecycle/port-retry.js";

const root = process.cwd();
const resource = join(root, "build", "node-runtime");
const runtime = join(resource, "node_modules");
const packageRoot = (name: string) => join(runtime, ...name.split("/"));
const children: ChildProcess[] = [];
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill("SIGTERM");
        }),
    ),
  );
  children.length = 0;
  await Promise.all(
    roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })),
  );
});

it("diagnoses the complete packaged startup plugin graph", async () => {
  const temp = await mkdtemp(join(tmpdir(), "dsh-full-startup-diagnostic-"));
  roots.push(temp);
  const dshHome = join(temp, "dsh-home");
  const pnpmStoreDir = join(temp, "pnpm-store");
  const runtimeBinRoot = join(temp, "runtime-bin");
  const pluginSpecs: Array<[string, string]> = [
    [
      "deepseek-harness-desktop-plugin",
      join(root, "packages", "desktop-plugin"),
    ],
    ["dsh-ui-motion", join(root, "packages", "dsh-ui-motion")],
    [
      "dsh-model2-selector",
      join(root, "packages", "dsh-model-two-level-selector"),
    ],
    ["dsh-ui-polish", join(root, "packages", "dsh-ui-polish")],
    ["dsh-updater-check", join(root, "packages", "dsh-updater-check")],
    ["dsh-lan-access", join(root, "packages", "dsh-lan-access")],
    ["dsh-superpowers", packageRoot("dsh-superpowers")],
    [
      "dsh-prompt-principles",
      join(root, "packages", "prompt-principles-plugin"),
    ],
    ["dsh-better-sidebar", packageRoot("dsh-better-sidebar")],
    [
      "deepseek-harness-composition",
      packageRoot("deepseek-harness-composition"),
    ],
    [
      "@deepseek-ai/dsh-subagent-codex",
      packageRoot("@deepseek-ai/dsh-subagent-codex"),
    ],
    [
      "@deepseek-ai/dsh-subagent-claude-code",
      packageRoot("@deepseek-ai/dsh-subagent-claude-code"),
    ],
    [
      "@dsh-external/dsh-super-injector",
      join(root, "build", "routing-suite", "injector"),
    ],
    [
      "@dsh-external/dsh-mode-boost",
      join(root, "build", "routing-suite", "mode-boost"),
    ],
    ["dsh-find-plugin", packageRoot("dsh-find-plugin")],
    ["dsh-vision-router", packageRoot("dsh-vision-router")],
    ["dsh-settings-tools", join(root, "packages", "dsh-settings-tools")],
    [
      "@dsh-external/deepseek-harness-plugin-market",
      join(root, "packages", "dsh-plugin-market"),
    ],
  ];
  const integratedPlugins = pluginSpecs.map(([packageName, packageRoot]) => ({
    packageName,
    packageRoot,
  }));

  const dshEntry = join(runtime, "@deepseek-ai", "dsh", "lib", "bin.js");
  await ensureMaintainedHarnessInstall({
    dshEntry,
    dshHome,
    nodeExecutable: process.execPath,
    pnpmEntry: join(resource, "pnpm.mjs"),
    pnpmStoreDir,
    runtimeBinRoot,
    releaseIdentity: "BETA4-local-diagnostic",
    serverEverythingRoot: packageRoot(
      "@modelcontextprotocol/server-everything",
    ),
    integratedPlugins,
  });

  const port = await reserveLoopbackPort();
  const child = spawn(
    process.execPath,
    [
      "--expose-internals",
      dshEntry,
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--no-open",
    ],
    {
      env: {
        ...process.env,
        DSH_HOME: dshHome,
        DHC_NODE_EXECUTABLE: process.execPath,
        DHC_PNPM_ENTRY: join(resource, "pnpm.mjs"),
        DHC_PNPM_STORE_DIR: pnpmStoreDir,
        PATH: [runtimeBinRoot, dirname(process.execPath), process.env.PATH]
          .filter(Boolean)
          .join(":"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(child);
  let diagnostics = "";
  const result = await new Promise<{
    ready: boolean;
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    const finish = (value: {
      ready: boolean;
      code: number | null;
      signal: NodeJS.Signals | null;
    }) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(
      () => finish({ ready: false, code: null, signal: null }),
      15_000,
    );
    child.stdout?.on("data", (chunk) => {
      diagnostics += `[stdout] ${String(chunk)}`;
      if (diagnostics.includes("dsh web:"))
        finish({ ready: true, code: null, signal: null });
    });
    child.stderr?.on("data", (chunk) => {
      diagnostics += `[stderr] ${String(chunk)}`;
    });
    child.once("exit", (code, signal) =>
      finish({ ready: false, code, signal }),
    );
  });
  console.error(
    `diagnostic child result=${JSON.stringify(result)}\n${diagnostics}`,
  );
  expect(result.ready).toBe(true);
}, 90_000);
