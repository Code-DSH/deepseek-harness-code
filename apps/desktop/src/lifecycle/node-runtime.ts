import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, delimiter, dirname, join } from "node:path";
import type { ResolvedSystemNode } from "./system-node.js";
import { runAsyncCommand } from "./async-command.js";
import { redactStartupDiagnostic } from "./startup-diagnostics.js";

const MARKER_SCHEMA_VERSION = 2;

export interface NodeRuntimePaths {
  rootDir: string;
  packagesDir: string;
  dshEntry: string;
  dshBetterSidebarRoot: string;
  dshFindPluginRoot: string;
  dshVisionRouterRoot: string;
  dshSuperpowersRoot: string;
  deepseekHarnessCompositionRoot: string;
  serverEverythingRoot: string;
  pnpmStoreDir: string;
  markerPath: string;
}

export function resolveNodeRuntimePaths(
  userDataPath: string,
): NodeRuntimePaths {
  const rootDir = join(userDataPath, "node-runtime");
  return {
    rootDir,
    packagesDir: join(rootDir, "packages"),
    dshEntry: join(
      rootDir,
      "packages",
      "node_modules",
      "@deepseek-ai",
      "dsh",
      "lib",
      "bin.js",
    ),
    dshBetterSidebarRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "dsh-better-sidebar",
    ),
    dshFindPluginRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "dsh-find-plugin",
    ),
    dshVisionRouterRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "dsh-vision-router",
    ),
    dshSuperpowersRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "dsh-superpowers",
    ),
    deepseekHarnessCompositionRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "deepseek-harness-composition",
    ),
    serverEverythingRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "@modelcontextprotocol",
      "server-everything",
    ),
    pnpmStoreDir: join(rootDir, "pnpm-store"),
    markerPath: join(rootDir, "runtime.json"),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

interface RuntimeMarker {
  schemaVersion: number;
  lockSha256: string;
  platform: string;
  arch: string;
  installedAt: string;
  nodePath?: string;
  nodeVersion?: string | null;
  nodeMajor?: number | null;
}

async function readRuntimeMarker(
  markerPath: string,
): Promise<RuntimeMarker | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(markerPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const marker = parsed as Partial<RuntimeMarker>;
    if (
      marker.schemaVersion !== MARKER_SCHEMA_VERSION ||
      typeof marker.lockSha256 !== "string" ||
      marker.lockSha256.length !== 64 ||
      typeof marker.platform !== "string" ||
      typeof marker.arch !== "string" ||
      (marker.nodeMajor !== undefined &&
        marker.nodeMajor !== null &&
        typeof marker.nodeMajor !== "number")
    ) {
      return undefined;
    }
    return marker as RuntimeMarker;
  } catch {
    return undefined;
  }
}

export interface NodeRuntimeReadiness {
  ready: boolean;
  lockSha256?: string;
  reason?: "marker-missing" | "packages-missing" | "node-changed";
}

export interface InspectNodeRuntimeInput {
  userDataPath: string;
  runtimeResourcePath: string;
  systemNode: ResolvedSystemNode;
  platform?: NodeJS.Platform;
  arch?: string;
}

export async function inspectNodeRuntime(
  input: InspectNodeRuntimeInput,
): Promise<NodeRuntimeReadiness> {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const paths = resolveNodeRuntimePaths(input.userDataPath);
  const lockSha256 = await sha256File(
    join(input.runtimeResourcePath, "pnpm-lock.yaml"),
  );
  const marker = await readRuntimeMarker(paths.markerPath);
  if (
    marker === undefined ||
    marker.platform !== platform ||
    marker.arch !== arch ||
    marker.lockSha256 !== lockSha256
  ) {
    return { ready: false, lockSha256, reason: "marker-missing" };
  }
  // A different Node major version can invalidate native modules installed by
  // the previous major; reinstall to stay on the safe side.
  if (
    marker.nodeMajor !== undefined &&
    marker.nodeMajor !== null &&
    input.systemNode.major !== null &&
    marker.nodeMajor !== input.systemNode.major
  ) {
    return { ready: false, lockSha256, reason: "node-changed" };
  }
  if (
    !(await pathExists(paths.dshEntry)) ||
    !(await pathExists(join(paths.dshFindPluginRoot, "package.json")))
  ) {
    return { ready: false, lockSha256, reason: "packages-missing" };
  }
  return { ready: true, lockSha256 };
}

// Native-module postinstall scripts (koffi, node-pty) invoke `node` by name.
// A GUI launch inherits a minimal PATH without the system Node, so expose the
// resolved Node's directory to install children explicitly.
export function childEnvWithNodeOnPath(
  nodeExecutable: string,
): NodeJS.ProcessEnv {
  const nodeBinDir = dirname(nodeExecutable);
  const existingPath = process.env.PATH ?? process.env.Path ?? "";
  return {
    ...process.env,
    PATH: [nodeBinDir, existingPath]
      .filter((entry) => entry !== "")
      .join(delimiter),
  };
}

export interface InstallRuntimePackagesInput {
  nodeExecutable: string;
  pnpmEntry: string;
  paths: NodeRuntimePaths;
  runCommand?: typeof runAsyncCommand;
}

export type InstallRuntimePackages = (
  input: InstallRuntimePackagesInput,
) => Promise<void>;

function isRuntimeResourcePath(source: string): boolean {
  return basename(source) !== ".mimosa";
}

export const installRuntimePackages: InstallRuntimePackages = async ({
  nodeExecutable,
  pnpmEntry,
  paths,
  runCommand = runAsyncCommand,
}) => {
  const runtimeResourceDir = dirname(pnpmEntry);
  await mkdir(paths.packagesDir, { recursive: true, mode: 0o700 });
  await copyFile(
    join(runtimeResourceDir, "package.json"),
    join(paths.packagesDir, "package.json"),
  );
  await copyFile(
    join(runtimeResourceDir, "pnpm-lock.yaml"),
    join(paths.packagesDir, "pnpm-lock.yaml"),
  );
  // pnpm resolves allowBuilds and the maintained-family overrides from the
  // workspace file; without it the frozen install could consult the registry
  // for transitive DSH family dependencies.
  await copyFile(
    join(runtimeResourceDir, "pnpm-workspace.yaml"),
    join(paths.packagesDir, "pnpm-workspace.yaml"),
  );
  // Every file: dependency, including the complete maintained DSH family,
  // must sit next to the copied manifest for a reproducible frozen install.
  await rm(join(paths.packagesDir, "vendor", ".mimosa"), {
    recursive: true,
    force: true,
  });
  await cp(
    join(runtimeResourceDir, "vendor"),
    join(paths.packagesDir, "vendor"),
    { recursive: true, filter: isRuntimeResourcePath },
  ).catch(() => undefined);
  const result = await runCommand({
    command: nodeExecutable,
    args: [
      pnpmEntry,
      "install",
      "--dir",
      paths.packagesDir,
      "--frozen-lockfile",
      "--prod",
      "--store-dir",
      paths.pnpmStoreDir,
      "--reporter=append-only",
    ],
    env: childEnvWithNodeOnPath(nodeExecutable),
    timeoutMs: 15 * 60_000,
  });
  if (result.error !== undefined || result.status !== 0) {
    const output = [result.stderr, result.stdout]
      .filter((value) => value.trim() !== "")
      .join("\n")
      .slice(-2_000);
    const diagnostic = redactStartupDiagnostic(
      result.error?.message ??
        (output === ""
          ? `installer exited with status ${String(result.status)}`
          : output),
    );
    throw new Error(
      `Node.js runtime package installation failed: ${diagnostic}`,
    );
  }
};

export interface EnsureRuntimePackagesInput {
  userDataPath: string;
  runtimeResourcePath: string;
  systemNode: ResolvedSystemNode;
  platform?: NodeJS.Platform;
  arch?: string;
  installRuntimePackages?: InstallRuntimePackages;
  onInstallStart?: () => void | Promise<void>;
}

export interface EnsureRuntimePackagesResult {
  paths: NodeRuntimePaths;
  installed: boolean;
}

// Remove leftovers from the retired portable-runtime design: extracted
// `node-v<version>-<platform>-<arch>` directories and downloaded archives.
async function cleanupLegacyPortableNode(rootDir: string): Promise<void> {
  try {
    const entries = await readdir(rootDir);
    for (const entry of entries) {
      if (
        !/^node-v\d+\.\d+\.\d+-/u.test(entry) &&
        !/\.(?:tar\.gz|zip)$/u.test(entry)
      ) {
        continue;
      }
      await rm(join(rootDir, entry), { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  } catch {
    // Best effort: a failed cleanup never blocks startup.
  }
}

export async function ensureRuntimePackages(
  input: EnsureRuntimePackagesInput,
): Promise<EnsureRuntimePackagesResult> {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const paths = resolveNodeRuntimePaths(input.userDataPath);
  const lockSha256 = await sha256File(
    join(input.runtimeResourcePath, "pnpm-lock.yaml"),
  );

  const readiness = await inspectNodeRuntime({
    userDataPath: input.userDataPath,
    runtimeResourcePath: input.runtimeResourcePath,
    systemNode: input.systemNode,
    platform,
    arch,
  });
  if (readiness.ready) {
    return { paths, installed: false };
  }

  await mkdir(paths.rootDir, { recursive: true, mode: 0o700 });
  const install = input.installRuntimePackages ?? installRuntimePackages;
  await input.onInstallStart?.();
  await install({
    nodeExecutable: input.systemNode.executable,
    pnpmEntry: join(input.runtimeResourcePath, "pnpm.mjs"),
    paths,
  });
  await writeFile(
    paths.markerPath,
    `${JSON.stringify(
      {
        schemaVersion: MARKER_SCHEMA_VERSION,
        lockSha256,
        platform,
        arch,
        installedAt: new Date().toISOString(),
        nodePath: input.systemNode.executable,
        nodeVersion: input.systemNode.version,
        nodeMajor: input.systemNode.major,
      },
      undefined,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await cleanupLegacyPortableNode(paths.rootDir);
  return { paths, installed: true };
}
