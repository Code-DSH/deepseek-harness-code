import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Best-effort runtime refresh of the dsh-routing-suite snapshot.
 *
 * The desktop app ships an offline snapshot (build/routing-suite, fetched by
 * scripts/fetch-routing-suite.mjs). On startup the host fires this refresh in
 * the background: when the network is available it downloads the latest
 * router preset (dsh-router-standard main) plus the pinned release tarballs
 * for the injector and mode-boost, verifies them, and atomically replaces the
 * user-level cache. The next startup prefers the cache over the bundled
 * snapshot, so "auto-pull and install" happens without any manual step.
 *
 * Every failure is silent and non-fatal: the bundled snapshot remains the
 * fallback, and Harness startup never waits on the network.
 */

const CACHE_DIRECTORY = "routing-suite-cache";
const VERSIONS_FILE = "versions.json";
const LAST_CHECK_FILE = ".last-check.json";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

type PackageUpdateSource = {
  id: "injector" | "mode-boost";
  fileName: string;
  url: string;
  target: string;
  strip: string;
};

type PresetUpdateSource = {
  id: "router-preset";
  fileName: string;
  url: string;
  target: string;
  archiveRoot: string;
};

type UpdateSource = PackageUpdateSource | PresetUpdateSource;

const UPDATE_SOURCES: UpdateSource[] = [
  {
    id: "injector",
    fileName: "dsh-external-dsh-super-injector-0.3.3.tgz",
    url: "https://github.com/yjh051108/dsh-super-injector/releases/download/v0.3.3/dsh-external-dsh-super-injector-0.3.3.tgz",
    target: "injector",
    strip: "package",
  },
  {
    id: "mode-boost",
    fileName: "dsh-external-dsh-mode-boost-0.1.0.tgz",
    url: "https://github.com/yjh051108/dsh-mode-boost/releases/download/v0.1.0/dsh-external-dsh-mode-boost-0.1.0.tgz",
    target: "mode-boost",
    strip: "package",
  },
  {
    id: "router-preset",
    fileName: "dsh-router-standard-main.tar.gz",
    url: "https://github.com/yjh051108/dsh-router-standard/archive/refs/heads/main.tar.gz",
    target: "preset",
    archiveRoot: "dsh-router-standard-main",
  },
];

function sha256Of(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function copyTree(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const sourcePath = join(from, entry.name);
    const targetPath = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(sourcePath, targetPath);
    else if (entry.isFile())
      await writeFile(targetPath, await readFile(sourcePath), { mode: 0o600 });
  }
}

async function download(url: string, destination: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`routing-suite-update: ${url} -> HTTP ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(join(destination, ".."), { recursive: true });
  await writeFile(destination, body);
  return body;
}

/** Extract a tarball and keep only the subtree at `strip`, re-rooted at destination. */
async function extractTarball(
  archive: string,
  destination: string,
  strip: string,
): Promise<void> {
  const staging = `${archive}.extract`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    execFileSync("tar", ["-xzf", archive, "-C", staging], { stdio: "ignore" });
    const source = join(staging, strip);
    if (!(await isDirectory(source))) {
      throw new Error(`routing-suite-update: ${archive} has no ${strip}`);
    }
    await rm(destination, { recursive: true, force: true });
    await copyTree(source, destination);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function assemblePackage(
  source: PackageUpdateSource,
  archive: string,
  destination: string,
): Promise<string> {
  await extractTarball(archive, destination, source.strip);
  return source.id;
}

async function assembleRouterPreset(
  source: PresetUpdateSource,
  archive: string,
  destination: string,
): Promise<string[]> {
  const staging = `${archive}.preset`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    execFileSync("tar", ["-xzf", archive, "-C", staging], { stdio: "ignore" });
    const authoredRoot = join(staging, source.archiveRoot, "preset");
    if (!(await isDirectory(authoredRoot))) {
      throw new Error(`routing-suite-update: archive lacks preset/`);
    }
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true, mode: 0o700 });
    const ids: string[] = [];
    for (const entry of await readdir(authoredRoot, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        (await fileExists(join(authoredRoot, entry.name, "agent.cordis.yml")))
      ) {
        await copyTree(
          join(authoredRoot, entry.name),
          join(destination, entry.name),
        );
        ids.push(entry.name);
      }
    }
    if (ids.length === 0) {
      throw new Error(`routing-suite-update: archive has no authored presets`);
    }
    return ids;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function refreshOnce(cacheRoot: string): Promise<void> {
  const fetchRoot = join(cacheRoot, ".fetch");
  await rm(fetchRoot, { recursive: true, force: true });
  await mkdir(fetchRoot, { recursive: true, mode: 0o700 });
  const components: Record<string, unknown>[] = [];
  try {
    for (const source of UPDATE_SOURCES) {
      const archive = join(fetchRoot, source.fileName);
      const body = await download(source.url, archive);
      const target = join(cacheRoot, source.target);
      if (source.id === "router-preset") {
        const presets = await assembleRouterPreset(source, archive, target);
        components.push({
          id: source.id,
          presets,
          sha256: sha256Of(body),
          source: "github-archive-main",
        });
      } else {
        await assemblePackage(source, archive, target);
        components.push({
          id: source.id,
          sha256: sha256Of(body),
          source: "github-release",
        });
      }
    }
    const manifest = {
      schemaVersion: 1,
      fetchedAt: new Date().toISOString(),
      components,
    };
    await writeFile(
      join(cacheRoot, VERSIONS_FILE),
      `${JSON.stringify(manifest, undefined, 2)}\n`,
      { mode: 0o600 },
    );
    await writeFile(
      join(cacheRoot, LAST_CHECK_FILE),
      `${JSON.stringify({ checkedAt: new Date().toISOString() })}\n`,
      { mode: 0o600 },
    );
  } finally {
    await rm(fetchRoot, { recursive: true, force: true });
  }
}

async function lastCheckWasRecent(cacheRoot: string): Promise<boolean> {
  try {
    const value = JSON.parse(
      await readFile(join(cacheRoot, LAST_CHECK_FILE), "utf8"),
    ) as { checkedAt?: unknown };
    if (typeof value.checkedAt !== "string") return false;
    const checked = Date.parse(value.checkedAt);
    if (Number.isNaN(checked)) return false;
    return Date.now() - checked < REFRESH_INTERVAL_MS;
  } catch {
    return false;
  }
}

export async function cacheIsComplete(cacheRoot: string): Promise<boolean> {
  try {
    if (!(await fileExists(join(cacheRoot, VERSIONS_FILE)))) return false;
    if (!(await fileExists(join(cacheRoot, "injector", "package.json"))))
      return false;
    if (!(await fileExists(join(cacheRoot, "mode-boost", "package.json"))))
      return false;
    const presetRoot = join(cacheRoot, "preset");
    if (!(await isDirectory(presetRoot))) return false;
    const ids = (await readdir(presetRoot)).filter(
      (name) => !name.startsWith("."),
    );
    for (const id of ids) {
      if (await fileExists(join(presetRoot, id, "agent.cordis.yml")))
        return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Background refresh: download the latest snapshot into the user cache. */
export async function refreshRoutingSuiteCache(
  userDataPath: string,
): Promise<void> {
  const cacheRoot = join(userDataPath, CACHE_DIRECTORY);
  try {
    if (await lastCheckWasRecent(cacheRoot)) return;
    const staging = `${cacheRoot}.staging-${process.pid}`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true, mode: 0o700 });
    try {
      await refreshOnce(staging);
      await rm(cacheRoot, { recursive: true, force: true });
      await rename(staging, cacheRoot);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message.slice(0, 300) : "refresh failed";
    process.stderr.write(
      `[DeepSeek Harness Code] routing-suite refresh skipped: ${diagnostic}\n`,
    );
  }
}

/** Resolve the snapshot root: the refreshed user cache wins, else the bundle. */
export async function resolveRoutingSuiteRoot(
  userDataPath: string,
  bundledRoot: string,
): Promise<string> {
  const cacheRoot = join(userDataPath, CACHE_DIRECTORY);
  return (await cacheIsComplete(cacheRoot)) ? cacheRoot : bundledRoot;
}
