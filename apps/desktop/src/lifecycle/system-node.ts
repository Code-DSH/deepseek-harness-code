import {
  accessSync,
  constants as fsConstants,
  existsSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";

// The bundled pnpm launcher (11.19.0) declares `engines: node >=22.13`; the
// pinned Harness packages declare no engine range. Any official Node.js at or
// above this floor works, with no upper bound. Detection is filesystem-only:
// no discovered executable is ever run by this module.
export const MINIMUM_NODE_VERSION = "22.13.0";
export const NODE_DOWNLOAD_PAGE_URL = "https://nodejs.org/en/download";

export type SystemNodeSource = "path" | "known-location";

export interface ResolvedSystemNode {
  executable: string;
  /** Null when the install path carries no version information. */
  version: string | null;
  major: number | null;
  source: SystemNodeSource;
}

export interface SystemNodeDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  fileExists: (path: string) => boolean;
  isExecutable: (path: string) => boolean;
  listDir: (path: string) => string[];
  realpath: (path: string) => string;
  log: (message: string) => void;
}

interface VersionDirProbe {
  dir: string;
  entryPattern: RegExp;
  relative: string[];
}

const VERSION_ENTRY_WITH_V = /^v\d+\.\d+\.\d+$/;
const VERSION_ENTRY_PLAIN = /^\d+\.\d+\.\d+$/;
const VERSION_SEGMENT = /^v?(\d+)\.(\d+)\.(\d+)$/;

// Path handling follows the TARGET platform's semantics (not the host's), so
// detection behaves identically when simulated on any development machine.
function platformPathOf(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix;
}

export function compareNodeVersions(left: string, right: string): number {
  const leftParts = parseNodeVersion(left);
  const rightParts = parseNodeVersion(right);
  if (leftParts === undefined || rightParts === undefined) return 0;
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function parseNodeVersion(value: string): [number, number, number] | undefined {
  const match = value.trim().match(VERSION_SEGMENT);
  if (match === null) return undefined;
  return [
    Number.parseInt(match[1] ?? "0", 10),
    Number.parseInt(match[2] ?? "0", 10),
    Number.parseInt(match[3] ?? "0", 10),
  ];
}

/**
 * Best-effort version discovery from the install path, after resolving
 * symlinks: Homebrew Cellar (`.../Cellar/node/26.7.0/bin/node`), nvm, fnm,
 * mise, n, Volta images, and nvm-windows all encode the version in a path
 * segment. Returns null for plain installs (for example the nodejs.org
 * installer) whose directories carry no version.
 */
function deriveNodeVersion(
  executable: string,
  realpath: (path: string) => string,
): string | null {
  let resolved = executable;
  try {
    resolved = realpath(executable);
  } catch {
    resolved = executable;
  }
  const segments = resolved.split(/[\\/]+/);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index] ?? "";
    if (VERSION_SEGMENT.test(segment)) return segment.replace(/^v/u, "");
  }
  return null;
}

function pathEntries(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): string[] {
  const value = env.PATH ?? env.Path ?? "";
  return value
    .split(platformPathOf(platform).delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function fixedNodeCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
): string[] {
  const { join } = platformPathOf(platform);
  if (platform === "win32") {
    const programFiles = env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 =
      env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const programData = env.ProgramData ?? "C:\\ProgramData";
    const userProfile = env.USERPROFILE ?? homeDir;
    const localAppData =
      env.LOCALAPPDATA ?? join(userProfile, "AppData", "Local");
    return [
      join(programFiles, "nodejs", "node.exe"),
      join(programFilesX86, "nodejs", "node.exe"),
      join(programData, "chocolatey", "bin", "node.exe"),
      join(userProfile, "scoop", "shims", "node.exe"),
      join(userProfile, ".volta", "bin", "node.exe"),
      join(localAppData, ".volta", "bin", "node.exe"),
    ];
  }
  const candidates = [
    join(homeDir, ".volta", "bin", "node"),
    join(homeDir, ".asdf", "shims", "node"),
    join(homeDir, ".local", "bin", "node"),
    join(homeDir, "bin", "node"),
  ];
  if (platform === "darwin") {
    candidates.unshift("/opt/homebrew/bin/node", "/usr/local/bin/node");
  } else {
    candidates.unshift(
      "/usr/local/bin/node",
      "/snap/bin/node",
      "/usr/bin/node",
      "/usr/bin/nodejs",
    );
  }
  return candidates;
}

function versionDirProbes(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
): VersionDirProbe[] {
  const { join } = platformPathOf(platform);
  if (platform === "win32") {
    const appData =
      env.APPDATA ?? join(env.USERPROFILE ?? homeDir, "AppData", "Roaming");
    const localAppData =
      env.LOCALAPPDATA ?? join(env.USERPROFILE ?? homeDir, "AppData", "Local");
    const probes: VersionDirProbe[] = [
      {
        dir: join(appData, "nvm"),
        entryPattern: VERSION_ENTRY_WITH_V,
        relative: ["node.exe"],
      },
      {
        dir: join(appData, "fnm", "node-versions"),
        entryPattern: VERSION_ENTRY_WITH_V,
        relative: ["installation", "node.exe"],
      },
      {
        dir: join(localAppData, "fnm", "node-versions"),
        entryPattern: VERSION_ENTRY_WITH_V,
        relative: ["installation", "node.exe"],
      },
    ];
    if (typeof env.NVM_HOME === "string" && env.NVM_HOME !== "") {
      probes.unshift({
        dir: env.NVM_HOME,
        entryPattern: VERSION_ENTRY_WITH_V,
        relative: ["node.exe"],
      });
    }
    probes.push({
      dir: join(localAppData, "dsh-node"),
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["node.exe"],
    });
    return probes;
  }
  const nvmRoot = join(homeDir, ".nvm", "versions", "node");
  const probes: VersionDirProbe[] = [
    {
      dir: nvmRoot,
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["bin", "node"],
    },
  ];
  if (platform === "darwin") {
    probes.push({
      dir: join(
        homeDir,
        "Library",
        "Application Support",
        "fnm",
        "node-versions",
      ),
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["installation", "bin", "node"],
    });
  }
  probes.push(
    {
      dir: join(homeDir, ".fnm", "node-versions"),
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["installation", "bin", "node"],
    },
    {
      dir: join(homeDir, ".local", "share", "mise", "installs", "node"),
      entryPattern: VERSION_ENTRY_PLAIN,
      relative: ["bin", "node"],
    },
    {
      dir: join(homeDir, ".volta", "tools", "image", "node"),
      entryPattern: VERSION_ENTRY_PLAIN,
      relative: ["bin", "node"],
    },
  );
  if (platform !== "darwin") {
    probes.push({
      dir: "/usr/local/n/versions/node",
      entryPattern: VERSION_ENTRY_PLAIN,
      relative: ["bin", "node"],
    });
  }
  if (typeof env.NVM_DIR === "string" && env.NVM_DIR !== "") {
    probes.push({
      dir: join(env.NVM_DIR, "versions", "node"),
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["bin", "node"],
    });
  }
  if (typeof env.VOLTA_HOME === "string" && env.VOLTA_HOME !== "") {
    probes.push({
      dir: join(env.VOLTA_HOME, "tools", "image", "node"),
      entryPattern: VERSION_ENTRY_PLAIN,
      relative: ["bin", "node"],
    });
  }
  if (typeof env.FNM_DIR === "string" && env.FNM_DIR !== "") {
    probes.push({
      dir: join(env.FNM_DIR, "node-versions"),
      entryPattern: VERSION_ENTRY_WITH_V,
      relative: ["installation", "bin", "node"],
    });
  }
  probes.push({
    dir: join(homeDir, ".local", "share", "dsh-node"),
    entryPattern: VERSION_ENTRY_WITH_V,
    relative: ["bin", "node"],
  });
  return probes;
}

function versionDirCandidates(
  probes: VersionDirProbe[],
  deps: Pick<SystemNodeDeps, "listDir" | "platform">,
): string[] {
  const { join } = platformPathOf(deps.platform);
  const candidates: string[] = [];
  for (const probe of probes) {
    let entries: string[];
    try {
      entries = deps.listDir(probe.dir);
    } catch {
      continue;
    }
    const versions = entries
      .filter((entry) => probe.entryPattern.test(entry))
      .sort((left, right) => compareNodeVersions(left, right))
      .reverse();
    for (const version of versions) {
      candidates.push(join(probe.dir, version, ...probe.relative));
    }
  }
  return candidates;
}

function validateCandidate(
  executable: string,
  source: SystemNodeSource,
  deps: SystemNodeDeps,
): ResolvedSystemNode | undefined {
  if (
    !platformPathOf(deps.platform).isAbsolute(executable) ||
    !deps.fileExists(executable)
  ) {
    return undefined;
  }
  if (deps.platform !== "win32" && !deps.isExecutable(executable)) {
    return undefined;
  }
  const version = deriveNodeVersion(executable, deps.realpath);
  if (
    version !== null &&
    compareNodeVersions(version, MINIMUM_NODE_VERSION) < 0
  ) {
    deps.log(
      `Skipping Node.js candidate ${executable}: version ${version} is older than ${MINIMUM_NODE_VERSION}.`,
    );
    return undefined;
  }
  const major =
    version === null ? null : (parseNodeVersion(version)?.[0] ?? null);
  return { executable, version, major, source };
}

function defaultDeps(overrides: Partial<SystemNodeDeps>): SystemNodeDeps {
  return {
    platform: overrides.platform ?? process.platform,
    env: overrides.env ?? process.env,
    homeDir: overrides.homeDir ?? homedir(),
    fileExists:
      overrides.fileExists ??
      ((path: string) => {
        try {
          return existsSync(path);
        } catch {
          return false;
        }
      }),
    isExecutable:
      overrides.isExecutable ??
      ((path: string) => {
        try {
          accessSync(path, fsConstants.X_OK);
          return true;
        } catch {
          return false;
        }
      }),
    listDir:
      overrides.listDir ??
      ((path: string) => {
        try {
          return readdirSync(path);
        } catch {
          return [];
        }
      }),
    realpath: overrides.realpath ?? ((path: string) => realpathSync(path)),
    log: overrides.log ?? ((message) => process.stderr.write(`${message}\n`)),
  };
}

/**
 * Locate a system-installed Node.js without executing anything. Detection
 * order: the PATH, then common install locations (nodejs.org installer,
 * Homebrew, nvm, Volta, fnm, mise, n, Scoop, nvm-windows, Chocolatey), with
 * version-manager roots overridable through NVM_DIR / VOLTA_HOME / FNM_DIR
 * environment variables. Version-manager directories always prefer the newest
 * installed version. Candidates whose path encodes a version below
 * MINIMUM_NODE_VERSION are skipped; a node that is present but actually broken
 * surfaces later through the guarded package-install and Harness startup
 * flows, which offer recovery instead of silent failure.
 */
export function resolveSystemNode(
  overrides: Partial<SystemNodeDeps> = {},
): ResolvedSystemNode | undefined {
  const deps = defaultDeps(overrides);
  const { join } = platformPathOf(deps.platform);

  const nodeName = deps.platform === "win32" ? "node.exe" : "node";
  for (const dir of pathEntries(deps.env, deps.platform)) {
    const resolved = validateCandidate(join(dir, nodeName), "path", deps);
    if (resolved !== undefined) return resolved;
  }

  const knownCandidates = [
    ...fixedNodeCandidates(deps.platform, deps.env, deps.homeDir),
    ...versionDirCandidates(
      versionDirProbes(deps.platform, deps.env, deps.homeDir),
      deps,
    ),
  ];
  const seen = new Set<string>();
  for (const candidate of knownCandidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const resolved = validateCandidate(candidate, "known-location", deps);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}
