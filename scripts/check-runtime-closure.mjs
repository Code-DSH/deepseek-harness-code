import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const maintainedRepositoryUrl =
  "https://github.com/Code-DSH/deepseek-harness.git";
const maintainedFamilyVersion = "0.1.1-rc.2.code.1";
const strictProvenance = process.argv.includes("--release");
const manifest = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8"),
);
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const pluginRoot = join(projectRoot, "packages", "desktop-plugin");
const pluginManifest = JSON.parse(
  await readFile(join(pluginRoot, "package.json"), "utf8"),
);
const requireFromPlugin = createRequire(join(pluginRoot, "package.json"));

const criticalRuntimeVersions = new Map([
  ["@deepseek-ai/dsh", maintainedFamilyVersion],
  ["@deepseek-ai/dsh-compaction", maintainedFamilyVersion],
  ["@deepseek-ai/dsh-invariants", maintainedFamilyVersion],
  ["@deepseek-ai/dsh-workflow", maintainedFamilyVersion],
  ["@deepseek-ai/dsh-client-ui-primitives", maintainedFamilyVersion],
  ["@deepseek-ai/dsh-home-paths", maintainedFamilyVersion],
  ["pnpm", "11.19.0"],
  ["dsh-find-plugin", "0.3.6"],
]);

const runtimeArtifacts = [
  "dist/desktop/main.js",
  "dist/desktop/preload.js",
  "dist/watchdog/entry.js",
  "packages/desktop-plugin/package.json",
  "packages/desktop-plugin/client.js",
  "packages/desktop-plugin/index.js",
  "packages/desktop-plugin/cordis.patch.yml",
  "packages/desktop-plugin/THIRD_PARTY_NOTICES.md",
  "packages/dsh-ui-motion/package.json",
  "packages/dsh-ui-motion/index.js",
  "packages/dsh-ui-motion/lib/index.js",
  "packages/dsh-ui-motion/lib/client.js",
  "packages/dsh-ui-motion/cordis.patch.yml",
  "packages/dsh-model-two-level-selector/package.json",
  "packages/dsh-model-two-level-selector/index.js",
  "packages/dsh-model-two-level-selector/lib/index.js",
  "packages/dsh-model-two-level-selector/lib/client.js",
  "packages/dsh-model-two-level-selector/cordis.patch.yml",
  "packages/dsh-ui-polish/package.json",
  "packages/dsh-ui-polish/index.js",
  "packages/dsh-ui-polish/lib/index.js",
  "packages/dsh-ui-polish/lib/client.js",
  "packages/dsh-ui-polish/cordis.patch.yml",
  "packages/dsh-updater-check/package.json",
  "packages/dsh-updater-check/index.js",
  "packages/dsh-updater-check/lib/index.js",
  "packages/dsh-updater-check/lib/client.js",
  "packages/dsh-updater-check/cordis.patch.yml",
  "packages/dsh-lan-access/package.json",
  "packages/dsh-lan-access/index.js",
  "packages/dsh-lan-access/lib/index.js",
  "packages/dsh-lan-access/lib/client.js",
  "packages/dsh-lan-access/cordis.patch.yml",
  "packages/dsh-settings-tools/package.json",
  "packages/dsh-settings-tools/index.js",
  "packages/dsh-settings-tools/lib/index.js",
  "packages/dsh-settings-tools/lib/client.js",
  "packages/dsh-settings-tools/cordis.patch.yml",
  "packages/dsh-plugin-market/package.json",
  "packages/dsh-plugin-market/lib/index.js",
  "packages/dsh-plugin-market/lib/client.js",
  "packages/dsh-plugin-market/cordis.patch.yml",
  "packages/dsh-superpowers/package.json",
  "packages/dsh-superpowers/lib/index.js",
  "packages/dsh-superpowers/lib/client.js",
  "packages/dsh-superpowers/lib/judge.js",
  "packages/dsh-superpowers/lib/prompt.js",
  "packages/dsh-superpowers/cordis.patch.yml",
  "packages/anchored-standard-plugin/package.json",
  "packages/anchored-standard-plugin/preset/agent.cordis.yml",
  "packages/anchored-standard-plugin/preset/preset.yml",
  "packages/anchored-standard-plugin/preset/tool-bootstrap.mjs",
  "packages/anchored-standard-plugin/LICENSE",
  "packages/anchored-standard-plugin/NOTICE",
  "packages/anchored-standard-plugin/UPSTREAM.json",
  "packages/anchored-standard-plugin/UPSTREAM-SHA256SUMS",
  "packages/anchored-standard-plugin/LOCAL-PATCHES.md",
  "apps/desktop/src/startup.html",
  "build/routing-suite/versions.json",
  "build/routing-suite/injector/package.json",
  "build/routing-suite/injector/cordis.patch.yml",
  "build/routing-suite/mode-boost/package.json",
  "build/routing-suite/mode-boost/cordis.patch.yml",
  "build/routing-suite/preset/router-standard/agent.cordis.yml",
  "build/routing-suite/preset/router-spec/agent.cordis.yml",
];

function resolveDependency(name) {
  for (const specifier of [`${name}/package.json`, name]) {
    try {
      return requireFromProject.resolve(specifier);
    } catch {
      // Try the package entry when package.json is not exported, or vice versa.
    }
  }
  throw new Error(`production dependency is not resolvable: ${name}`);
}

function capture(command, args, cwd = projectRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error?.message ?? result.stderr}`,
    );
  }
  return result.stdout.trim();
}

async function sha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function tarballName(name, version) {
  const unscoped = name.startsWith("@")
    ? name.slice(1).replace("/", "-")
    : name;
  return `${unscoped}-${version}.tgz`;
}

for (const path of runtimeArtifacts) await access(join(projectRoot, path));

const resolvedDependencies = [];
for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
  if (String(range).startsWith("workspace:")) continue;
  const entryPath = resolveDependency(name);
  resolvedDependencies.push({ name, entryPath });
}

for (const [name, expectedVersion] of criticalRuntimeVersions) {
  const packagePath =
    name === "pnpm"
      ? requireFromProject.resolve("pnpm")
      : requireFromProject.resolve(`${name}/package.json`);
  const installed = JSON.parse(await readFile(packagePath, "utf8"));
  if (installed.version !== expectedVersion) {
    throw new Error(
      `${name} runtime version ${installed.version} does not match ${expectedVersion}`,
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
for (const entry of ["pnpm.mjs", "worker.js"]) {
  await access(join(pnpmStandaloneRoot, entry));
}

const nodeRuntimeResourceRoot = join(projectRoot, "build", "node-runtime");
for (const relativePath of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "maintained-harness.json",
  "pnpm.mjs",
  "worker.js",
]) {
  await access(join(nodeRuntimeResourceRoot, relativePath));
}
const configRuntimeRoot = join(projectRoot, "config", "node-runtime");
const nodeRuntimePackage = JSON.parse(
  await readFile(join(nodeRuntimeResourceRoot, "package.json"), "utf8"),
);
const configRuntimePackage = JSON.parse(
  await readFile(join(configRuntimeRoot, "package.json"), "utf8"),
);
const maintainedHarness = JSON.parse(
  await readFile(
    join(nodeRuntimeResourceRoot, "maintained-harness.json"),
    "utf8",
  ),
);
const packagedPnpmLock = await readFile(
  join(nodeRuntimeResourceRoot, "pnpm-lock.yaml"),
  "utf8",
);
const packagedPnpmWorkspace = await readFile(
  join(nodeRuntimeResourceRoot, "pnpm-workspace.yaml"),
  "utf8",
);
const configPnpmLock = await readFile(
  join(configRuntimeRoot, "pnpm-lock.yaml"),
  "utf8",
);
const configPnpmWorkspace = await readFile(
  join(configRuntimeRoot, "pnpm-workspace.yaml"),
  "utf8",
);

if (
  maintainedHarness.schemaVersion !== 1 ||
  maintainedHarness.repositoryUrl !== maintainedRepositoryUrl ||
  maintainedHarness.familyVersion !== maintainedFamilyVersion ||
  !Array.isArray(maintainedHarness.packages) ||
  maintainedHarness.packages.length === 0
) {
  throw new Error("maintained Harness provenance is invalid");
}

const gitmodules = await readFile(join(projectRoot, ".gitmodules"), "utf8");
if (
  !gitmodules.includes("path = deps/deepseek-harness") ||
  !gitmodules.includes(`url = ${maintainedRepositoryUrl}`) ||
  /^\s*branch\s*=/mu.test(gitmodules)
) {
  throw new Error(
    "deepseek-harness submodule URL or pinning policy is invalid",
  );
}
const submoduleRoot = join(projectRoot, "deps", "deepseek-harness");
const submoduleCommit = capture("git", ["rev-parse", "HEAD"], submoduleRoot);
const gitlinkEntry = capture("git", [
  "ls-files",
  "--stage",
  "--",
  "deps/deepseek-harness",
]);
const gitlinkCommit = gitlinkEntry.match(/^160000\s+([a-f0-9]{40})\s/u)?.[1];
if (
  gitlinkCommit === undefined ||
  submoduleCommit !== gitlinkCommit ||
  maintainedHarness.submoduleCommit !== gitlinkCommit
) {
  throw new Error("maintained Harness gitlink and provenance commit disagree");
}
if (
  strictProvenance &&
  capture(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    submoduleRoot,
  ) !== ""
) {
  throw new Error(
    "release builds require a clean maintained Harness submodule",
  );
}

const packageNames = maintainedHarness.packages.map((entry) => entry.name);
const sortedNames = [...packageNames].sort((left, right) =>
  left.localeCompare(right),
);
if (
  new Set(packageNames).size !== packageNames.length ||
  packageNames.some((name, index) => name !== sortedNames[index])
) {
  throw new Error(
    "maintained Harness provenance packages must be unique and sorted",
  );
}

const expectedTarballs = new Set();
for (const entry of maintainedHarness.packages) {
  if (
    typeof entry.name !== "string" ||
    !entry.name.startsWith("@deepseek-ai/") ||
    entry.version !== maintainedFamilyVersion ||
    entry.file !== tarballName(entry.name, entry.version) ||
    typeof entry.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(entry.sha256)
  ) {
    throw new Error(
      `invalid maintained Harness package provenance: ${entry.name}`,
    );
  }
  const specifier = `file:vendor/dsh/${entry.file}`;
  expectedTarballs.add(entry.file);
  for (const [label, runtimePackage] of [
    ["config", configRuntimePackage],
    ["build", nodeRuntimePackage],
  ]) {
    if (runtimePackage.dependencies?.[entry.name] !== specifier) {
      throw new Error(
        `${label} runtime does not pin ${entry.name} to ${specifier}`,
      );
    }
  }
  for (const [label, lock, workspace] of [
    ["config", configPnpmLock, configPnpmWorkspace],
    ["build", packagedPnpmLock, packagedPnpmWorkspace],
  ]) {
    if (!lock.includes(specifier) || !workspace.includes(specifier)) {
      throw new Error(
        `${label} runtime does not override ${entry.name} locally`,
      );
    }
  }
  const tarballPath = join(
    nodeRuntimeResourceRoot,
    "vendor",
    "dsh",
    entry.file,
  );
  if ((await sha256(tarballPath)) !== entry.sha256) {
    throw new Error(
      `maintained Harness tarball digest mismatch: ${entry.file}`,
    );
  }
}
const stagedTarballs = (
  await readdir(join(nodeRuntimeResourceRoot, "vendor", "dsh"))
).filter((entry) => entry.endsWith(".tgz"));
if (
  stagedTarballs.length !== expectedTarballs.size ||
  stagedTarballs.some((entry) => !expectedTarballs.has(entry))
) {
  throw new Error("build/node-runtime/vendor/dsh is not the complete family");
}
if (
  nodeRuntimePackage.dependencies?.["dsh-find-plugin"] !== "0.3.6" ||
  configRuntimePackage.dependencies?.["dsh-find-plugin"] !== "0.3.6"
) {
  throw new Error("node runtime must pin dsh-find-plugin@0.3.6");
}

const rootPnpmLock = await readFile(
  join(projectRoot, "pnpm-lock.yaml"),
  "utf8",
);
for (const packageName of packageNames) {
  const registryKey = new RegExp(
    `^  ['"]?${packageName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}@`,
    "mu",
  );
  if (registryKey.test(rootPnpmLock)) {
    throw new Error(
      `root lockfile contains registry DSH package ${packageName}`,
    );
  }
}

const builderConfig = await readFile(
  join(projectRoot, "electron-builder.yml"),
  "utf8",
);
if (
  !builderConfig.includes('"!node_modules/**/*"') ||
  builderConfig.includes("x64ArchFiles") ||
  !builderConfig.includes("build/node-runtime")
) {
  throw new Error(
    "electron-builder must exclude app node_modules and include the node-runtime resource",
  );
}

const desktopMainSource = await readFile(
  join(projectRoot, "apps", "desktop", "src", "main.ts"),
  "utf8",
);
for (const retiredPath of [
  'require.resolve("@deepseek-ai/dsh/lib/bin.js")',
  'require.resolve("pnpm")',
  'require.resolve("dsh-find-plugin/package.json")',
]) {
  if (desktopMainSource.includes(retiredPath)) {
    throw new Error(
      `packaged-runtime path remains in desktop main: ${retiredPath}`,
    );
  }
}

const findPluginManifestPath = requireFromProject.resolve(
  "dsh-find-plugin/package.json",
);
const findPluginPatch = await readFile(
  join(dirname(findPluginManifestPath), "cordis.patch.yml"),
  "utf8",
);
if (!findPluginPatch.includes("name: 'dsh-find-plugin'")) {
  throw new Error("dsh-find-plugin must retain its official bare-name patch");
}

for (const [directory, packageName, version] of [
  ["dsh-ui-motion", "dsh-ui-motion", "1.0.0"],
  ["dsh-model-two-level-selector", "dsh-model2-selector", "1.1.0"],
  ["dsh-ui-polish", "dsh-ui-polish", "1.1.0"],
  ["dsh-updater-check", "dsh-updater-check", "1.0.0"],
  ["dsh-lan-access", "dsh-lan-access", "1.0.0"],
  ["dsh-settings-tools", "dsh-settings-tools", "1.0.0"],
  [
    "dsh-plugin-market",
    "@dsh-external/deepseek-harness-plugin-market",
    "0.1.0",
  ],
  ["dsh-superpowers", "dsh-superpowers", "0.1.0"],
]) {
  const pluginRoot = join(projectRoot, "packages", directory);
  const pluginPackage = JSON.parse(
    await readFile(join(pluginRoot, "package.json"), "utf8"),
  );
  if (pluginPackage.name !== packageName || pluginPackage.version !== version) {
    throw new Error(
      `${directory} must retain installed identity ${packageName}@${version}`,
    );
  }
  const patch = await readFile(join(pluginRoot, "cordis.patch.yml"), "utf8");
  const quotedBareName = new RegExp(`name:\\s*(["'])${packageName}\\1`, "u");
  if (!quotedBareName.test(patch) || patch.includes("./node_modules/")) {
    throw new Error(`${packageName} must retain its official bare-name patch`);
  }
}

if (pluginManifest.dependencies?.["thinking-orbs"] !== "0.3.1") {
  throw new Error("desktop plugin must pin thinking-orbs@0.3.1");
}
const thinkingOrbsManifest = JSON.parse(
  await readFile(
    requireFromPlugin.resolve("thinking-orbs/package.json"),
    "utf8",
  ),
);
if (thinkingOrbsManifest.version !== "0.3.1") {
  throw new Error(
    `thinking-orbs runtime version ${thinkingOrbsManifest.version} does not match 0.3.1`,
  );
}

// The dsh-routing-suite snapshot must list every pinned component so the
// auto-load path (routing-suite-link.ts) has versions to record.
const routingSuiteVersions = JSON.parse(
  await readFile(
    join(projectRoot, "build", "routing-suite", "versions.json"),
    "utf8",
  ),
);
const routingSuitePins = new Map([
  ["injector", "0.3.3"],
  ["mode-boost", "0.1.0"],
  ["router-preset", "0.2.0"],
]);
for (const [component, expectedVersion] of routingSuitePins) {
  const recorded = routingSuiteVersions.components?.find(
    (entry) => entry.id === component,
  );
  if (recorded?.version !== expectedVersion) {
    throw new Error(
      `routing-suite ${component} version ${recorded?.version ?? "missing"} does not match ${expectedVersion}`,
    );
  }
}

const injectorPatch = await readFile(
  join(projectRoot, "build/routing-suite/injector/cordis.patch.yml"),
  "utf8",
);
const modeBoostPatch = await readFile(
  join(projectRoot, "build/routing-suite/mode-boost/cordis.patch.yml"),
  "utf8",
);
const modeBoostManifest = JSON.parse(
  await readFile(
    join(projectRoot, "build/routing-suite/mode-boost/package.json"),
    "utf8",
  ),
);
if (!injectorPatch.includes("name: '@dsh-external/dsh-super-injector'")) {
  throw new Error("routing injector must retain its official bare-name patch");
}
const injectorClient = await readFile(
  join(projectRoot, "build", "routing-suite", "injector", "lib", "client.js"),
  "utf8",
);
if (
  !injectorClient.includes("SuperInjectorPage") ||
  !injectorClient.includes("slots.register")
) {
  throw new Error(
    "routing injector client must carry the settings-page fix (slots.register(options, Component) with the page as the 2nd positional argument)",
  );
}
if (
  modeBoostManifest.dsh?.bundle?.patch !== "./cordis.patch.yml" ||
  !modeBoostPatch.includes("name: '@dsh-external/dsh-mode-boost'")
) {
  throw new Error("mode boost must expose an official bare-name dsh bundle");
}
for (const patch of [findPluginPatch, injectorPatch, modeBoostPatch]) {
  if (patch.includes("./node_modules/")) {
    throw new Error("integrated plugins must not use packaged-runtime paths");
  }
}

const manualAssemblySources = await Promise.all(
  [
    "apps/desktop/src/lifecycle/desktop-plugin-link.ts",
    "apps/desktop/src/lifecycle/routing-suite-link.ts",
  ].map((path) => readFile(join(projectRoot, path), "utf8")),
);
for (const source of manualAssemblySources) {
  for (const retiredName of [
    "ensureDesktopPluginBundle",
    "ensureDesktopPluginLink",
    'profiles", "web", "node_modules',
    "DHC_ELECTRON_EXECUTABLE",
  ]) {
    if (source.includes(retiredName)) {
      throw new Error(
        `retired manual profile assembly remains: ${retiredName}`,
      );
    }
  }
}

const pluginClient = await readFile(
  join(projectRoot, "packages", "desktop-plugin", "client.js"),
  "utf8",
);
for (const unresolved of [
  'require("./stream-output-model.js")',
  'require("./stream-output-controller.js")',
  'require("./thinking-status.js")',
  'require("thinking-orbs")',
]) {
  if (pluginClient.includes(unresolved)) {
    throw new Error(
      `desktop plugin client has unresolved module: ${unresolved}`,
    );
  }
}
if (
  !pluginClient.includes("ThinkingOrb") ||
  !pluginClient.includes("data-dsh-desktop-thinking-inline")
) {
  throw new Error(
    "desktop plugin client is missing the bundled inline ThinkingOrb",
  );
}

process.stdout.write(
  `${JSON.stringify({
    runtimeArtifacts: runtimeArtifacts.length,
    productionDependencies: resolvedDependencies.length,
    criticalRuntimePackages: criticalRuntimeVersions.size,
    maintainedHarnessPackages: maintainedHarness.packages.length,
    maintainedHarnessCommit: submoduleCommit,
    bundledPluginPackages: 10,
  })}\n`,
);
