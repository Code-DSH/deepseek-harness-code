import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureOfficialHarnessInstall,
  migrateLegacyHarnessHome,
  type OfficialCommandRunner,
} from "../../apps/desktop/src/lifecycle/desktop-plugin-link.js";

async function createPlugin(
  root: string,
  directory: string,
  packageName: string,
): Promise<string> {
  const pluginRoot = join(root, directory);
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "package.json"),
    `${JSON.stringify({
      name: packageName,
      version: "1.0.0",
      dsh: { bundle: { patch: "./cordis.patch.yml" } },
    })}\n`,
  );
  await writeFile(
    join(pluginRoot, "cordis.patch.yml"),
    `- insert:\n    - id: ${packageName}\n      name: '${packageName}'\n`,
  );
  return pluginRoot;
}

describe("official Harness plugin installation", () => {
  it("removes a profile node_modules linked against a foreign pnpm store", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-store-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const foreignModules = join(dshHome, "profiles", "web", "node_modules");
    await mkdir(foreignModules, { recursive: true });
    await writeFile(
      join(foreignModules, ".modules.yaml"),
      `${JSON.stringify({
        layoutVersion: 5,
        storeDir: join(root, "user-global-pnpm-store", "v11"),
      })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));

    const result = await ensureOfficialHarnessInstall({
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: "/app-data/node-runtime/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    });

    expect(result).toEqual({
      status: "installed",
      packages: ["deepseek-harness-desktop-plugin"],
    });
    await expect(stat(foreignModules)).rejects.toThrow();
  });

  it("keeps a profile node_modules linked against the managed store", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-keep-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const managedModules = join(dshHome, "profiles", "web", "node_modules");
    await mkdir(managedModules, { recursive: true });
    await writeFile(
      join(managedModules, ".modules.yaml"),
      `${JSON.stringify({
        layoutVersion: 5,
        storeDir: "/app-data/node-runtime/pnpm-store/v11",
      })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));

    await ensureOfficialHarnessInstall({
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: "/app-data/node-runtime/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    });

    await expect(stat(managedModules)).resolves.not.toThrow();
  });

  it("rebuilds a corrupted profile node_modules once and retries the official install", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-eloop-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const profileModules = join(dshHome, "profiles", "web", "node_modules");
    await mkdir(profileModules, { recursive: true });
    await writeFile(
      join(profileModules, ".modules.yaml"),
      `${JSON.stringify({
        layoutVersion: 5,
        storeDir: "/app-data/node-runtime/pnpm-store/v11",
      })}\n`,
    );
    let calls = 0;
    const runCommand = vi.fn<OfficialCommandRunner>(() => {
      calls += 1;
      return calls === 1
        ? {
            status: 194,
            stdout: "",
            stderr: "ELOOP: too many symbolic links encountered",
          }
        : { status: 0, stdout: "", stderr: "" };
    });

    const result = await ensureOfficialHarnessInstall({
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: "/app-data/node-runtime/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    });

    expect(result).toEqual({
      status: "installed",
      packages: ["deepseek-harness-desktop-plugin"],
    });
    expect(runCommand).toHaveBeenCalledTimes(2);
    await expect(stat(profileModules)).rejects.toThrow();
  });

  it("invokes the public dsh plugin command with the managed pnpm launcher on PATH", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-official-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const modeBoost = await createPlugin(
      root,
      "mode-boost",
      "@dsh-external/dsh-mode-boost",
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));

    const result = await ensureOfficialHarnessInstall({
      dshEntry:
        "/user-data/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: "/user-data/node-runtime/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
        {
          packageName: "@dsh-external/dsh-mode-boost",
          packageRoot: modeBoost,
        },
      ],
      legacyPluginSpecs: [
        {
          packageName: "legacy-user-plugin",
          installSpec: "legacy-user-plugin@1.2.3",
        },
      ],
      env: { PATH: "/usr/bin" },
      runCommand,
    });

    expect(result).toEqual({
      status: "installed",
      packages: [
        "legacy-user-plugin",
        "deepseek-harness-desktop-plugin",
        "@dsh-external/dsh-mode-boost",
      ],
    });
    expect(runCommand).toHaveBeenCalledTimes(3);
    expect(runCommand.mock.calls[0]?.[1]).toEqual([
      "/user-data/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      "plugin",
      "--profile",
      "web",
      "add",
      "legacy-user-plugin@1.2.3",
    ]);
    expect(runCommand.mock.calls[1]?.slice(0, 2)).toEqual([
      "/usr/bin/node",
      [
        "/user-data/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "plugin",
        "--profile",
        "web",
        "add",
        await realpath(desktopPlugin),
      ],
    ]);
    const options = runCommand.mock.calls[1]?.[2];
    expect(options).toMatchObject({
      shell: false,
      env: {
        DSH_HOME: dshHome,
        DHC_NODE_EXECUTABLE: "/usr/bin/node",
        DHC_PNPM_ENTRY: "/resources/node-runtime/pnpm.mjs",
        DHC_PNPM_STORE_DIR: "/user-data/node-runtime/pnpm-store",
      },
    });
    expect(options?.env.PATH?.split(delimiter)?.[0]).toBe(runtimeBinRoot);
    expect(await readFile(join(runtimeBinRoot, "pnpm"), "utf8")).toContain(
      'exec "$DHC_NODE_EXECUTABLE" "$DHC_PNPM_ENTRY" --store-dir "$DHC_PNPM_STORE_DIR" "$@"',
    );
    expect(await readFile(join(runtimeBinRoot, "pnpm.cmd"), "utf8")).toContain(
      '"%DHC_NODE_EXECUTABLE%" "%DHC_PNPM_ENTRY%" --store-dir "%DHC_PNPM_STORE_DIR%" %*',
    );
    // The shim embeds the Node directory through the host's path module, so
    // the expected launcher text uses the platform's separators.
    const nodeBinDir = dirname("/usr/bin/node");
    expect(await readFile(join(runtimeBinRoot, "dsh-npx"), "utf8")).toContain(
      `exec "${join(nodeBinDir, "npx")}" "$@"`,
    );
    expect(
      await readFile(join(runtimeBinRoot, "dsh-npx.cmd"), "utf8"),
    ).toContain(`"${join(nodeBinDir, "npx.cmd")}" %*`);
  });

  it("fails without running a mismatched or failed package", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-rejected-"));
    const mismatched = await createPlugin(root, "plugin", "actual-package");
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 17,
      stdout: "",
      stderr: "sensitive package-manager details",
    }));

    await expect(
      ensureOfficialHarnessInstall({
        dshEntry: "/app/dsh.js",
        dshHome: join(root, "home"),
        nodeExecutable: process.execPath,
        pnpmEntry: "/app/pnpm.mjs",
        pnpmStoreDir: join(root, "pnpm-store"),
        runtimeBinRoot: join(root, "runtime-bin"),
        integratedPlugins: [
          { packageName: "expected-package", packageRoot: mismatched },
        ],
        runCommand,
      }),
    ).rejects.toThrow("expected-package does not match actual-package");
    expect(runCommand).not.toHaveBeenCalled();

    await writeFile(
      join(mismatched, "package.json"),
      `${JSON.stringify({ name: "expected-package", version: "1.0.0" })}\n`,
    );
    await expect(
      ensureOfficialHarnessInstall({
        dshEntry: "/app/dsh.js",
        dshHome: join(root, "home"),
        nodeExecutable: process.execPath,
        pnpmEntry: "/app/pnpm.mjs",
        pnpmStoreDir: join(root, "pnpm-store"),
        runtimeBinRoot: join(root, "runtime-bin"),
        integratedPlugins: [
          { packageName: "expected-package", packageRoot: mismatched },
        ],
        runCommand,
      }),
    ).rejects.toThrow(
      "official plugin installation failed for expected-package (exit 17)",
    );
  });
});

describe("legacy Harness Home migration", () => {
  it("is a no-op when the legacy Home does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-migration-absent-"));

    await expect(
      migrateLegacyHarnessHome({
        legacyHome: join(root, "legacy"),
        dshHome: join(root, "official"),
      }),
    ).resolves.toEqual({
      status: "not-needed",
      copied: [],
      conflicts: [],
      skippedSymlinks: [],
      legacyPluginSpecs: [],
    });
  });

  it("merges target-absent data, preserves conflicts, and is idempotent", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-migration-merge-"));
    const legacyHome = join(root, "legacy");
    const dshHome = join(root, "official");
    await mkdir(join(legacyHome, "sessions"), { recursive: true });
    await mkdir(join(legacyHome, "skills", "bundled"), { recursive: true });
    await mkdir(join(dshHome, "sessions"), { recursive: true });
    await writeFile(join(legacyHome, "sessions", "new.jsonl"), "legacy-new\n");
    await writeFile(join(legacyHome, "sessions", "shared.jsonl"), "legacy\n");
    await writeFile(join(dshHome, "sessions", "shared.jsonl"), "official\n");
    await writeFile(
      join(legacyHome, "skills", "bundled", "SKILL.md"),
      "# Bundled\n",
      { mode: 0o744 },
    );
    await writeFile(join(legacyHome, ".credentials.yaml"), "secret: value\n", {
      mode: 0o644,
    });
    await writeFile(join(legacyHome, "settings.yaml"), "legacy: true\n");
    await writeFile(join(dshHome, "settings.yaml"), "official: true\n");

    const first = await migrateLegacyHarnessHome({ legacyHome, dshHome });

    expect(first.status).toBe("migrated");
    expect(first.copied).toEqual([
      ".credentials.yaml",
      join("sessions", "new.jsonl"),
      join("skills", "bundled", "SKILL.md"),
    ]);
    expect(first.conflicts).toEqual([
      join("sessions", "shared.jsonl"),
      "settings.yaml",
    ]);
    expect(
      await readFile(join(dshHome, "sessions", "shared.jsonl"), "utf8"),
    ).toBe("official\n");
    // POSIX permission bits are not meaningful on Windows (Node reports the
    // default writable mode), so the ownership assertions run only on POSIX.
    if (process.platform !== "win32") {
      expect(
        (await stat(join(dshHome, ".credentials.yaml"))).mode & 0o777,
      ).toBe(0o600);
      expect(
        (await stat(join(dshHome, "skills", "bundled", "SKILL.md"))).mode &
          0o777,
      ).toBe(0o744);
    }

    const second = await migrateLegacyHarnessHome({ legacyHome, dshHome });
    expect(second).toMatchObject({
      status: "unchanged",
      copied: [],
      conflicts: [join("sessions", "shared.jsonl"), "settings.yaml"],
    });
  });

  it("skips symlinks and normalizes only missing legacy plugin specs", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-migration-plugin-"));
    const legacyHome = join(root, "legacy");
    const dshHome = join(root, "official");
    const legacyProfile = join(legacyHome, "profiles", "web");
    const officialProfile = join(dshHome, "profiles", "web");
    await mkdir(join(legacyHome, "sessions"), { recursive: true });
    await mkdir(legacyProfile, { recursive: true });
    await mkdir(officialProfile, { recursive: true });
    await symlink(
      join(root, "outside"),
      join(legacyHome, "sessions", "outside-link"),
    );
    await writeFile(
      join(legacyProfile, "package.json"),
      `${JSON.stringify({
        dependencies: {
          "existing-plugin": "1.0.0",
          "linked-plugin": "link:../../../plugins/linked-plugin",
          "registry-plugin": "0.3.6",
        },
      })}\n`,
    );
    await writeFile(
      join(officialProfile, "package.json"),
      `${JSON.stringify({ dependencies: { "existing-plugin": "2.0.0" } })}\n`,
    );

    const result = await migrateLegacyHarnessHome({ legacyHome, dshHome });

    expect(result.skippedSymlinks).toEqual([join("sessions", "outside-link")]);
    expect(result.legacyPluginSpecs).toEqual([
      {
        packageName: "linked-plugin",
        installSpec: `link:${resolve(legacyProfile, "../../../plugins/linked-plugin")}`,
      },
      { packageName: "registry-plugin", installSpec: "registry-plugin@0.3.6" },
    ]);
  });

  it("rolls back only files created by a failed migration attempt", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-migration-rollback-"));
    const legacyHome = join(root, "legacy");
    const dshHome = join(root, "official");
    await mkdir(join(legacyHome, "sessions"), { recursive: true });
    await mkdir(join(dshHome, "sessions"), { recursive: true });
    await writeFile(join(legacyHome, "sessions", "a.jsonl"), "a\n");
    await writeFile(join(legacyHome, "sessions", "b.jsonl"), "b\n");
    await writeFile(join(dshHome, "sessions", "existing.jsonl"), "keep\n");
    let copies = 0;

    await expect(
      migrateLegacyHarnessHome({
        legacyHome,
        dshHome,
        copyFileOperation: async (source, target) => {
          copies += 1;
          if (copies === 2) throw new Error("injected copy failure");
          await import("node:fs/promises").then(({ copyFile }) =>
            copyFile(source, target),
          );
        },
      }),
    ).rejects.toThrow("injected copy failure");
    await expect(
      readFile(join(dshHome, "sessions", "a.jsonl"), "utf8"),
    ).rejects.toThrow();
    expect(
      await readFile(join(dshHome, "sessions", "existing.jsonl"), "utf8"),
    ).toBe("keep\n");
  });
});
