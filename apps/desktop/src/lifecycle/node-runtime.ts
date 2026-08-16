import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { get as httpsGet } from "node:https";
import type { IncomingMessage } from "node:http";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

export const NODE_RUNTIME_VERSION = "24.18.0";
const NODE_DIST_BASE_URL = `https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}`;
const MARKER_SCHEMA_VERSION = 1;

export interface PortableNodeArchive {
  platform: NodeJS.Platform;
  arch: string;
  fileName: string;
  url: string;
  sha256: string;
}

const PORTABLE_NODE_ARCHIVES: Record<string, PortableNodeArchive> = {
  "darwin-x64": {
    platform: "darwin",
    arch: "x64",
    fileName: "node-v24.18.0-darwin-x64.tar.gz",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-darwin-x64.tar.gz`,
    sha256: "dfd0dbd3e721503434df7b7205e719f61b3a3a31b2bcf9729b8b91fea240f080",
  },
  "darwin-arm64": {
    platform: "darwin",
    arch: "arm64",
    fileName: "node-v24.18.0-darwin-arm64.tar.gz",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-darwin-arm64.tar.gz`,
    sha256: "e1a97e14c99c803e96c7339403282ea05a499c32f8d83defe9ef5ec66f979ed1",
  },
  "linux-x64": {
    platform: "linux",
    arch: "x64",
    fileName: "node-v24.18.0-linux-x64.tar.gz",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-linux-x64.tar.gz`,
    sha256: "783130984963db7ba9cbd01089eaf2c2efb055c7c1693c943174b967b3050cb8",
  },
  "linux-arm64": {
    platform: "linux",
    arch: "arm64",
    fileName: "node-v24.18.0-linux-arm64.tar.gz",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-linux-arm64.tar.gz`,
    sha256: "6b4484c2190274175df9aa8f28e2d758a819cb1c1fe6ab481e2f95b463ab8508",
  },
  "win32-x64": {
    platform: "win32",
    arch: "x64",
    fileName: "node-v24.18.0-win-x64.zip",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-win-x64.zip`,
    sha256: "0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821",
  },
  "win32-arm64": {
    platform: "win32",
    arch: "arm64",
    fileName: "node-v24.18.0-win-arm64.zip",
    url: `${NODE_DIST_BASE_URL}/node-v24.18.0-win-arm64.zip`,
    sha256: "f274669adb93b1fd0fbf8f21fd078609e9dcc84333d4f2718d2dde3f9a161a01",
  },
};

export function getPortableNodeArchive(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): PortableNodeArchive {
  const archive = PORTABLE_NODE_ARCHIVES[`${platform}-${arch}`];
  if (archive === undefined) {
    throw new Error(
      `No managed Node.js ${NODE_RUNTIME_VERSION} archive for ${platform}/${arch}`,
    );
  }
  return archive;
}

export interface NodeRuntimePaths {
  rootDir: string;
  archivePath: string;
  nodeExecutable: string;
  packagesDir: string;
  dshEntry: string;
  dshFindPluginRoot: string;
  pnpmStoreDir: string;
  markerPath: string;
}

export function resolveNodeRuntimePaths(
  userDataPath: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): NodeRuntimePaths {
  const archive = getPortableNodeArchive(platform, arch);
  const rootDir = join(userDataPath, "node-runtime");
  const extractedRoot = archive.fileName.replace(/\.(?:tar\.gz|zip)$/u, "");
  const extractedDir = join(rootDir, extractedRoot);
  return {
    rootDir,
    archivePath: join(rootDir, archive.fileName),
    nodeExecutable:
      platform === "win32"
        ? join(extractedDir, "node.exe")
        : join(extractedDir, "bin", "node"),
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
    dshFindPluginRoot: join(
      rootDir,
      "packages",
      "node_modules",
      "dsh-find-plugin",
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
  nodeVersion: string;
  lockSha256: string;
  platform: string;
  arch: string;
  installedAt: string;
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
      marker.nodeVersion !== NODE_RUNTIME_VERSION ||
      typeof marker.lockSha256 !== "string" ||
      marker.lockSha256.length !== 64 ||
      typeof marker.platform !== "string" ||
      typeof marker.arch !== "string"
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
  reason?: "node-missing" | "packages-missing" | "marker-missing";
}

export async function inspectNodeRuntime(
  userDataPath: string,
  runtimeResourcePath: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): Promise<NodeRuntimeReadiness> {
  const paths = resolveNodeRuntimePaths(userDataPath, platform, arch);
  const lockSha256 = await sha256File(
    join(runtimeResourcePath, "pnpm-lock.yaml"),
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
  if (!(await pathExists(paths.nodeExecutable))) {
    return { ready: false, lockSha256, reason: "node-missing" };
  }
  if (
    !(await pathExists(paths.dshEntry)) ||
    !(await pathExists(join(paths.dshFindPluginRoot, "package.json")))
  ) {
    return { ready: false, lockSha256, reason: "packages-missing" };
  }
  return { ready: true, lockSha256 };
}

export type DownloadFile = (
  url: string,
  destination: string,
  expectedSha256: string,
) => Promise<void>;

function requestDownload(
  url: string,
  redirectsRemaining: number,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(
      url,
      {
        headers: {
          "User-Agent": `DeepSeek-Harness-Code/${NODE_RUNTIME_VERSION}`,
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (
          status >= 300 &&
          status < 400 &&
          location !== undefined &&
          redirectsRemaining > 0
        ) {
          response.resume();
          resolve(
            requestDownload(
              new URL(location, url).toString(),
              redirectsRemaining - 1,
            ),
          );
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(
            new Error(
              `Node.js download returned HTTP ${status || "unknown"} for ${url}`,
            ),
          );
          return;
        }
        resolve(response);
      },
    );
    request.on("error", reject);
    request.setTimeout(30_000, () => {
      request.destroy(new Error(`Node.js download timed out: ${url}`));
    });
  });
}

export const downloadFile: DownloadFile = async (
  url,
  destination,
  expectedSha256,
) => {
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const partialPath = `${destination}.part`;
  await rm(partialPath, { force: true });
  const response = await requestDownload(url, 5);
  try {
    await pipeline(response, createWriteStream(partialPath, { mode: 0o600 }));
  } finally {
    response.destroy();
  }
  const actualSha256 = await sha256File(partialPath);
  if (actualSha256 !== expectedSha256) {
    await rm(partialPath, { force: true });
    throw new Error(
      `Node.js archive checksum mismatch: expected ${expectedSha256}, received ${actualSha256}`,
    );
  }
  await rm(destination, { force: true });
  await rename(partialPath, destination);
};

export type ExtractArchive = (
  archivePath: string,
  destinationDir: string,
) => Promise<void>;

export const extractArchive: ExtractArchive = async (
  archivePath,
  destinationDir,
) => {
  await mkdir(destinationDir, { recursive: true, mode: 0o700 });
  const result = spawnSync(
    "tar",
    [
      archivePath.endsWith(".zip") ? "-xf" : "-xzf",
      archivePath,
      "-C",
      destinationDir,
    ],
    {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 5 * 60_000,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    const diagnostic =
      result.error?.message ?? String(result.stderr ?? "").slice(0, 2_000);
    throw new Error(`Node.js archive extraction failed: ${diagnostic}`);
  }
};

export type InstallRuntimePackages = (input: {
  nodeExecutable: string;
  pnpmEntry: string;
  paths: NodeRuntimePaths;
}) => Promise<void>;

export const installRuntimePackages: InstallRuntimePackages = async ({
  nodeExecutable,
  pnpmEntry,
  paths,
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
  const result = spawnSync(
    nodeExecutable,
    [
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
    {
      encoding: "utf8",
      env: process.env,
      shell: false,
      windowsHide: true,
      timeout: 15 * 60_000,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    const diagnostic =
      result.error?.message ?? String(result.stderr ?? "").slice(0, 2_000);
    throw new Error(
      `Node.js runtime package installation failed: ${diagnostic}`,
    );
  }
};

export interface EnsureNodeRuntimeInput {
  userDataPath: string;
  runtimeResourcePath: string;
  platform?: NodeJS.Platform;
  arch?: string;
  downloadFile?: DownloadFile;
  extractArchive?: ExtractArchive;
  installRuntimePackages?: InstallRuntimePackages;
}

export interface EnsureNodeRuntimeResult {
  paths: NodeRuntimePaths;
  archive: PortableNodeArchive;
  installed: boolean;
}

export async function ensureNodeRuntime(
  input: EnsureNodeRuntimeInput,
): Promise<EnsureNodeRuntimeResult> {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const archive = getPortableNodeArchive(platform, arch);
  const paths = resolveNodeRuntimePaths(input.userDataPath, platform, arch);
  const lockPath = join(input.runtimeResourcePath, "pnpm-lock.yaml");
  const lockSha256 = await sha256File(lockPath);

  const readiness = await inspectNodeRuntime(
    input.userDataPath,
    input.runtimeResourcePath,
    platform,
    arch,
  );
  if (readiness.ready) {
    return { paths, archive, installed: false };
  }

  await mkdir(paths.rootDir, { recursive: true, mode: 0o700 });
  const download = input.downloadFile ?? downloadFile;
  const extract = input.extractArchive ?? extractArchive;
  const install = input.installRuntimePackages ?? installRuntimePackages;

  let archiveReady = false;
  if (await pathExists(paths.archivePath)) {
    archiveReady = (await sha256File(paths.archivePath)) === archive.sha256;
  }
  if (!archiveReady) {
    await rm(paths.archivePath, { force: true });
    await download(archive.url, paths.archivePath, archive.sha256);
  }
  if (!(await pathExists(paths.nodeExecutable))) {
    await extract(paths.archivePath, paths.rootDir);
  }
  if (!(await pathExists(paths.nodeExecutable))) {
    throw new Error(
      `Downloaded Node.js archive did not contain ${paths.nodeExecutable}`,
    );
  }
  if (platform !== "win32") {
    await chmod(paths.nodeExecutable, 0o755).catch(() => undefined);
  }
  await install({
    nodeExecutable: paths.nodeExecutable,
    pnpmEntry: join(input.runtimeResourcePath, "pnpm.mjs"),
    paths,
  });
  await writeFile(
    paths.markerPath,
    `${JSON.stringify(
      {
        schemaVersion: MARKER_SCHEMA_VERSION,
        nodeVersion: NODE_RUNTIME_VERSION,
        lockSha256,
        platform,
        arch,
        installedAt: new Date().toISOString(),
      },
      undefined,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  // The extracted Node directory is the runtime of record. Removing the
  // verified archive keeps the per-user footprint smaller after install.
  await rm(paths.archivePath, { force: true });
  return { paths, archive, installed: true };
}
