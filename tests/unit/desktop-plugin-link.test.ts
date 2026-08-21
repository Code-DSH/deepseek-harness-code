import {
  mkdir,
  mkdtemp,
  rm,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  it("skips unchanged reconciliation on warm startup", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-warm-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const inputStoreDir = "/app-data/node-runtime/pnpm-store";
    await mkdir(join(dshHome, "profiles", "web", "node_modules"), {
      recursive: true,
    });
    await writeFile(
      join(dshHome, "profiles", "web", "package.json"),
      `${JSON.stringify({
        dependencies: {
          "deepseek-harness-desktop-plugin": `link:${await realpath(desktopPlugin)}`,
        },
      })}\n`,
    );
    await writeFile(
      join(dshHome, "profiles", "web", "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: inputStoreDir })}\n`,
    );
    const manifestContent = await readFile(
      join(desktopPlugin, "package.json"),
      "utf8",
    );
    const markerPayload = JSON.stringify({
      schemaVersion: 2,
      owner: "deepseek-harness-code",
      releaseIdentity: "unknown",
      storeDir: resolve(inputStoreDir),
      packages: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: await realpath(desktopPlugin),
          manifestVersion: "1.0.0",
          manifestDigest: createHash("sha256")
            .update(manifestContent)
            .digest("hex"),
          linkOnly: false,
        },
      ],
    });
    await writeFile(
      join(dshHome, ".deepseek-harness-code-plugin-reconciliation.json"),
      `${JSON.stringify({
        ...JSON.parse(markerPayload),
        digest: createHash("sha256").update(markerPayload).digest("hex"),
      })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: inputStoreDir,
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

    await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
      status: "unchanged",
    });
    await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
      status: "unchanged",
    });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("does not invoke the official plugin CLI for an empty reconciliation roster", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-empty-roster-"));
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));

    await expect(
      ensureOfficialHarnessInstall({
        dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        dshHome: join(root, "home"),
        nodeExecutable: "/usr/bin/node",
        pnpmEntry: "/resources/node-runtime/pnpm.mjs",
        pnpmStoreDir: "/app-data/node-runtime/pnpm-store",
        runtimeBinRoot: join(root, "app-data", "runtime-bin"),
        integratedPlugins: [],
        legacyPluginSpecs: [],
        runCommand,
      }),
    ).resolves.toEqual({ status: "unchanged", packages: [] });

    expect(runCommand).not.toHaveBeenCalled();
  });

  it("adopts a complete legacy profile without rerunning the plugin CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-legacy-warm-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const packageRoot = await realpath(desktopPlugin);
    const profileRoot = join(dshHome, "profiles", "web");
    const pnpmStoreDir = "/app-data/node-runtime/pnpm-store";
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({
        dependencies: {
          "deepseek-harness-desktop-plugin": `link:${packageRoot}`,
        },
      })}\n`,
    );
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: pnpmStoreDir })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir,
      runtimeBinRoot,
      releaseIdentity: "0.1.0-BETA2-2",
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

    await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
      status: "unchanged",
    });
    expect(runCommand).not.toHaveBeenCalled();
    await expect(
      readFile(
        join(dshHome, ".deepseek-harness-code-plugin-reconciliation.json"),
        "utf8",
      ),
    ).resolves.toContain('"releaseIdentity": "0.1.0-BETA2-2"');
  });

  it("reruns the plugin CLI when an otherwise healthy marker is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-invalid-marker-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const profileRoot = join(dshHome, "profiles", "web");
    const pnpmStoreDir = "/app-data/node-runtime/pnpm-store";
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({
        dependencies: {
          "deepseek-harness-desktop-plugin": `link:${await realpath(desktopPlugin)}`,
        },
      })}\n`,
    );
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: pnpmStoreDir })}\n`,
    );
    await mkdir(dshHome, { recursive: true });
    await writeFile(
      join(dshHome, ".deepseek-harness-code-plugin-reconciliation.json"),
      "{not-json\n",
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir,
      runtimeBinRoot,
      releaseIdentity: "0.1.0-BETA2-2",
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

    await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
      status: "installed",
    });
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it.skipIf(process.platform !== "win32")(
    "treats Windows link separators as equivalent on warm startup",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "dsh-plugin-windows-link-"));
      const dshHome = join(root, "home");
      const runtimeBinRoot = join(root, "app-data", "runtime-bin");
      const desktopPlugin = await createPlugin(
        root,
        "desktop-plugin",
        "deepseek-harness-desktop-plugin",
      );
      const packageRoot = await realpath(desktopPlugin);
      const profileRoot = join(dshHome, "profiles", "web");
      await mkdir(join(profileRoot, "node_modules"), { recursive: true });
      await writeFile(
        join(profileRoot, "package.json"),
        `${JSON.stringify({
          dependencies: {
            "deepseek-harness-desktop-plugin": `link:${packageRoot.replaceAll("\\", "/")}`,
          },
        })}\n`,
      );
      await writeFile(
        join(profileRoot, "node_modules", ".modules.yaml"),
        `${JSON.stringify({ storeDir: "C:/managed/pnpm-store" })}\n`,
      );
      const runCommand = vi.fn<OfficialCommandRunner>(() => ({
        status: 0,
        stdout: "",
        stderr: "",
      }));
      const input = {
        dshEntry: "C:/app/dsh.js",
        dshHome,
        nodeExecutable: "C:/Program Files/nodejs/node.exe",
        pnpmEntry: "C:/app/pnpm.mjs",
        pnpmStoreDir: "C:/managed/pnpm-store",
        runtimeBinRoot,
        releaseIdentity: "0.1.0-test",
        integratedPlugins: [
          {
            packageName: "deepseek-harness-desktop-plugin",
            packageRoot: desktopPlugin,
          },
        ],
        legacyPluginSpecs: [],
        runCommand,
      };

      await ensureOfficialHarnessInstall(input);
      await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
        status: "unchanged",
      });
      expect(runCommand).not.toHaveBeenCalled();
    },
  );

  it("reconciles when the release or package manifest identity changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-release-identity-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const packageRoot = await realpath(desktopPlugin);
    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({
        dependencies: {
          "deepseek-harness-desktop-plugin": `link:${packageRoot}`,
        },
      })}\n`,
    );
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/app/dsh.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: "/managed/pnpm-store",
      runtimeBinRoot,
      releaseIdentity: "0.1.0-test.1",
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    };

    await ensureOfficialHarnessInstall(input);
    const marker = JSON.parse(
      await readFile(
        join(dshHome, ".deepseek-harness-code-plugin-reconciliation.json"),
        "utf8",
      ),
    ) as {
      schemaVersion: number;
      releaseIdentity: string;
      packages: Array<{
        packageName: string;
        manifestVersion: string;
        manifestDigest: string;
        linkOnly: boolean;
      }>;
    };
    expect(marker).toMatchObject({
      schemaVersion: 2,
      releaseIdentity: "0.1.0-test.1",
      packages: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          manifestVersion: "1.0.0",
          linkOnly: false,
        },
      ],
    });
    expect(marker.packages[0]?.manifestDigest).toMatch(/^[a-f0-9]{64}$/u);
    await writeFile(
      join(packageRoot, "package.json"),
      `${JSON.stringify({
        name: "deepseek-harness-desktop-plugin",
        version: "1.0.1",
        dsh: { bundle: { patch: "./cordis.patch.yml" } },
      })}\n`,
    );
    await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
      status: "installed",
    });
    expect(runCommand).toHaveBeenCalledTimes(1);

    const changedReleaseInput = { ...input, releaseIdentity: "0.1.0-test.2" };
    await expect(
      ensureOfficialHarnessInstall(changedReleaseInput),
    ).resolves.toMatchObject({ status: "installed" });
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it("reconciles when linkOnly changes to false and keeps the normal bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-link-only-toggle-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const plugin = await createPlugin(
      root,
      "toggle-plugin",
      "deepseek-harness-toggle-plugin",
    );
    const packageRoot = await realpath(plugin);
    const profileRoot = join(dshHome, "profiles", "web");
    const profilePath = join(profileRoot, "package.json");
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    const writeProfile = async (bundles: string[]) => {
      await writeFile(
        profilePath,
        `${JSON.stringify({
          dependencies: {
            "deepseek-harness-toggle-plugin": `link:${packageRoot}`,
          },
          dsh: { profile: { bundles } },
        })}\n`,
      );
    };
    await writeProfile(["deepseek-harness-toggle-plugin"]);
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const baseInput = {
      dshEntry: "/app/dsh.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: "/managed/pnpm-store",
      runtimeBinRoot,
      releaseIdentity: "0.1.0-test",
      legacyPluginSpecs: [],
      runCommand,
    };

    await ensureOfficialHarnessInstall({
      ...baseInput,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-toggle-plugin",
          packageRoot: plugin,
          linkOnly: true,
        },
      ],
    });
    await writeProfile(["deepseek-harness-toggle-plugin"]);
    const result = await ensureOfficialHarnessInstall({
      ...baseInput,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-toggle-plugin",
          packageRoot: plugin,
          linkOnly: false,
        },
      ],
    });

    expect(result.status).toBe("installed");
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(profilePath, "utf8"))).toMatchObject({
      dsh: { profile: { bundles: ["deepseek-harness-toggle-plugin"] } },
    });
  });

  it("removes only link-only names from bundles after official reconciliation", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-link-only-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const linkOnlyPlugin = await createPlugin(
      root,
      "subagent-codex",
      "@deepseek-ai/dsh-subagent-codex",
    );
    const regularPlugin = await createPlugin(
      root,
      "regular-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    const profile = {
      dependencies: {
        "@deepseek-ai/dsh-subagent-codex": `link:${await realpath(linkOnlyPlugin)}`,
        "deepseek-harness-desktop-plugin": `link:${await realpath(regularPlugin)}`,
        "user-plugin": "user-plugin@1.0.0",
      },
      dsh: {
        profile: {
          bundles: [
            "user-bundle",
            "@deepseek-ai/dsh-subagent-codex",
            "deepseek-harness-desktop-plugin",
          ],
        },
      },
      userField: { preserved: true },
    };
    const profilePath = join(profileRoot, "package.json");
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => {
      mkdirSync(profileRoot, { recursive: true });
      writeFileSync(profilePath, `${JSON.stringify(profile)}\n`);
      return { status: 0, stdout: "", stderr: "" };
    });

    const result = await ensureOfficialHarnessInstall({
      dshEntry: "/app/dsh.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: "/managed/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "@deepseek-ai/dsh-subagent-codex",
          packageRoot: linkOnlyPlugin,
          linkOnly: true,
        },
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: regularPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    });

    expect(result.status).toBe("installed");
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(await readFile(join(profileRoot, "package.json"), "utf8")),
    ).toEqual({
      ...profile,
      dsh: {
        profile: {
          bundles: ["user-bundle", "deepseek-harness-desktop-plugin"],
        },
      },
    });
  });

  it("invalidates a warm marker when a link-only bundle is reintroduced", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-link-only-marker-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const linkOnlyPlugin = await createPlugin(
      root,
      "subagent-codex",
      "@deepseek-ai/dsh-subagent-codex",
    );
    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    const packageRoot = await realpath(linkOnlyPlugin);
    const writeProfile = async (bundles: string[]) => {
      await writeFile(
        join(profileRoot, "package.json"),
        `${JSON.stringify({
          dependencies: {
            "@deepseek-ai/dsh-subagent-codex": `link:${packageRoot}`,
          },
          dsh: { profile: { bundles } },
        })}\n`,
      );
    };
    await writeProfile(["user-bundle"]);
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/app/dsh.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: "/managed/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "@deepseek-ai/dsh-subagent-codex",
          packageRoot: linkOnlyPlugin,
          linkOnly: true,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

    await ensureOfficialHarnessInstall(input);
    await writeProfile(["user-bundle", "@deepseek-ai/dsh-subagent-codex"]);
    const result = await ensureOfficialHarnessInstall(input);

    expect(result.status).toBe("installed");
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(await readFile(join(profileRoot, "package.json"), "utf8")),
    ).toEqual({
      dependencies: {
        "@deepseek-ai/dsh-subagent-codex": `link:${packageRoot}`,
      },
      dsh: { profile: { bundles: ["user-bundle"] } },
    });
  });

  it.each([
    ["missing", "missing"],
    ["malformed", "malformed"],
  ] as const)(
    "treats a %s profile package manifest as marker-invalid but non-fatal",
    async (_label, mutation) => {
      const root = await mkdtemp(
        join(tmpdir(), "dsh-plugin-profile-manifest-"),
      );
      const dshHome = join(root, "home");
      const runtimeBinRoot = join(root, "app-data", "runtime-bin");
      const linkOnlyPlugin = await createPlugin(
        root,
        "subagent-codex",
        "@deepseek-ai/dsh-subagent-codex",
      );
      const packageRoot = await realpath(linkOnlyPlugin);
      const profileRoot = join(dshHome, "profiles", "web");
      const profilePath = join(profileRoot, "package.json");
      await mkdir(join(profileRoot, "node_modules"), { recursive: true });
      await writeFile(
        profilePath,
        `${JSON.stringify({
          dependencies: {
            "@deepseek-ai/dsh-subagent-codex": `link:${packageRoot}`,
          },
          dsh: { profile: { bundles: ["user-bundle"] } },
        })}\n`,
      );
      await writeFile(
        join(profileRoot, "node_modules", ".modules.yaml"),
        `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
      );
      const runCommand = vi.fn<OfficialCommandRunner>(() => ({
        status: 0,
        stdout: "",
        stderr: "",
      }));
      const input = {
        dshEntry: "/app/dsh.js",
        dshHome,
        nodeExecutable: "/usr/bin/node",
        pnpmEntry: "/app/pnpm.mjs",
        pnpmStoreDir: "/managed/pnpm-store",
        runtimeBinRoot,
        integratedPlugins: [
          {
            packageName: "@deepseek-ai/dsh-subagent-codex",
            packageRoot: linkOnlyPlugin,
            linkOnly: true,
          },
        ],
        legacyPluginSpecs: [],
        runCommand,
      } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

      await ensureOfficialHarnessInstall(input);
      if (mutation === "missing") {
        await rm(profilePath);
      } else {
        await writeFile(profilePath, "{not-json");
      }

      await expect(ensureOfficialHarnessInstall(input)).resolves.toMatchObject({
        status: "installed",
      });
      expect(runCommand).toHaveBeenCalledTimes(1);
    },
  );

  it("reconciles again when a managed package identity changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-identity-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const firstPlugin = await createPlugin(
      root,
      "desktop-plugin-v1",
      "deepseek-harness-desktop-plugin",
    );
    const secondPlugin = await createPlugin(
      root,
      "desktop-plugin-v2",
      "deepseek-harness-desktop-plugin",
    );
    await mkdir(join(dshHome, "profiles", "web", "node_modules"), {
      recursive: true,
    });
    await writeFile(
      join(dshHome, "profiles", "web", "package.json"),
      `${JSON.stringify({
        dependencies: {
          "deepseek-harness-desktop-plugin": `link:${await realpath(firstPlugin)}`,
        },
      })}\n`,
    );
    await writeFile(
      join(dshHome, "profiles", "web", "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/app-data/node-runtime/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const baseInput = {
      dshEntry: "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/resources/node-runtime/pnpm.mjs",
      pnpmStoreDir: "/app-data/node-runtime/pnpm-store",
      runtimeBinRoot,
      legacyPluginSpecs: [],
      runCommand,
    };

    await ensureOfficialHarnessInstall({
      ...baseInput,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: firstPlugin,
        },
      ],
    });
    const result = await ensureOfficialHarnessInstall({
      ...baseInput,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: secondPlugin,
        },
      ],
    });

    expect(result.status).toBe("installed");
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing dependency", {}],
    [
      "mismatched dependency",
      { "deepseek-harness-desktop-plugin": "link:/other/plugin" },
    ],
  ] as const)(
    "reruns official reconciliation when the profile has a %s",
    async (_label, dependencies) => {
      const root = await mkdtemp(join(tmpdir(), "dsh-plugin-profile-invalid-"));
      const dshHome = join(root, "home");
      const runtimeBinRoot = join(root, "app-data", "runtime-bin");
      const desktopPlugin = await createPlugin(
        root,
        "desktop-plugin",
        "deepseek-harness-desktop-plugin",
      );
      const packageRoot = await realpath(desktopPlugin);
      const profileRoot = join(dshHome, "profiles", "web");
      await mkdir(join(profileRoot, "node_modules"), { recursive: true });
      await writeFile(
        join(profileRoot, "package.json"),
        `${JSON.stringify({ dependencies: { "deepseek-harness-desktop-plugin": `link:${packageRoot}` } })}\n`,
      );
      await writeFile(
        join(profileRoot, "node_modules", ".modules.yaml"),
        `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
      );
      const runCommand = vi.fn<OfficialCommandRunner>(() => ({
        status: 0,
        stdout: "",
        stderr: "",
      }));
      const input = {
        dshEntry: "/app/dsh.js",
        dshHome,
        nodeExecutable: "/usr/bin/node",
        pnpmEntry: "/app/pnpm.mjs",
        pnpmStoreDir: "/managed/pnpm-store",
        runtimeBinRoot,
        integratedPlugins: [
          {
            packageName: "deepseek-harness-desktop-plugin",
            packageRoot: desktopPlugin,
          },
        ],
        legacyPluginSpecs: [],
        runCommand,
      } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

      await ensureOfficialHarnessInstall(input);
      await writeFile(
        join(profileRoot, "package.json"),
        `${JSON.stringify({ dependencies })}\n`,
      );
      const result = await ensureOfficialHarnessInstall(input);

      expect(result.status).toBe("installed");
      expect(runCommand).toHaveBeenCalledTimes(1);
    },
  );

  it("reruns official reconciliation when the profile uses a foreign pnpm store", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-foreign-store-"));
    const dshHome = join(root, "home");
    const runtimeBinRoot = join(root, "app-data", "runtime-bin");
    const desktopPlugin = await createPlugin(
      root,
      "desktop-plugin",
      "deepseek-harness-desktop-plugin",
    );
    const packageRoot = await realpath(desktopPlugin);
    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(join(profileRoot, "node_modules"), { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({ dependencies: { "deepseek-harness-desktop-plugin": `link:${packageRoot}` } })}\n`,
    );
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/managed/pnpm-store" })}\n`,
    );
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 0,
      stdout: "",
      stderr: "",
    }));
    const input = {
      dshEntry: "/app/dsh.js",
      dshHome,
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: "/managed/pnpm-store",
      runtimeBinRoot,
      integratedPlugins: [
        {
          packageName: "deepseek-harness-desktop-plugin",
          packageRoot: desktopPlugin,
        },
      ],
      legacyPluginSpecs: [],
      runCommand,
    } satisfies Parameters<typeof ensureOfficialHarnessInstall>[0];

    await ensureOfficialHarnessInstall(input);
    await writeFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      `${JSON.stringify({ storeDir: "/foreign/pnpm-store" })}\n`,
    );
    const result = await ensureOfficialHarnessInstall(input);

    expect(result.status).toBe("installed");
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

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
    const modeBoost = await createPlugin(
      root,
      "mode-boost",
      "@dsh-external/dsh-mode-boost",
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
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls.map(([, args]) => args)).toEqual([
      [
        "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "plugin",
        "--profile",
        "web",
        "add",
        "legacy-user-plugin@1.2.3",
        await realpath(desktopPlugin),
        await realpath(modeBoost),
      ],
      [
        "/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "plugin",
        "--profile",
        "web",
        "add",
        "legacy-user-plugin@1.2.3",
        await realpath(desktopPlugin),
        await realpath(modeBoost),
      ],
    ]);
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
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand.mock.calls[0]?.[1]).toEqual([
      "/user-data/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
      "plugin",
      "--profile",
      "web",
      "add",
      "legacy-user-plugin@1.2.3",
      await realpath(desktopPlugin),
      await realpath(modeBoost),
    ]);
    expect(runCommand.mock.calls[0]?.slice(0, 2)).toEqual([
      "/usr/bin/node",
      [
        "/user-data/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "plugin",
        "--profile",
        "web",
        "add",
        "legacy-user-plugin@1.2.3",
        await realpath(desktopPlugin),
        await realpath(modeBoost),
      ],
    ]);
    const options = runCommand.mock.calls[0]?.[2];
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

  it("retries a failed batch once and reports every package with a capped diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-batch-error-"));
    const firstPlugin = await createPlugin(
      root,
      "first-plugin",
      "first-plugin",
    );
    const secondPlugin = await createPlugin(
      root,
      "second-plugin",
      "second-plugin",
    );
    const stderr = "x".repeat(2_100);
    const runCommand = vi.fn<OfficialCommandRunner>(() => ({
      status: 17,
      stdout: "",
      stderr,
    }));

    const errorMessage = await ensureOfficialHarnessInstall({
      dshEntry: "/app/dsh.js",
      dshHome: join(root, "home"),
      nodeExecutable: "/usr/bin/node",
      pnpmEntry: "/app/pnpm.mjs",
      pnpmStoreDir: join(root, "pnpm-store"),
      runtimeBinRoot: join(root, "runtime-bin"),
      integratedPlugins: [
        { packageName: "first-plugin", packageRoot: firstPlugin },
        { packageName: "second-plugin", packageRoot: secondPlugin },
      ],
      legacyPluginSpecs: [],
      runCommand,
    }).then(
      () => "unexpected success",
      (error: unknown) =>
        error instanceof Error ? error.message : String(error),
    );
    expect(errorMessage).toContain(
      "official plugin installation failed for first-plugin, second-plugin (exit 17)",
    );
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(errorMessage.endsWith("x".repeat(2_000))).toBe(true);
    expect(errorMessage).not.toContain("x".repeat(2_001));
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
