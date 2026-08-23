import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compareNodeVersions,
  isSupportedNodeVersion,
  MINIMUM_NODE_VERSION,
  resolveSystemNode,
  type SystemNodeDeps,
} from "../../apps/desktop/src/lifecycle/system-node.js";

interface FakeFilesystem {
  files: Set<string>;
  dirs: Record<string, string[]>;
  symlinks: Record<string, string>;
  versions?: Record<string, string>;
  nonExecutable?: Set<string>;
  logs: string[];
}

function fakeDeps(fake: FakeFilesystem): Partial<SystemNodeDeps> {
  return {
    fileExists: (path) => fake.files.has(path),
    isExecutable: (path) =>
      fake.files.has(path) && !(fake.nonExecutable?.has(path) ?? false),
    listDir: (path) => fake.dirs[path] ?? [],
    realpath: (path) => fake.symlinks[path] ?? path,
    readVersion: (path) => {
      const resolved = fake.symlinks[path] ?? path;
      return (
        fake.versions?.[path] ??
        resolved.match(/(?:^|[\\/])v?(\d+\.\d+\.\d+)(?:[\\/]|$)/u)?.[1] ??
        "24.0.0"
      );
    },
    log: (message) => {
      fake.logs.push(message);
    },
  };
}

const DARWIN_HOME = "/Users/test";

describe("system Node.js detection", () => {
  it("compares dotted versions numerically", () => {
    expect(compareNodeVersions("22.18.0", MINIMUM_NODE_VERSION)).toBeLessThan(
      0,
    );
    expect(compareNodeVersions("22.19.0", MINIMUM_NODE_VERSION)).toBe(0);
    expect(compareNodeVersions("26.7.0", "24.18.0")).toBeGreaterThan(0);
    expect(compareNodeVersions("v24.1.0", "24.1.5")).toBeLessThan(0);
  });

  it("accepts Node 22.19+ and 24+ while rejecting Node 23", () => {
    expect(isSupportedNodeVersion("22.18.0")).toBe(false);
    expect(isSupportedNodeVersion("22.19.0")).toBe(true);
    expect(isSupportedNodeVersion("22.20.0")).toBe(true);
    expect(isSupportedNodeVersion("23.11.1")).toBe(false);
    expect(isSupportedNodeVersion("24.0.0")).toBe(true);
    expect(isSupportedNodeVersion("26.7.0")).toBe(true);
  });

  it("resolves node from the PATH without version metadata", () => {
    const fake: FakeFilesystem = {
      files: new Set([posix.join("/usr", "bin", "node")]),
      dirs: {},
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "/usr/bin:/bin" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: "/usr/bin/node",
      version: "24.0.0",
      major: 24,
      source: "path",
    });
  });

  it("falls back to Homebrew and derives the version from the Cellar path", () => {
    const brewNode = "/opt/homebrew/bin/node";
    const fake: FakeFilesystem = {
      files: new Set([brewNode]),
      dirs: {},
      symlinks: {
        [brewNode]: "/opt/homebrew/Cellar/node/26.7.0/bin/node",
      },
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: brewNode,
      version: "26.7.0",
      major: 26,
      source: "known-location",
    });
  });

  it("skips below-floor candidates and keeps searching", () => {
    const oldBrewNode = "/opt/homebrew/bin/node";
    const fake: FakeFilesystem = {
      files: new Set([oldBrewNode, posix.join("/usr", "local", "bin", "node")]),
      dirs: {},
      symlinks: {
        [oldBrewNode]: "/opt/homebrew/Cellar/node/20.1.0/bin/node",
      },
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: "/usr/local/bin/node",
      version: "24.0.0",
    });
    expect(fake.logs.join("\n")).toContain(
      "version 20.1.0 is unsupported (requires ^22.19.0 or >=24.0.0)",
    );
  });

  it("prefers the newest nvm installation that is present", () => {
    const nvmDir = posix.join(DARWIN_HOME, ".nvm", "versions", "node");
    const fake: FakeFilesystem = {
      files: new Set([
        posix.join(nvmDir, "v24.2.0", "bin", "node"),
        posix.join(nvmDir, "v20.1.0", "bin", "node"),
      ]),
      dirs: { [nvmDir]: ["v20.1.0", "v22.14.0", "v24.2.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: posix.join(nvmDir, "v24.2.0", "bin", "node"),
      version: "24.2.0",
      major: 24,
      source: "known-location",
    });
  });

  it("skips non-executable candidates on unix", () => {
    const fake: FakeFilesystem = {
      files: new Set([
        posix.join("/opt", "homebrew", "bin", "node"),
        posix.join("/usr", "local", "bin", "node"),
      ]),
      dirs: {},
      symlinks: {},
      nonExecutable: new Set([posix.join("/opt", "homebrew", "bin", "node")]),
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({ executable: "/usr/local/bin/node" });
  });

  it("resolves the Debian legacy nodejs binary on linux", () => {
    const fake: FakeFilesystem = {
      files: new Set(["/usr/bin/nodejs"]),
      dirs: {},
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "linux",
      env: { PATH: "" },
      homeDir: "/home/test",
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({ executable: "/usr/bin/nodejs" });
  });

  it("honors a custom NVM_DIR root", () => {
    const customRoot = posix.join("/custom", "nvm", "versions", "node");
    const fake: FakeFilesystem = {
      files: new Set([posix.join(customRoot, "v26.0.0", "bin", "node")]),
      dirs: { [customRoot]: ["v26.0.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "linux",
      env: { PATH: "", NVM_DIR: "/custom/nvm" },
      homeDir: "/home/test",
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: posix.join(customRoot, "v26.0.0", "bin", "node"),
      version: "26.0.0",
    });
  });

  it("resolves the official Windows install from the PATH", () => {
    const nodeExe = win32.join("C:\\Program Files", "nodejs", "node.exe");
    const fake: FakeFilesystem = {
      files: new Set([nodeExe]),
      dirs: {},
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "win32",
      env: {
        PATH: "C:\\Windows\\System32;C:\\Program Files\\nodejs",
        ProgramFiles: "C:\\Program Files",
      },
      homeDir: "C:\\Users\\test",
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: nodeExe,
      version: "24.0.0",
      major: 24,
      source: "path",
    });
  });

  it("resolves nvm-windows versions under APPDATA", () => {
    const appData = "C:\\Users\\test\\AppData\\Roaming";
    const nvmRoot = win32.join(appData, "nvm");
    const expected = win32.join(nvmRoot, "v24.1.0", "node.exe");
    const fake: FakeFilesystem = {
      files: new Set([expected, win32.join(nvmRoot, "v20.10.0", "node.exe")]),
      dirs: { [nvmRoot]: ["v20.10.0", "v24.1.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "win32",
      env: { PATH: "C:\\Windows\\System32", APPDATA: appData },
      homeDir: "C:\\Users\\test",
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: expected,
      version: "24.1.0",
      major: 24,
      source: "known-location",
    });
  });

  it("resolves fnm installs under the macOS application support directory", () => {
    const fnmRoot = posix.join(
      DARWIN_HOME,
      "Library",
      "Application Support",
      "fnm",
      "node-versions",
    );
    const expected = posix.join(
      fnmRoot,
      "v22.19.0",
      "installation",
      "bin",
      "node",
    );
    const fake: FakeFilesystem = {
      files: new Set([expected]),
      dirs: { [fnmRoot]: ["v22.19.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: expected,
      version: "22.19.0",
      source: "known-location",
    });
  });

  it("returns undefined when nothing usable is installed", () => {
    const fake: FakeFilesystem = {
      files: new Set(),
      dirs: {},
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "/usr/bin:/bin" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toBeUndefined();
  });

  it("ignores a retired app-managed Node under ~/.local/share/dsh-node on macOS", () => {
    const dshNodeDir = posix.join(DARWIN_HOME, ".local", "share", "dsh-node");
    const expected = posix.join(dshNodeDir, "v22.13.0", "bin", "node");
    const fake: FakeFilesystem = {
      files: new Set([expected]),
      dirs: { [dshNodeDir]: ["v22.13.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toBeUndefined();
  });

  it("ignores a retired app-managed Node under %LOCALAPPDATA%\\dsh-node on Windows", () => {
    const localAppData = "C:\\Users\\test\\AppData\\Local";
    const dshNodeDir = win32.join(localAppData, "dsh-node");
    const expected = win32.join(dshNodeDir, "v22.13.0", "node.exe");
    const fake: FakeFilesystem = {
      files: new Set([expected]),
      dirs: { [dshNodeDir]: ["v22.13.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "win32",
      env: { PATH: "C:\\Windows\\System32", LOCALAPPDATA: localAppData },
      homeDir: "C:\\Users\\test",
      ...fakeDeps(fake),
    });
    expect(resolved).toBeUndefined();
  });

  it("prefers a system Node over the app-managed Node", () => {
    const dshNodeDir = posix.join(DARWIN_HOME, ".local", "share", "dsh-node");
    const appManagedNode = posix.join(dshNodeDir, "v22.13.0", "bin", "node");
    const systemNode = posix.join("/opt", "homebrew", "bin", "node");
    const fake: FakeFilesystem = {
      files: new Set([appManagedNode, systemNode]),
      dirs: { [dshNodeDir]: ["v22.13.0"] },
      symlinks: {
        [systemNode]: "/opt/homebrew/Cellar/node/26.7.0/bin/node",
      },
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toMatchObject({
      executable: systemNode,
      version: "26.7.0",
    });
  });

  it("ignores every retired app-managed Node version", () => {
    const dshNodeDir = posix.join(DARWIN_HOME, ".local", "share", "dsh-node");
    const fake: FakeFilesystem = {
      files: new Set([
        posix.join(dshNodeDir, "v22.13.0", "bin", "node"),
        posix.join(dshNodeDir, "v24.5.0", "bin", "node"),
      ]),
      dirs: { [dshNodeDir]: ["v22.13.0", "v24.5.0"] },
      symlinks: {},
      logs: [],
    };
    const resolved = resolveSystemNode({
      platform: "darwin",
      env: { PATH: "" },
      homeDir: DARWIN_HOME,
      ...fakeDeps(fake),
    });
    expect(resolved).toBeUndefined();
  });
});
