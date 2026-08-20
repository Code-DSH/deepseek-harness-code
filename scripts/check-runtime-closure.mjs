import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
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
  ["@deepseek-ai/dsh", "0.1.0-rc.8"],
  ["@deepseek-ai/dsh-compaction", "0.1.0-rc.8"],
  ["@deepseek-ai/dsh-invariants", "0.1.0-rc.8"],
  ["@deepseek-ai/dsh-workflow", "0.1.0-rc.8"],
  ["@deepseek-ai/dsh-client-ui-primitives", "0.1.0-rc.8"],
  ["@deepseek-ai/dsh-home-paths", "0.1.0-rc.8"],
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
const presetLocalePatch =
  "@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch";
const sidebarSafeAreaPatch =
  "@deepseek-ai__dsh-client-ui-sidebar@0.1.0-rc.8.patch";
for (const relativePath of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm.mjs",
  "worker.js",
]) {
  await access(join(nodeRuntimeResourceRoot, relativePath));
}
for (const runtimePatch of [presetLocalePatch, sidebarSafeAreaPatch]) {
  const sourcePatch = await readFile(
    join(projectRoot, "config", "node-runtime", "patches", runtimePatch),
  );
  const stagedPatch = await readFile(
    join(nodeRuntimeResourceRoot, "patches", runtimePatch),
  );
  if (!sourcePatch.equals(stagedPatch)) {
    throw new Error(`build/node-runtime must carry the exact ${runtimePatch}`);
  }
}
const nodeRuntimePackage = JSON.parse(
  await readFile(join(nodeRuntimeResourceRoot, "package.json"), "utf8"),
);
if (
  nodeRuntimePackage.dependencies?.["@deepseek-ai/dsh"] !== "0.1.0-rc.8" ||
  nodeRuntimePackage.dependencies?.["dsh-find-plugin"] !== "0.3.6"
) {
  throw new Error(
    "build/node-runtime must pin @deepseek-ai/dsh@0.1.0-rc.8 and dsh-find-plugin@0.3.6",
  );
}
const packagedPnpmLock = await readFile(
  join(nodeRuntimeResourceRoot, "pnpm-lock.yaml"),
  "utf8",
);
const packagedPnpmWorkspace = await readFile(
  join(nodeRuntimeResourceRoot, "pnpm-workspace.yaml"),
  "utf8",
);
if (
  !packagedPnpmLock.includes("'@deepseek-ai/dsh':") ||
  !packagedPnpmLock.includes("dsh-find-plugin:") ||
  !packagedPnpmLock.includes(
    "@deepseek-ai/dsh-client-ui-agent-preset@0.1.0-rc.8",
  ) ||
  !packagedPnpmLock.includes("@deepseek-ai/dsh-client-ui-sidebar@0.1.0-rc.8") ||
  !packagedPnpmLock.includes("patch_hash=") ||
  !packagedPnpmWorkspace.includes(presetLocalePatch) ||
  !packagedPnpmWorkspace.includes(sidebarSafeAreaPatch)
) {
  throw new Error(
    "build/node-runtime is missing pinned Harness packages or required client patches",
  );
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
    bundledPluginPackages: 10,
  })}\n`,
);
