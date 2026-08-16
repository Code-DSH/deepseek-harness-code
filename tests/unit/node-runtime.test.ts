import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureNodeRuntime,
  getPortableNodeArchive,
  inspectNodeRuntime,
  NODE_RUNTIME_VERSION,
  resolveNodeRuntimePaths,
  sha256File,
} from "../../apps/desktop/src/lifecycle/node-runtime.js";

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

describe("managed portable Node runtime", () => {
  it("pins every supported desktop platform and architecture archive", () => {
    const expected = [
      "darwin-x64",
      "darwin-arm64",
      "linux-x64",
      "linux-arm64",
      "win32-x64",
      "win32-arm64",
    ];

    for (const [platform, arch] of expected.map((key) => key.split("-"))) {
      const archive = getPortableNodeArchive(
        platform as NodeJS.Platform,
        arch ?? "",
      );
      expect(archive.platform).toBe(platform);
      expect(archive.arch).toBe(arch);
      expect(archive.url).toContain(`node-v${NODE_RUNTIME_VERSION}-`);
      expect(archive.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("resolves platform-specific executables under user data", () => {
    const darwin = resolveNodeRuntimePaths("/user-data", "darwin", "arm64");
    expect(darwin.nodeExecutable).toBe(
      join(
        "/user-data",
        "node-runtime",
        "node-v24.18.0-darwin-arm64",
        "bin",
        "node",
      ),
    );
    expect(darwin.dshEntry).toContain(
      join("node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    );

    const windows = resolveNodeRuntimePaths("/user-data", "win32", "x64");
    expect(windows.nodeExecutable).toBe(
      join("/user-data", "node-runtime", "node-v24.18.0-win-x64", "node.exe"),
    );
  });

  it("rejects platforms without a managed Node archive", () => {
    expect(() =>
      getPortableNodeArchive("freebsd" as NodeJS.Platform, "x64"),
    ).toThrow("No managed Node.js");
  });

  it("reports readiness only when the marker, node, and pinned packages match", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-ready-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData, "darwin", "x64");
    const lockSha256 = await sha256File(join(resource, "pnpm-lock.yaml"));
    await mkdir(
      join(paths.packagesDir, "node_modules", "@deepseek-ai", "dsh", "lib"),
      {
        recursive: true,
      },
    );
    await mkdir(join(paths.dshFindPluginRoot), { recursive: true });
    await writeFile(paths.dshEntry, "dsh\n");
    await writeFile(join(paths.dshFindPluginRoot, "package.json"), "{}\n");
    await mkdir(join(paths.nodeExecutable, ".."), { recursive: true });
    await writeFile(paths.nodeExecutable, "node\n");
    await writeFile(
      paths.markerPath,
      `${JSON.stringify({
        schemaVersion: 1,
        nodeVersion: NODE_RUNTIME_VERSION,
        lockSha256,
        platform: "darwin",
        arch: "x64",
        installedAt: "now",
      })}\n`,
    );

    await expect(
      inspectNodeRuntime(userData, resource, "darwin", "x64"),
    ).resolves.toEqual({ ready: true, lockSha256 });

    await writeFile(join(resource, "pnpm-lock.yaml"), "changed\n");
    await expect(
      inspectNodeRuntime(userData, resource, "darwin", "x64"),
    ).resolves.toMatchObject({ ready: false, reason: "marker-missing" });
  });

  it("downloads, extracts, installs, marks, and reuses the runtime once", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-node-install-"));
    const userData = join(root, "user-data");
    const resource = await createRuntimeResource(root);
    const paths = resolveNodeRuntimePaths(userData, "darwin", "x64");
    const download = vi.fn(async (_url: string, destination: string) => {
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, "archive\n");
    });
    const extract = vi.fn(async () => {
      await mkdir(join(paths.nodeExecutable, ".."), { recursive: true });
      await writeFile(paths.nodeExecutable, "node\n");
    });
    const install = vi.fn(async () => {
      await mkdir(
        join(paths.packagesDir, "node_modules", "@deepseek-ai", "dsh", "lib"),
        {
          recursive: true,
        },
      );
      await mkdir(paths.dshFindPluginRoot, { recursive: true });
      await writeFile(paths.dshEntry, "dsh\n");
      await writeFile(join(paths.dshFindPluginRoot, "package.json"), "{}\n");
    });

    const first = await ensureNodeRuntime({
      userDataPath: userData,
      runtimeResourcePath: resource,
      platform: "darwin",
      arch: "x64",
      downloadFile: download,
      extractArchive: extract,
      installRuntimePackages: install,
    });

    expect(first).toMatchObject({ installed: true, archive: { arch: "x64" } });
    expect(download).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeExecutable: paths.nodeExecutable,
        pnpmEntry: join(resource, "pnpm.mjs"),
        paths,
      }),
    );
    await expect(access(paths.archivePath)).rejects.toThrow();
    const marker = JSON.parse(await readFile(paths.markerPath, "utf8")) as {
      nodeVersion: string;
    };
    expect(marker.nodeVersion).toBe(NODE_RUNTIME_VERSION);

    const second = await ensureNodeRuntime({
      userDataPath: userData,
      runtimeResourcePath: resource,
      platform: "darwin",
      arch: "x64",
      downloadFile: download,
      extractArchive: extract,
      installRuntimePackages: install,
    });
    expect(second.installed).toBe(false);
    expect(download).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
  });
});
