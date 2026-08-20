#!/usr/bin/env node
/**
 * Fetch the dsh-routing-suite components into build/routing-suite as the
 * offline snapshot the desktop app bundles and auto-assembles on startup.
 *
 * The suite (github.com/yjh051108/dsh-routing-suite) is an install chain of
 * three independently versioned components:
 *
 *   injector/     -> @dsh-external/dsh-super-injector (runtime injector bundle)
 *   mode-boost/   -> @dsh-external/dsh-mode-boost      (host-plane boost bundle)
 *   preset/       -> dsh-router-standard                (router-standard + router-spec agent presets)
 *
 * The injector's git source is TypeScript and needs the dsh checkout to
 * build, so the snapshot always takes the prebuilt release tarball; the
 * mode-boost tarball ships prebuilt; the router preset is plain ESM + YAML
 * and is taken from the pinned commit archive the suite's submodule points
 * at. Versions, commits, and archive digests are pinned here so the snapshot
 * is deterministic and executable bytes are verified before extraction.
 *
 * Usage:
 *   node scripts/fetch-routing-suite.mjs
 *
 * Flags:
 *   --out <dir>   snapshot destination (default: build/routing-suite)
 *   --cache <dir> reuse previously downloaded tarballs instead of re-fetching
 */

import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  INJECTOR_BARE_ENTRY,
  MODE_BOOST_BUNDLE_PATCH,
  createOfficialModeBoostManifest,
  validateInjectorPatchContent,
} from "./routing-suite-contract.mjs";

export {
  INJECTOR_BARE_ENTRY,
  MODE_BOOST_BUNDLE_PATCH,
  createOfficialModeBoostManifest,
  validateInjectorPatchContent,
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const DEFAULT_OUT = join(projectRoot, "build", "routing-suite");

const ROUTING_PRESET_METADATA = {
  "router-standard": {
    name: "Standard Routing Mode",
    description:
      "Automatically decides whether to analyze or act first, then unlocks the full Standard toolset after the first tool call.",
  },
  "router-spec": {
    name: "Deep Analysis Routing Mode",
    description:
      "Analyzes the problem and structures a plan before acting; suited to fixes, debugging, and refactoring, then unlocks the full Standard toolset after the first tool call.",
  },
};

/** Pinned snapshot manifest. Kept in sync with the suite's submodules. */
const SOURCES = [
  {
    id: "injector",
    packageName: "@dsh-external/dsh-super-injector",
    version: "0.3.3",
    fileName: "dsh-external-dsh-super-injector-0.3.3.tgz",
    url: "https://github.com/yjh051108/dsh-super-injector/releases/download/v0.3.3/dsh-external-dsh-super-injector-0.3.3.tgz",
    sha256: "355238fa8e51bc45c0801066af51e0e122f3b21411b193f601ee54e534391f48",
    target: "injector",
    strip: "package",
  },
  {
    id: "mode-boost",
    packageName: "@dsh-external/dsh-mode-boost",
    version: "0.1.0",
    fileName: "dsh-external-dsh-mode-boost-0.1.0.tgz",
    url: "https://github.com/yjh051108/dsh-mode-boost/releases/download/v0.1.0/dsh-external-dsh-mode-boost-0.1.0.tgz",
    sha256: "72836d64bc465bc7c915e1bbc810d15ae0825dd4448350bcbf42c6e76efca12b",
    target: "mode-boost",
    strip: "package",
  },
  {
    id: "router-preset",
    packageName: "dsh-router-standard",
    version: "0.2.0",
    commit: "eff787e95132d6c7104214542104a84d656b497e",
    fileName: "dsh-router-standard-eff787e.tar.gz",
    url: "https://github.com/yjh051108/dsh-router-standard/archive/eff787e95132d6c7104214542104a84d656b497e.tar.gz",
    sha256: "a8f3616fe4f5ed3951118dbc508239cf61dfcd5c763ed1ec9baafea886126676",
    target: "preset",
  },
];

function sha256Of(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function verifyArchive(source, bytes) {
  const actualSha256 = sha256Of(bytes);
  if (actualSha256 !== source.sha256) {
    throw new Error(
      `fetch-routing-suite: SHA-256 mismatch for ${source.fileName}; expected ${source.sha256}, received ${actualSha256}`,
    );
  }
  return actualSha256;
}

function parseArgs(argv) {
  const options = { out: DEFAULT_OUT, cache: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") options.out = resolve(argv[++index]);
    else if (arg === "--cache") options.cache = resolve(argv[++index]);
    else {
      process.stderr.write(`fetch-routing-suite: unknown argument ${arg}\n`);
      process.exit(2);
    }
  }
  return options;
}

async function fileExists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`fetch-routing-suite: ${url} -> HTTP ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, body);
  return body;
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Extract a tarball and keep only the subtree at `strip`, re-rooted at destination. */
async function extractTarball(archive, destination, strip) {
  const staging = join(
    dirname(archive),
    `.extract-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    execFileSync("tar", ["-xzf", archive, "-C", staging], { stdio: "inherit" });
    const source = join(staging, strip);
    if (!(await isDirectory(source))) {
      throw new Error(
        `fetch-routing-suite: archive ${archive} has no ${strip} directory`,
      );
    }
    await rm(destination, { recursive: true, force: true });
    await copyTree(source, destination);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

function ensureExecutable(scriptsDir) {
  return chmod(scriptsDir, 0o755).catch(() => undefined);
}

async function assembleFromTarball(source, cacheDir, outDir, components) {
  const cached =
    cacheDir === undefined ? undefined : join(cacheDir, source.fileName);
  const archive =
    cached !== undefined && (await fileExists(cached))
      ? cached
      : join(outDir, ".fetch", source.fileName);
  let bytes;
  if (cached !== undefined && archive === cached) {
    bytes = await readFile(archive);
    process.stderr.write(
      `fetch-routing-suite: reusing cached ${source.fileName}\n`,
    );
  } else {
    bytes = await download(source.url, archive);
  }
  const archiveSha256 = verifyArchive(source, bytes);
  const target = join(outDir, source.target);
  await rm(target, { recursive: true, force: true });
  await extractTarball(archive, target, source.strip);
  if (source.id === "injector") {
    const patchPath = join(target, "cordis.patch.yml");
    validateInjectorPatchContent(await readFile(patchPath, "utf8"));
    // Overlay the internalized settings-page fix (vendor/super-injector-fix)
    // onto the fetched 0.3.3 client half. The upstream host (lib/index.js)
    // stays; only the client bundle is replaced so the settings "插件" section
    // renders under the rc.6 slot contract (Component as the 2nd positional
    // argument). The fix source lives outside the pnpm workspace so its
    // internal upstream deps do not block the workspace install.
    const fixedClient = await readFile(
      join(projectRoot, "vendor", "super-injector-fix", "lib", "client.js"),
      "utf8",
    );
    if (
      !fixedClient.includes("SuperInjectorPage") ||
      !fixedClient.includes("slots.register")
    ) {
      throw new Error(
        "fetch-routing-suite: bundled super-injector client fix is missing the slots.register(options, Component) contract",
      );
    }
    await writeFile(join(target, "lib", "client.js"), fixedClient, {
      mode: 0o600,
    });
    process.stderr.write(
      "fetch-routing-suite: applied super-injector settings-page client fix\n",
    );
  }
  if (source.id === "mode-boost") {
    const manifestPath = join(target, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(
      manifestPath,
      `${JSON.stringify(createOfficialModeBoostManifest(manifest), undefined, 2)}\n`,
      { mode: 0o600 },
    );
    await writeFile(join(target, "cordis.patch.yml"), MODE_BOOST_BUNDLE_PATCH, {
      mode: 0o600,
    });
  }
  if (source.id === "injector" || source.id === "mode-boost") {
    await ensureExecutable(join(target, "scripts"));
  }
  components.push({
    id: source.id,
    packageName: source.packageName,
    version: source.version,
    ...(source.commit === undefined ? {} : { commit: source.commit }),
    sha256: archiveSha256,
    source: "github-release",
  });
}

async function assembleRouterPreset(source, cacheDir, outDir, components) {
  const cached =
    cacheDir === undefined ? undefined : join(cacheDir, source.fileName);
  const archive =
    cached !== undefined && (await fileExists(cached))
      ? cached
      : join(outDir, ".fetch", source.fileName);
  let bytes;
  if (cached !== undefined && archive === cached) {
    bytes = await readFile(archive);
    process.stderr.write(
      `fetch-routing-suite: reusing cached ${source.fileName}\n`,
    );
  } else {
    bytes = await download(source.url, archive);
  }
  const archiveSha256 = verifyArchive(source, bytes);
  const staging = join(outDir, ".fetch", `${source.target}-staging`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  execFileSync("tar", ["-xzf", archive, "-C", staging], { stdio: "inherit" });
  const archiveRoot = `dsh-router-standard-${source.commit}`;
  const authoredRoot = join(staging, archiveRoot, "preset");
  if (!(await isDirectory(authoredRoot))) {
    throw new Error(
      `fetch-routing-suite: router archive lacks ${archiveRoot}/preset`,
    );
  }
  const target = join(outDir, source.target);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true, mode: 0o700 });
  const presetIds = [];
  // Copy the authored preset directories (router-standard, router-spec) and
  // keep the package LICENSE/NOTICE for attribution.
  const { readdir, copyFile } = await import("node:fs/promises");
  for (const id of (await readdir(authoredRoot)).filter(
    (name) => !name.startsWith("."),
  )) {
    const entryPath = join(authoredRoot, id);
    if (
      (await isDirectory(entryPath)) &&
      (await fileExists(join(entryPath, "agent.cordis.yml")))
    ) {
      await copyTree(entryPath, join(target, id));
      const metadata = ROUTING_PRESET_METADATA[id];
      if (metadata !== undefined) {
        await writeFile(
          join(target, id, "preset.yml"),
          `name: ${metadata.name}\ndescription: ${metadata.description}\n`,
          { mode: 0o600 },
        );
      }
      presetIds.push(id);
    }
  }
  if (presetIds.length === 0) {
    throw new Error(
      `fetch-routing-suite: no preset directories found in router staging`,
    );
  }
  for (const meta of ["LICENSE", "NOTICE"]) {
    const from = join(staging, archiveRoot, meta);
    if (await fileExists(from)) await copyFile(from, join(target, meta));
  }
  await rm(staging, { recursive: true, force: true });
  components.push({
    id: source.id,
    packageName: source.packageName,
    version: source.version,
    commit: source.commit,
    presets: presetIds,
    sha256: archiveSha256,
    source: "github-archive",
  });
}

async function copyTree(from, to) {
  const { readdir, copyFile, mkdir } = await import("node:fs/promises");
  await mkdir(to, { recursive: true, mode: 0o700 });
  for (const name of await readdir(from)) {
    const sourcePath = join(from, name);
    const targetPath = join(to, name);
    if ((await stat(sourcePath)).isDirectory())
      await copyTree(sourcePath, targetPath);
    else await copyFile(sourcePath, targetPath);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = options.out;
  await rm(join(outDir, ".fetch"), { recursive: true, force: true });
  await mkdir(outDir, { recursive: true, mode: 0o700 });

  const components = [];
  for (const source of SOURCES) {
    if (source.id === "router-preset") {
      await assembleRouterPreset(source, options.cache, outDir, components);
    } else {
      await assembleFromTarball(source, options.cache, outDir, components);
    }
  }

  const manifest = {
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    components,
  };
  await writeFile(
    join(outDir, "versions.json"),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    { mode: 0o600 },
  );
  await rm(join(outDir, ".fetch"), { recursive: true, force: true });

  process.stdout.write(
    `fetch-routing-suite: snapshot written to ${outDir}\n` +
      components
        .map((c) => `  ${c.id} ${c.version} (${c.sha256.slice(0, 12)})\n`)
        .join(""),
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
