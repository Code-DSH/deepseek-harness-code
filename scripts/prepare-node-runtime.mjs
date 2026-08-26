import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, cp, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const sourceRoot = join(projectRoot, "config", "node-runtime");
const targetRoot = join(projectRoot, "build", "node-runtime");
const maintainedFamilyRoot = join(targetRoot, "vendor", "dsh");
const maintainedHarnessPath = join(targetRoot, "maintained-harness.json");
const maintainedFamilyVersion = "0.1.1-rc.2.code.1";
const isRuntimeResourcePath = (source) =>
  basename(source) !== ".mimosa" &&
  source !== join(sourceRoot, "vendor", "dsh");

async function digest(path, algorithm, encoding) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest(encoding);
}

function synchronizeGeneratedRuntimeLockfile() {
  const result = spawnSync(
    process.execPath,
    [
      join(targetRoot, "pnpm.mjs"),
      "install",
      "--dir",
      targetRoot,
      "--lockfile-only",
      "--no-frozen-lockfile",
      "--prefer-offline",
      "--ignore-scripts",
      "--prod",
      "--reporter=append-only",
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        CI: "false",
        INIT_CWD: targetRoot,
        npm_config_local_prefix: targetRoot,
        npm_config_manage_package_manager_versions: "false",
      },
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`
      .trim()
      .slice(-4_000);
    throw new Error(
      `Could not synchronize generated Harness tarball integrities: ${diagnostic}`,
    );
  }
}

const pnpmPackagePath = requireFromProject.resolve("pnpm");
const pnpmStandaloneRoot = join(
  dirname(pnpmPackagePath),
  "artifacts",
  "exe",
  "dist",
);
const pnpmManifest = JSON.parse(await readFile(pnpmPackagePath, "utf8"));
if (pnpmManifest.version !== "11.19.0") {
  throw new Error(
    `pnpm runtime version ${String(pnpmManifest.version)} does not match 11.19.0`,
  );
}

const runtimeManifest = JSON.parse(
  await readFile(join(sourceRoot, "package.json"), "utf8"),
);
const maintainedHarness = JSON.parse(
  await readFile(maintainedHarnessPath, "utf8"),
);
if (
  maintainedHarness.schemaVersion !== 1 ||
  maintainedHarness.familyVersion !== maintainedFamilyVersion ||
  !Array.isArray(maintainedHarness.packages) ||
  maintainedHarness.packages.length === 0
) {
  throw new Error(
    "build/node-runtime/maintained-harness.json is missing a valid maintained Harness family",
  );
}
for (const entry of maintainedHarness.packages) {
  const specifier = `file:vendor/dsh/${entry.file}`;
  if (runtimeManifest.dependencies?.[entry.name] !== specifier) {
    throw new Error(`${entry.name} is not pinned to ${specifier}`);
  }
  const tarballPath = join(maintainedFamilyRoot, entry.file);
  if ((await digest(tarballPath, "sha256", "hex")) !== entry.sha256) {
    throw new Error(
      `Maintained Harness tarball digest mismatch: ${entry.file}`,
    );
  }
}
if (runtimeManifest.dependencies?.["dsh-find-plugin"] !== "0.3.6") {
  throw new Error(
    "node-runtime package.json does not pin dsh-find-plugin@0.3.6",
  );
}
await mkdir(targetRoot, { recursive: true });
await copyFile(
  join(sourceRoot, "package.json"),
  join(targetRoot, "package.json"),
);
await copyFile(
  join(sourceRoot, "pnpm-lock.yaml"),
  join(targetRoot, "pnpm-lock.yaml"),
);
await copyFile(
  join(sourceRoot, "pnpm-workspace.yaml"),
  join(targetRoot, "pnpm-workspace.yaml"),
);
// The vendored plugin tarballs referenced by the manifest through file:
// specifiers must sit next to it for a reproducible offline install. The DSH
// family is already produced by build:harness and must not be replaced with a
// config-local copy.
await cp(join(sourceRoot, "vendor"), join(targetRoot, "vendor"), {
  recursive: true,
  filter: isRuntimeResourcePath,
});
// The standalone pnpm launcher is not a single file: its install pipeline
// spawns worker threads (worker.js) and needs node-gyp-bin, templates, and
// vendor assets from the same directory. Copy the whole dist tree so the
// portable runtime installs packages exactly like the development tree.
await cp(pnpmStandaloneRoot, targetRoot, { recursive: true });
// `pnpm pack` produces new tarball bytes for the maintained family. Rebuild
// only the staged lockfile, so its file-integrity records describe these exact
// artifacts while preserving the reviewed dependency resolution.
synchronizeGeneratedRuntimeLockfile();
const stagedWorkspace = await readFile(
  join(targetRoot, "pnpm-workspace.yaml"),
  "utf8",
);
if (stagedWorkspace.includes("set this to true or false")) {
  throw new Error("node-runtime build policy contains unresolved pnpm prompts");
}
// fs.cp does not preserve the executable bit on script shims; native-module
// fallback builds execute node-gyp directly, so restore the mode explicitly.
await chmod(join(targetRoot, "node-gyp-bin", "node-gyp"), 0o755).catch(
  () => undefined,
);

const lockResult = spawnSync(
  process.execPath,
  [
    join(targetRoot, "pnpm.mjs"),
    "install",
    "--dir",
    targetRoot,
    "--lockfile-only",
    "--update-checksums",
    "--ignore-scripts",
    "--reporter=append-only",
  ],
  { encoding: "utf8", windowsHide: true, env: process.env },
);
if (lockResult.error !== undefined || lockResult.status !== 0) {
  throw new Error(
    `Runtime lockfile generation failed: ${lockResult.error?.message ?? lockResult.stderr.slice(-2_000)}`,
  );
}
const runtimeLock = await readFile(join(targetRoot, "pnpm-lock.yaml"), "utf8");
for (const entry of maintainedHarness.packages) {
  const tarballPath = join(maintainedFamilyRoot, entry.file);
  const integrity = `sha512-${await digest(tarballPath, "sha512", "base64")}`;
  if (!runtimeLock.includes(`integrity: ${integrity}`)) {
    throw new Error(`Runtime lockfile integrity mismatch: ${entry.file}`);
  }
}

process.stdout.write(
  `${JSON.stringify({
    runtimeResource: "build/node-runtime",
    pnpmVersion: pnpmManifest.version,
    maintainedHarnessPackages: maintainedHarness.packages.length,
    familyVersion: maintainedFamilyVersion,
    packages: [
      `@deepseek-ai/dsh@${maintainedFamilyVersion}`,
      "dsh-find-plugin@0.3.6",
    ],
  })}\n`,
);
