import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureDesktopPluginBundle,
  ensureDesktopPluginLink,
  ensureOfficialHarnessInstall,
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
