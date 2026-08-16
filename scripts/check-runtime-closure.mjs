import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8"),
);
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const requireFromDesktopPlugin = createRequire(
  join(projectRoot, "packages", "desktop-plugin", "package.json"),
);

const criticalRuntimeVersions = new Map([
  ["@deepseek-ai/dsh", "0.1.0-rc.6"],
  ["@deepseek-ai/dsh-compaction", "0.1.0-rc.6"],
  ["@deepseek-ai/dsh-invariants", "0.1.0-rc.6"],
  ["@deepseek-ai/dsh-workflow", "0.1.0-rc.6"],
  ["@deepseek-ai/dsh-client-ui-primitives", "0.1.0-rc.6"],
]);

const criticalBundledPluginVersions = new Map([["thinking-orbs", "0.3.1"]]);

const runtimeArtifacts = [
  "dist/desktop/main.js",
  "dist/desktop/preload.js",
  "dist/watchdog/entry.js",
  "packages/desktop-plugin/package.json",
  "packages/desktop-plugin/client.js",
  "packages/desktop-plugin/index.js",
  "packages/desktop-plugin/cordis.patch.yml",
  "packages/desktop-plugin/THIRD_PARTY_NOTICES.md",
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
  const packagePath = requireFromProject.resolve(`${name}/package.json`);
  const installed = JSON.parse(await readFile(packagePath, "utf8"));
  if (installed.version !== expectedVersion) {
    throw new Error(
      `${name} runtime version ${installed.version} does not match ${expectedVersion}`,
    );
  }
}

for (const [name, expectedVersion] of criticalBundledPluginVersions) {
  const packagePath = requireFromDesktopPlugin.resolve(`${name}/package.json`);
  const installed = JSON.parse(await readFile(packagePath, "utf8"));
  if (installed.version !== expectedVersion) {
    throw new Error(
      `${name} bundled plugin version ${installed.version} does not match ${expectedVersion}`,
    );
  }
}

const pluginClient = await readFile(
  join(projectRoot, "packages", "desktop-plugin", "client.js"),
  "utf8",
);
for (const unresolved of [
  'require("thinking-orbs")',
  'require("./stream-output-model.js")',
  'require("./stream-output-controller.js")',
  'require("./thinking-status.js")',
]) {
  if (pluginClient.includes(unresolved)) {
    throw new Error(
      `desktop plugin client has unresolved module: ${unresolved}`,
    );
  }
}

process.stdout.write(
  `${JSON.stringify({
    runtimeArtifacts: runtimeArtifacts.length,
    productionDependencies: resolvedDependencies.length,
    criticalRuntimePackages: criticalRuntimeVersions.size,
    bundledPluginPackages: criticalBundledPluginVersions.size,
  })}\n`,
);
