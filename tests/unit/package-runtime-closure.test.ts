import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const pluginRoot = join(projectRoot, "packages", "desktop-plugin");
const execFileAsync = promisify(execFile);
const agentPresetPatchName =
  "@deepseek-ai__dsh-client-ui-agent-preset@0.1.1-rc.2.patch";
const sidebarPatchName = "@deepseek-ai__dsh-client-ui-sidebar@0.1.1-rc.2.patch";

describe("packaged runtime dependency closure", () => {
  it("ships the LAN access settings plugin in the packaged runtime", async () => {
    const lanPluginRoot = join(projectRoot, "packages", "dsh-lan-access");
    const [manifest, rootEntry, hostEntry, clientEntry, patch, closure] =
      await Promise.all([
        readFile(join(lanPluginRoot, "package.json"), "utf8"),
        readFile(join(lanPluginRoot, "index.js"), "utf8"),
        readFile(join(lanPluginRoot, "lib", "index.js"), "utf8"),
        readFile(join(lanPluginRoot, "lib", "client.js"), "utf8"),
        readFile(join(lanPluginRoot, "cordis.patch.yml"), "utf8"),
        readFile(
          join(projectRoot, "scripts", "check-runtime-closure.mjs"),
          "utf8",
        ),
      ]);

    expect(JSON.parse(manifest).name).toBe("dsh-lan-access");
    expect(rootEntry).toContain('name: "dsh-lan-access"');
    expect(hostEntry).toContain('name: "dsh-lan-access"');
    expect(clientEntry).toContain('id: "dsh-lan-access"');
    expect(patch).toContain('name: "dsh-lan-access"');
    expect(closure).toContain("packages/dsh-lan-access/package.json");
    expect(closure).toContain("packages/dsh-lan-access/lib/client.js");
  });

  it("excludes local Mimosa session state from the packaged runtime", async () => {
    const relativeStatePath = join(
      ".mimosa",
      "hook-state",
      "sess_runtime_staging_test.json",
    );
    const sourceStatePath = join(
      projectRoot,
      "config",
      "node-runtime",
      "patches",
      relativeStatePath,
    );
    const stagedStatePath = join(
      projectRoot,
      "build",
      "node-runtime",
      "patches",
      relativeStatePath,
    );
    await mkdir(join(sourceStatePath, ".."), { recursive: true });
    await mkdir(join(stagedStatePath, ".."), { recursive: true });
    await writeFile(sourceStatePath, "{}\n");
    await writeFile(stagedStatePath, "{}\n");

    try {
      await execFileAsync(process.execPath, [
        join(projectRoot, "scripts", "prepare-node-runtime.mjs"),
      ]);
      await expect(access(stagedStatePath)).rejects.toThrow();
    } finally {
      await rm(sourceStatePath, { force: true });
      await rm(stagedStatePath, { force: true });
    }
  });

  it("pins the portable Node runtime package set and pnpm launcher", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@deepseek-ai/dsh-home-paths"]).toBe(
      "0.1.1-rc.2",
    );
    expect(manifest.dependencies.pnpm).toBe("11.19.0");

    const runtimeManifest = JSON.parse(
      await readFile(
        join(projectRoot, "config", "node-runtime", "package.json"),
        "utf8",
      ),
    ) as { dependencies: Record<string, string> };
    expect(runtimeManifest.dependencies["@deepseek-ai/dsh"]).toBe("0.1.1-rc.2");
    expect(runtimeManifest.dependencies["dsh-find-plugin"]).toBe("0.3.6");
    const runtimeLock = await readFile(
      join(projectRoot, "config", "node-runtime", "pnpm-lock.yaml"),
      "utf8",
    );
    expect(runtimeLock).toContain("'@deepseek-ai/dsh':");
    expect(runtimeLock).toContain("dsh-find-plugin:");

    const sidebarSnapshot = runtimeLock.match(
      /dsh-better-sidebar@file:vendor\/dsh-better-sidebar-0\.12\.3\.tgz:[\s\S]*?\n\s*dsh-find-plugin@/,
    )?.[0];
    expect(sidebarSnapshot).toBeDefined();
    expect(sidebarSnapshot).toContain(
      "'@deepseek-ai/dsh-client-ui-slots': ^0.1.1-rc.2",
    );
    expect(sidebarSnapshot).not.toContain("0.1.0-rc.8");

    const prepareScript = await readFile(
      join(projectRoot, "scripts", "prepare-node-runtime.mjs"),
      "utf8",
    );
    expect(prepareScript).toContain("pnpmStandaloneRoot");
    expect(prepareScript).toContain("worker.js");
    expect(prepareScript).toContain('pnpmManifest.version !== "11.19.0"');
    expect(prepareScript).toContain("build/node-runtime");

    // The dsh plugin forwarder must quote space-containing paths when it
    // spawns pnpm through cmd.exe on Windows; without the patch a plugin
    // under "C:\Program Files\..." is split into separate arguments.
    const dshPatch = await readFile(
      join(projectRoot, "patches", "@deepseek-ai__dsh.patch"),
      "utf8",
    );
    expect(dshPatch).toContain("shellQuote");
    expect(dshPatch).toContain('shell: process.platform === "win32"');
    const installedForwarder = await readFile(
      join(
        projectRoot,
        "node_modules",
        "@deepseek-ai",
        "dsh",
        "lib",
        "plugin-9h8shc4d.js",
      ),
      "utf8",
    );
    expect(installedForwarder).toContain("shellQuote");
  });

  it("wires the Agent preset locale patch into both runtime workspaces", async () => {
    const [rootWorkspace, runtimeWorkspace, closureScript] = await Promise.all([
      readFile(join(projectRoot, "pnpm-workspace.yaml"), "utf8"),
      readFile(
        join(projectRoot, "config", "node-runtime", "pnpm-workspace.yaml"),
        "utf8",
      ),
      readFile(
        join(projectRoot, "scripts", "check-runtime-closure.mjs"),
        "utf8",
      ),
    ]);

    expect(rootWorkspace).toContain(agentPresetPatchName);
    expect(runtimeWorkspace).toContain(agentPresetPatchName);
    expect(closureScript).toContain(agentPresetPatchName);
  });

  it("wires the macOS sidebar safe-area patch into both runtime workspaces", async () => {
    const [rootWorkspace, runtimeWorkspace, closureScript] = await Promise.all([
      readFile(join(projectRoot, "pnpm-workspace.yaml"), "utf8"),
      readFile(
        join(projectRoot, "config", "node-runtime", "pnpm-workspace.yaml"),
        "utf8",
      ),
      readFile(
        join(projectRoot, "scripts", "check-runtime-closure.mjs"),
        "utf8",
      ),
    ]);

    expect(rootWorkspace).toContain(sidebarPatchName);
    expect(runtimeWorkspace).toContain(sidebarPatchName);
    expect(closureScript).toContain(sidebarPatchName);
  });

  it("keeps integrated plugin patches on official bare package names", async () => {
    const injectorPatch = await readFile(
      join(projectRoot, "build/routing-suite/injector/cordis.patch.yml"),
      "utf8",
    );
    const modeBoostManifest = JSON.parse(
      await readFile(
        join(projectRoot, "build/routing-suite/mode-boost/package.json"),
        "utf8",
      ),
    ) as { dsh?: { bundle?: { patch?: string } } };
    const modeBoostPatch = await readFile(
      join(projectRoot, "build/routing-suite/mode-boost/cordis.patch.yml"),
      "utf8",
    );
    expect(injectorPatch).toContain("name: '@dsh-external/dsh-super-injector'");
    expect(injectorPatch).not.toContain("./node_modules/");
    expect(modeBoostManifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(modeBoostPatch).toContain("name: '@dsh-external/dsh-mode-boost'");
    expect(modeBoostPatch).not.toContain("./node_modules/");
  });

  it("contains no superseded manual Web-profile assembler", async () => {
    const lifecycle = await readFile(
      join(projectRoot, "apps/desktop/src/lifecycle/desktop-plugin-link.ts"),
      "utf8",
    );
    const routing = await readFile(
      join(projectRoot, "apps/desktop/src/lifecycle/routing-suite-link.ts"),
      "utf8",
    );
    for (const source of [lifecycle, routing]) {
      expect(source).not.toContain("ensureDesktopPluginBundle");
      expect(source).not.toContain("ensureDesktopPluginLink");
      expect(source).not.toContain('profiles", "web", "node_modules');
    }
  });

  it("ships the workflow seam required by the pinned Standard preset", () => {
    expect(() =>
      requireFromProject.resolve("@deepseek-ai/dsh-workflow/package.json"),
    ).not.toThrow();
  });

  it("pins the workflow seam as a production dependency for packaging", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@deepseek-ai/dsh-workflow"]).toBe(
      "0.1.1-rc.2",
    );
  });

  it("pins the Standard preset and official UI runtime contracts", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };

    expect(manifest.dependencies["@deepseek-ai/dsh-compaction"]).toBe(
      "0.1.1-rc.2",
    );
    expect(manifest.dependencies["@deepseek-ai/dsh-invariants"]).toBe(
      "0.1.1-rc.2",
    );
    expect(manifest.dependencies["@deepseek-ai/dsh-client-ui-primitives"]).toBe(
      "0.1.1-rc.2",
    );
  });

  it("bundles preload validation and the host dependencies into the desktop bundle", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts["build:desktop"]).toContain(
      "tsup.desktop.config.ts",
    );
    const config = await readFile(
      join(projectRoot, "tsup.desktop.config.ts"),
      "utf8",
    );
    // The packaged app carries no node_modules, so the sandbox preload
    // bundles its validation code (zod) and the main process bundles the
    // Harness home-path resolver; only Electron stays external.
    expect(config).toContain("noExternal");
    expect(config).toContain("/^zod$/");
    expect(config).toContain("/^@deepseek-ai\\//");
    expect(config).toContain('external: ["electron"]');
  });

  it("bundles only the inline thinking status enhancement", async () => {
    const manifest = JSON.parse(
      await readFile(join(pluginRoot, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };
    const client = await readFile(join(pluginRoot, "client.js"), "utf8");
    expect(manifest.dependencies["thinking-orbs"]).toBe("0.3.1");
    expect(client).toContain("ThinkingOrb");
    expect(client).toContain("data-dsh-desktop-thinking-inline");
    for (const retiredEffect of [
      "ConversationEffectsOverlay",
      "data-dsh-desktop-thinking-source",
      "data-dsh-desktop-thinking-orb",
      "data-dsh-stream-overlay",
    ]) {
      expect(client).not.toContain(retiredEffect);
    }
    expect(client).not.toContain('require("thinking-orbs")');
    expect(client).not.toContain('require("./thinking-status.js")');
  });
});
