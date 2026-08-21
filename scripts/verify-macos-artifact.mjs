import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dmgPath = process.argv[2];
if (!dmgPath)
  throw new Error(
    "usage: node scripts/verify-macos-artifact.mjs <dmg> [--universal]",
  );
const requireUniversal = process.argv.includes("--universal");
const mountPoint = await mkdtemp(join(tmpdir(), "deepseek-harness-code-dmg-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options }).trim();
}

async function walk(root) {
  const result = [];
  for (const name of await readdir(root)) {
    const path = join(root, name);
    const entry = await stat(path);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else result.push(path);
  }
  return result;
}

function expectedPackagedArch(path) {
  if (/darwin[-_/]x64|prebuilds\/darwin-x64/.test(path)) return "x86_64";
  if (/darwin[-_/]arm64|prebuilds\/darwin-arm64/.test(path)) return "arm64";
  return undefined;
}

try {
  run("hdiutil", [
    "attach",
    "-nobrowse",
    "-readonly",
    "-mountpoint",
    mountPoint,
    dmgPath,
  ]); // hdiutil attach
  const appPath = join(mountPoint, "DeepSeek Harness Code.app");
  const resourcesRoot = join(appPath, "Contents", "Resources");
  const packagedAppRoot = join(resourcesRoot, "app");
  const anchoredPresetArtifacts = [
    "anchored-standard-plugin/package.json",
    "anchored-standard-plugin/preset/agent.cordis.yml",
    "anchored-standard-plugin/preset/preset.yml",
    "anchored-standard-plugin/preset/tool-bootstrap.mjs",
    "anchored-standard-plugin/LICENSE",
    "anchored-standard-plugin/NOTICE",
    "anchored-standard-plugin/UPSTREAM.json",
    "anchored-standard-plugin/UPSTREAM-SHA256SUMS",
    "anchored-standard-plugin/LOCAL-PATCHES.md",
  ].map((relativePath) => join(resourcesRoot, relativePath));
  await Promise.all(anchoredPresetArtifacts.map((path) => access(path)));
  const anchoredUpstream = JSON.parse(
    await readFile(
      join(resourcesRoot, "anchored-standard-plugin/UPSTREAM.json"),
      "utf8",
    ),
  );
  if (anchoredUpstream.commit !== "db4527a2a70a9032d3a8525ce3c0ea6ef528d6fc") {
    throw new Error(
      `unexpected Anchored Standard upstream commit: ${String(anchoredUpstream.commit)}`,
    );
  }
  const nodeRuntimeResources = [
    "node-runtime/package.json",
    "node-runtime/pnpm-lock.yaml",
    "node-runtime/pnpm.mjs",
    "node-runtime/worker.js",
    "global-agent-prompt/protocol.md",
    "prompt-principles-plugin/index.js",
    "prompt-principles-plugin/client.js",
    "prompt-principles-plugin/cordis.patch.yml",
    "node-runtime/vendor/dsh-vision-router-1.7.1.tgz",
    "node-runtime/vendor/dsh-better-sidebar-0.12.3.tgz",
    "node-runtime/vendor/deepseek-harness-composition-1.0.0.tgz",
  ].map((relativePath) => join(resourcesRoot, relativePath));
  await Promise.all(nodeRuntimeResources.map((path) => access(path)));
  let packagedNodeModulesPresent = true;
  try {
    await access(join(packagedAppRoot, "node_modules"));
  } catch {
    packagedNodeModulesPresent = false;
  }
  if (packagedNodeModulesPresent) {
    throw new Error(
      "packaged application still contains node_modules; the Node runtime must be installed into user data",
    );
  }
  const nodeRuntimePackage = JSON.parse(
    await readFile(join(resourcesRoot, "node-runtime", "package.json"), "utf8"),
  );
  if (
    nodeRuntimePackage.dependencies?.["@deepseek-ai/dsh"] !== "0.1.0-rc.8" ||
    nodeRuntimePackage.dependencies?.["dsh-find-plugin"] !== "0.3.6"
  ) {
    throw new Error(
      "packaged node-runtime manifest does not contain the pinned Harness packages",
    );
  }
  const packagedPnpmLock = await readFile(
    join(resourcesRoot, "node-runtime", "pnpm-lock.yaml"),
    "utf8",
  );
  if (
    !packagedPnpmLock.includes("'@deepseek-ai/dsh':") ||
    !packagedPnpmLock.includes("dsh-find-plugin:")
  ) {
    throw new Error(
      "packaged node-runtime lockfile is missing the pinned Harness packages",
    );
  }
  const runtimeModules = nodeRuntimeResources.map((path) => ({
    specifier: path.slice(resourcesRoot.length + 1),
    path,
  }));
  const integratedPluginArtifacts = [
    "dsh-ui-motion/package.json",
    "dsh-ui-motion/index.js",
    "dsh-ui-motion/lib/index.js",
    "dsh-ui-motion/lib/client.js",
    "dsh-ui-motion/cordis.patch.yml",
    "dsh-model-two-level-selector/package.json",
    "dsh-model-two-level-selector/index.js",
    "dsh-model-two-level-selector/lib/index.js",
    "dsh-model-two-level-selector/lib/client.js",
    "dsh-model-two-level-selector/cordis.patch.yml",
    "dsh-lan-access/package.json",
    "dsh-lan-access/index.js",
    "dsh-lan-access/lib/index.js",
    "dsh-lan-access/lib/client.js",
    "dsh-lan-access/cordis.patch.yml",
    "routing-suite/injector/package.json",
    "routing-suite/injector/cordis.patch.yml",
    "routing-suite/mode-boost/package.json",
    "routing-suite/mode-boost/cordis.patch.yml",
  ].map((relativePath) => join(resourcesRoot, relativePath));
  await Promise.all(integratedPluginArtifacts.map((path) => access(path)));
  const [injectorPatch, modeBoostPatch] = await Promise.all([
    readFile(
      join(resourcesRoot, "routing-suite/injector/cordis.patch.yml"),
      "utf8",
    ),
    readFile(
      join(resourcesRoot, "routing-suite/mode-boost/cordis.patch.yml"),
      "utf8",
    ),
  ]);
  if (!injectorPatch.includes("name: '@dsh-external/dsh-super-injector'")) {
    throw new Error(
      "packaged injector patch is not the official bare-name form",
    );
  }
  if (!modeBoostPatch.includes("name: '@dsh-external/dsh-mode-boost'")) {
    throw new Error(
      "packaged mode-boost patch is not the official bare-name form",
    );
  }
  for (const [directory, packageName, version] of [
    ["dsh-ui-motion", "dsh-ui-motion", "1.0.0"],
    ["dsh-model-two-level-selector", "dsh-model2-selector", "1.1.0"],
    ["dsh-lan-access", "dsh-lan-access", "1.0.0"],
  ]) {
    const manifest = JSON.parse(
      await readFile(join(resourcesRoot, directory, "package.json"), "utf8"),
    );
    const patch = await readFile(
      join(resourcesRoot, directory, "cordis.patch.yml"),
      "utf8",
    );
    if (manifest.name !== packageName || manifest.version !== version) {
      throw new Error(
        `unexpected packaged plugin identity: ${String(manifest.name)}@${String(manifest.version)}`,
      );
    }
    const quotedBareName = new RegExp(`name:\\s*(["'])${packageName}\\1`, "u");
    if (!quotedBareName.test(patch) || patch.includes("./node_modules/")) {
      throw new Error(`${packageName} is not using its bare package name`);
    }
  }
  run("codesign", ["--verify", "--deep", "--strict", appPath]); // codesign --verify --deep --strict
  try {
    const quarantine = run("xattr", ["-p", "com.apple.quarantine", appPath]); // xattr
    throw new Error(`unexpected quarantine attribute: ${quarantine}`);
  } catch (error) {
    if (error.status === undefined) throw error;
  }
  const machFiles = [];
  for (const path of await walk(appPath)) {
    let kind = "";
    try {
      kind = run("file", ["-b", path]);
    } catch {
      continue;
    }
    if (!kind.includes("Mach-O")) continue;
    const arches = run("lipo", ["-archs", path]); // lipo -archs
    machFiles.push({ path, arches });
    if (requireUniversal) {
      const packagedArch = expectedPackagedArch(path);
      if (packagedArch !== undefined && !arches.includes(packagedArch)) {
        throw new Error(
          `wrong architecture-specific Mach-O: ${path} (${arches})`,
        );
      }
      if (
        packagedArch === undefined &&
        !(arches.includes("x86_64") && arches.includes("arm64"))
      ) {
        throw new Error(`non-Universal Mach-O: ${path} (${arches})`);
      }
    }
  }
  if (machFiles.length === 0)
    throw new Error("no Mach-O files found in application");
  process.stdout.write(
    `${JSON.stringify(
      {
        dmgPath,
        appPath,
        runtimeModules,
        anchoredPresetArtifacts,
        integratedPluginArtifacts,
        anchoredUpstreamCommit: anchoredUpstream.commit,
        machFiles,
      },
      undefined,
      2,
    )}\n`,
  );
} finally {
  try {
    run("hdiutil", ["detach", mountPoint]);
  } catch {
    /* best-effort cleanup */
  }
  await rm(mountPoint, { recursive: true, force: true });
}
