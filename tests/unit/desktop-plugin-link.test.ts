import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureDesktopPluginBundle,
  ensureDesktopPluginLink,
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

describe("desktop plugin profile link", () => {
  it("makes the bundled package resolvable from the app-owned web profile", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-link-"));
    const pluginRoot = join(root, "resources", "desktop-plugin");
    const dshHome = join(root, "dsh-home");
    await mkdir(pluginRoot, { recursive: true });

    const link = await ensureDesktopPluginLink(dshHome, pluginRoot);

    expect(link).toBe(
      join(
        dshHome,
        "profiles",
        "web",
        "node_modules",
        "deepseek-harness-desktop-plugin",
      ),
    );
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    expect(resolve(dirname(link), await readlink(link))).toBe(
      await realpath(pluginRoot),
    );
  });

  it("registers only the desktop plugin as an official web profile bundle idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-bundle-"));
    const dshHome = join(root, "dsh-home");

    await ensureDesktopPluginBundle(dshHome);
    await ensureDesktopPluginBundle(dshHome);

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
    ]);
  });

  it("removes a legacy anchored web bundle registration", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-disabled-"));
    const dshHome = join(root, "dsh-home");

    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(profileRoot, { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({
        name: "dsh-profile-web",
        private: true,
        dsh: {
          profile: {
            bundles: [
              "@deepseek-ai/dsh-base",
              "@deepseek-ai/dsh-web-app",
              "dsh-anchored-standard",
            ],
          },
        },
      })}\n`,
    );
    await ensureDesktopPluginBundle(dshHome);

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
    ]);
  });
});

describe("official Harness plugin installation", () => {
  it("invokes the public dsh plugin command with bundled pnpm on PATH", async () => {
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
      dshEntry: "/app/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      electronExecutable: "/Applications/DeepSeek Harness Code.app/Electron",
      pnpmEntry: "/app/node_modules/pnpm/bin/pnpm.cjs",
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
      env: { PATH: "/usr/bin" },
      runCommand,
    });

    expect(result).toEqual({
      status: "installed",
      packages: [
        "deepseek-harness-desktop-plugin",
        "@dsh-external/dsh-mode-boost",
      ],
    });
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[0]?.slice(0, 2)).toEqual([
      "/Applications/DeepSeek Harness Code.app/Electron",
      [
        "/app/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "plugin",
        "--profile",
        "web",
        "add",
        await realpath(desktopPlugin),
      ],
    ]);
    const options = runCommand.mock.calls[0]?.[2];
    expect(options).toMatchObject({
      shell: false,
      env: {
        DSH_HOME: dshHome,
        DHC_ELECTRON_EXECUTABLE:
          "/Applications/DeepSeek Harness Code.app/Electron",
        DHC_PNPM_ENTRY: "/app/node_modules/pnpm/bin/pnpm.cjs",
        ELECTRON_RUN_AS_NODE: "1",
      },
    });
    expect(options?.env.PATH?.split(":")?.[0]).toBe(runtimeBinRoot);
    expect(await readFile(join(runtimeBinRoot, "pnpm"), "utf8")).toContain(
      'exec "$DHC_ELECTRON_EXECUTABLE" "$DHC_PNPM_ENTRY" "$@"',
    );
    expect(await readFile(join(runtimeBinRoot, "pnpm.cmd"), "utf8")).toContain(
      '"%DHC_ELECTRON_EXECUTABLE%" "%DHC_PNPM_ENTRY%" %*',
    );
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
        electronExecutable: process.execPath,
        pnpmEntry: "/app/pnpm.cjs",
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
        electronExecutable: process.execPath,
        pnpmEntry: "/app/pnpm.cjs",
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
    expect((await stat(join(dshHome, ".credentials.yaml"))).mode & 0o777).toBe(
      0o600,
    );
    expect(
      (await stat(join(dshHome, "skills", "bundled", "SKILL.md"))).mode & 0o777,
    ).toBe(0o744);

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
