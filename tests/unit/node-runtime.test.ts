import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureRuntimePackages,
  inspectNodeRuntime,
  installRuntimePackages,
  resolveNodeRuntimePaths,
  sha256File,
} from "../../apps/desktop/src/lifecycle/node-runtime.js";
import { runAsyncCommand } from "../../apps/desktop/src/lifecycle/async-command.js";
import type { ResolvedSystemNode } from "../../apps/desktop/src/lifecycle/system-node.js";

function systemNode(
  overrides: Partial<ResolvedSystemNode> = {},
): ResolvedSystemNode {
  return {
    executable: "/usr/bin/node",
    version: "24.18.0",
    major: 24,
    source: "known-location",
    ...overrides,
  };
}

async function createRuntimeResource(root: string): Promise<string> {
  const resource = join(root, "resource");
  await mkdir(resource, { recursive: true });
  await writeFile(join(resource, "pnpm-lock.yaml"), "lockfile-v1\n");
  await writeFile(
    join(resource, "package.json"),
    `${JSON.stringify({
      dependencies: {
        "@deepseek-ai/dsh": "0.1.0-rc.6",
        "dsh-find-plugin": "0.3.6",
      },
    })}\n`,
  );
  return resource;
}

async function createInstalledPackages(paths: {
  dshEntry: string;
  dshFindPluginRoot: string;
}): Promise<void> {
  await mkdir(join(paths.dshEntry, ".."), { recursive: true });
  await mkdir(paths.dshFindPluginRoot, { recursive: true });
  await writeFile(paths.dshEntry, "dsh\n");
  await writeFile(join(paths.dshFindPluginRoot, "package.json"), "{}\n");
}

describe("pinned runtime packages driven by the system Node", () => {
  it("runs the package installer without blocking the Electron event loop", async () => {
    let settled = false;
    const install = runAsyncCommand({
      command: process.execPath,
      args: ["-e", "setTimeout(() => process.exit(0), 200)"],
      env: process.env,
      timeoutMs: 1_000,
    });
    void install.then(() => {
      settled = true;
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    await expect(install).resolves.toMatchObject({ status: 0, stderr: "" });
  });

  it("does not copy local Mimosa session state into the installed runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-stage-"));
    const resource = join(root, "resource");
    const paths = resolveNodeRuntimePaths(join(root, "user-data"));
    await mkdir(join(resource, "vendor", ".mimosa", "hook-state"), {
      recursive: true,
    });
    await writeFile(join(resource, "package.json"), "{}\n");
    await writeFile(
      join(resource, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'\n",
    );
    await writeFile(join(resource, "pnpm-workspace.yaml"), "packages: []\n");
    await writeFile(join(resource, "pnpm.mjs"), "process.exit(0);\n");
    await writeFile(join(resource, "vendor", "plugin.tgz"), "plugin\n");
    await writeFile(
      join(resource, "vendor", ".mimosa", "hook-state", "sess_test.json"),
      "{}\n",
    );
    await mkdir(join(paths.packagesDir, "vendor", ".mimosa"), {
      recursive: true,
    });
    await writeFile(
      join(paths.packagesDir, "vendor", ".mimosa", "stale.json"),
      "{}\n",
    );

    await installRuntimePackages({
      nodeExecutable: process.execPath,
      pnpmEntry: join(resource, "pnpm.mjs"),
      paths,
    });

    await expect(
      access(join(paths.packagesDir, "vendor", "plugin.tgz")),
    ).resolves.not.toThrow();
    await expect(
      access(join(paths.packagesDir, "vendor", ".mimosa")),
    ).rejects.toThrow();
  });

  it("surfaces redacted installer stdout when a package install fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-diagnostic-"));
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(join(root, "user-data"));
    await writeFile(join(resource, "pnpm-workspace.yaml"), "packages: []\n");
    const runCommand = vi.fn<typeof runAsyncCommand>(async () => ({
      status: 1,
      stdout: "ERR_PNPM_TARBALL_INTEGRITY token=must-not-leak",
      stderr: "",
    }));

    try {
      const failure = await installRuntimePackages({
        nodeExecutable: process.execPath,
        pnpmEntry: join(resource, "pnpm.mjs"),
        paths,
        runCommand,
      }).then(
        () => new Error("expected package installation to fail"),
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(Error);
      const message = (failure as Error).message;
      expect(message).toContain("ERR_PNPM_TARBALL_INTEGRITY");
      expect(message).toContain("token=[REDACTED]");
      expect(message).not.toContain("must-not-leak");
      expect(runCommand.mock.calls[0]?.[0].args).toContain(
        "--config.confirmModulesPurge=false",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves the packages layout under user data", () => {
    const paths = resolveNodeRuntimePaths("/user-data");
    expect(paths.rootDir).toBe(join("/user-data", "node-runtime"));
    expect(paths.packagesDir).toBe(join(paths.rootDir, "packages"));
    expect(paths.dshEntry).toBe(
      join(
        paths.packagesDir,
        "node_modules",
        "@deepseek-ai",
        "dsh",
        "lib",
        "bin.js",
      ),
    );
    expect(paths.dshFindPluginRoot).toBe(
      join(paths.packagesDir, "node_modules", "dsh-find-plugin"),
    );
    expect(paths.markerPath).toBe(join(paths.rootDir, "runtime.json"));
  });

  it("reports readiness only when the marker, node major, and packages match", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-ready-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const lockSha256 = await sha256File(join(resource, "pnpm-lock.yaml"));
    await createInstalledPackages(paths);
    await writeFile(
      paths.markerPath,
      `${JSON.stringify({
        schemaVersion: 2,
        lockSha256,
        platform: "darwin",
        arch: "x64",
        installedAt: "now",
        nodePath: "/usr/bin/node",
        nodeVersion: "24.18.0",
        nodeMajor: 24,
      })}\n`,
    );
    const input = {
      userDataPath: userData,
      runtimeResourcePath: resource,
      platform: "darwin" as const,
      arch: "x64",
    };

    await expect(
      inspectNodeRuntime({ ...input, systemNode: systemNode() }),
    ).resolves.toEqual({ ready: true, lockSha256 });

    await writeFile(join(resource, "pnpm-lock.yaml"), "changed\n");
    await expect(
      inspectNodeRuntime({ ...input, systemNode: systemNode() }),
    ).resolves.toMatchObject({ ready: false, reason: "marker-missing" });

    await writeFile(join(resource, "pnpm-lock.yaml"), "lockfile-v1\n");
    await expect(
      inspectNodeRuntime({ ...input, systemNode: systemNode({ major: 26 }) }),
    ).resolves.toMatchObject({ ready: false, reason: "node-changed" });

    await rm(paths.dshEntry, { force: true });
    await expect(
      inspectNodeRuntime({ ...input, systemNode: systemNode() }),
    ).resolves.toMatchObject({ ready: false, reason: "packages-missing" });
  });

  it("rejects legacy portable-runtime markers as not ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-legacy-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const lockSha256 = await sha256File(join(resource, "pnpm-lock.yaml"));
    await createInstalledPackages(paths);
    await writeFile(
      paths.markerPath,
      `${JSON.stringify({
        schemaVersion: 1,
        nodeVersion: "24.18.0",
        lockSha256,
        platform: "darwin",
        arch: "x64",
        installedAt: "now",
      })}\n`,
    );
    await expect(
      inspectNodeRuntime({
        userDataPath: userData,
        runtimeResourcePath: resource,
        systemNode: systemNode(),
        platform: "darwin",
        arch: "x64",
      }),
    ).resolves.toMatchObject({ ready: false, reason: "marker-missing" });
  });

  it("installs pinned packages once with the system Node and reuses them", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-install-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const install = vi.fn(async () => {
      await createInstalledPackages(paths);
    });
    const onInstallStart = vi.fn();

    const first = await ensureRuntimePackages({
      userDataPath: userData,
      runtimeResourcePath: resource,
      systemNode: systemNode(),
      platform: "darwin",
      arch: "x64",
      installRuntimePackages: install,
      onInstallStart,
    });

    expect(first).toMatchObject({ installed: true, paths });
    expect(install).toHaveBeenCalledTimes(1);
    expect(onInstallStart).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeExecutable: "/usr/bin/node",
        pnpmEntry: join(resource, "pnpm.mjs"),
        paths,
      }),
    );
    const marker = JSON.parse(await readFile(paths.markerPath, "utf8")) as {
      schemaVersion: number;
      nodePath: string;
      nodeMajor: number;
    };
    expect(marker).toMatchObject({
      schemaVersion: 2,
      nodePath: "/usr/bin/node",
      nodeMajor: 24,
    });

    const second = await ensureRuntimePackages({
      userDataPath: userData,
      runtimeResourcePath: resource,
      systemNode: systemNode(),
      platform: "darwin",
      arch: "x64",
      installRuntimePackages: install,
      onInstallStart,
    });
    expect(second.installed).toBe(false);
    expect(install).toHaveBeenCalledTimes(1);
    expect(onInstallStart).toHaveBeenCalledTimes(1);
  });

  it("reinstalls when the system Node major version changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-major-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const install = vi.fn(async () => {
      await createInstalledPackages(paths);
    });
    const base = {
      userDataPath: userData,
      runtimeResourcePath: resource,
      platform: "darwin" as const,
      arch: "x64",
      installRuntimePackages: install,
    };

    await ensureRuntimePackages({ ...base, systemNode: systemNode() });
    const afterUpgrade = await ensureRuntimePackages({
      ...base,
      systemNode: systemNode({
        executable: "/opt/homebrew/bin/node",
        version: "26.7.0",
        major: 26,
      }),
    });
    expect(afterUpgrade.installed).toBe(true);
    expect(install).toHaveBeenCalledTimes(2);
  });

  it("clears stale package-manager output before reinstalling", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-reinstall-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const install = vi.fn(async () => {
      await createInstalledPackages(paths);
    });
    const base = {
      userDataPath: userData,
      runtimeResourcePath: resource,
      platform: "darwin" as const,
      arch: "x64",
      installRuntimePackages: install,
    };

    await ensureRuntimePackages({ ...base, systemNode: systemNode() });
    const stalePath = join(paths.packagesDir, "node_modules", "stale.txt");
    await writeFile(stalePath, "stale\n");
    const reinstall = vi.fn(async () => {
      await expect(access(stalePath)).rejects.toThrow();
      await createInstalledPackages(paths);
    });

    await ensureRuntimePackages({
      ...base,
      systemNode: systemNode({ major: 26, version: "26.7.0" }),
      installRuntimePackages: reinstall,
    });

    expect(reinstall).toHaveBeenCalledOnce();
  });

  it("removes legacy portable-runtime artifacts after install", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-cleanup-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData);
    const legacyDir = join(paths.rootDir, "node-v24.18.0-darwin-x64", "bin");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, "node"), "legacy\n");
    const legacyArchive = join(
      paths.rootDir,
      "node-v24.18.0-darwin-x64.tar.gz",
    );
    await writeFile(legacyArchive, "archive\n");
    const install = vi.fn(async () => {
      await createInstalledPackages(paths);
    });

    await ensureRuntimePackages({
      userDataPath: userData,
      runtimeResourcePath: resource,
      systemNode: systemNode(),
      platform: "darwin",
      arch: "x64",
      installRuntimePackages: install,
    });

    await expect(access(legacyDir)).rejects.toThrow();
    await expect(access(legacyArchive)).rejects.toThrow();
    await expect(access(paths.markerPath)).resolves.not.toThrow();
  });
});
