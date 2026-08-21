import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  basename,
  delimiter,
  dirname,
  join,
  resolve,
  win32 as windowsPath,
} from "node:path";

const ANCHORED_PRESET_ID = "anchored-standard";
const SUPERPOWERS_PACKAGE_NAME = "superpowers";
const SUPERPOWERS_SKILLS_DIRECTORY = "skills";
const MANAGED_PRESET_MARKER = ".deepseek-harness-code-managed.json";
const OFFICIAL_PLUGIN_MARKER =
  ".deepseek-harness-code-plugin-reconciliation.json";
const MANAGED_PRESET_METADATA = [
  "LICENSE",
  "NOTICE",
  "UPSTREAM.json",
  "UPSTREAM-SHA256SUMS",
  "LOCAL-PATCHES.md",
] as const;

export type IntegratedHarnessPlugin = {
  packageName: string;
  packageRoot: string;
  /** When true, the plugin link is created but it is removed from the
   * bundles list — used for plugins that RC8's dsh-base bundle includes
   * automatically (e.g. subagent providers), to avoid duplicate loader
   * entry IDs. */
  linkOnly?: boolean;
};

export type OfficialCommandOptions = {
  encoding: "utf8";
  env: Record<string, string | undefined>;
  shell: false;
  windowsHide: true;
};

export type OfficialCommandResult = {
  status: number | null;
  stdout?: string | Buffer | null;
  stderr?: string | Buffer | null;
  error?: Error;
};

export type OfficialCommandRunner = (
  command: string,
  args: readonly string[],
  options: OfficialCommandOptions,
) => OfficialCommandResult;

export type OfficialHarnessInstallInput = {
  dshEntry: string;
  dshHome: string;
  nodeExecutable: string;
  pnpmEntry: string;
  pnpmStoreDir: string;
  runtimeBinRoot: string;
  releaseIdentity?: string;
  serverEverythingRoot?: string;
  integratedPlugins: readonly IntegratedHarnessPlugin[];
  legacyPluginSpecs?: readonly LegacyPluginSpec[];
  env?: Record<string, string | undefined>;
  runCommand?: OfficialCommandRunner;
};

export type OfficialHarnessInstallResult = {
  status: "installed" | "unchanged";
  packages: string[];
};

export type LegacyPluginSpec = {
  packageName: string;
  installSpec: string;
};

export type HarnessMigrationInput = {
  legacyHome: string;
  dshHome: string;
  copyFileOperation?: (source: string, target: string) => Promise<void>;
};

export type HarnessMigrationResult = {
  status: "not-needed" | "migrated" | "unchanged";
  copied: string[];
  conflicts: string[];
  skippedSymlinks: string[];
  legacyPluginSpecs: LegacyPluginSpec[];
};

const POSIX_PNPM_LAUNCHER = `#!/bin/sh
exec "$DHC_NODE_EXECUTABLE" "$DHC_PNPM_ENTRY" --store-dir "$DHC_PNPM_STORE_DIR" "$@"
`;

const WINDOWS_PNPM_LAUNCHER = `@echo off\r
"%DHC_NODE_EXECUTABLE%" "%DHC_PNPM_ENTRY%" --store-dir "%DHC_PNPM_STORE_DIR%" %*\r
`;

// The bundled MCP bridge spawns `dsh-npx` through the official SDK's
// shell-less stdio transport. The launchers below forward to the detected
// system Node's own npx (npx.cmd on Windows), with absolute paths baked in
// at startup so the harness child never depends on environment variables.
function npxLauncherShims(nodeExecutable: string): {
  posix: string;
  windows: string;
} {
  const nodeDir = dirname(nodeExecutable);
  const posixNpx = join(nodeDir, "npx");
  const windowsNpx = join(nodeDir, "npx.cmd");
  return {
    posix: `#!/bin/sh
exec "${posixNpx}" "$@"
`,
    windows: `@echo off\r
"${windowsNpx}" %*\r
`,
  };
}

// The bundled everything MCP server ships inside the pinned runtime package
// set, so the launcher below starts it straight from the store without any
// registry resolution or download at startup time.
function everythingLauncherShims(
  nodeExecutable: string,
  serverEntry: string,
): { posix: string; windows: string } {
  return {
    posix: `#!/bin/sh
exec "${nodeExecutable}" "${serverEntry}" "$@"
`,
    windows: `@echo off\r
"${nodeExecutable}" "${serverEntry}" %*\r
`,
  };
}

async function writePnpmLaunchers(
  runtimeBinRoot: string,
  nodeExecutable: string,
  serverEverythingRoot?: string,
): Promise<void> {
  await mkdir(runtimeBinRoot, { recursive: true, mode: 0o700 });
  const posixPath = join(runtimeBinRoot, "pnpm");
  const windowsPath = join(runtimeBinRoot, "pnpm.cmd");
  await writeFile(posixPath, POSIX_PNPM_LAUNCHER, { mode: 0o700 });
  await chmod(posixPath, 0o700);
  await writeFile(windowsPath, WINDOWS_PNPM_LAUNCHER, { mode: 0o600 });
  const npxShims = npxLauncherShims(nodeExecutable);
  const posixNpxPath = join(runtimeBinRoot, "dsh-npx");
  const windowsNpxPath = join(runtimeBinRoot, "dsh-npx.cmd");
  await writeFile(posixNpxPath, npxShims.posix, { mode: 0o700 });
  await chmod(posixNpxPath, 0o700);
  await writeFile(windowsNpxPath, npxShims.windows, { mode: 0o600 });
  if (serverEverythingRoot !== undefined) {
    const serverEntry = join(
      await realpath(serverEverythingRoot),
      "dist",
      "index.js",
    );
    const everythingShims = everythingLauncherShims(
      nodeExecutable,
      serverEntry,
    );
    const posixEverythingPath = join(runtimeBinRoot, "dsh-mcp-everything");
    const windowsEverythingPath = join(
      runtimeBinRoot,
      "dsh-mcp-everything.cmd",
    );
    await writeFile(posixEverythingPath, everythingShims.posix, {
      mode: 0o700,
    });
    await chmod(posixEverythingPath, 0o700);
    await writeFile(windowsEverythingPath, everythingShims.windows, {
      mode: 0o600,
    });
  }
}

function defaultOfficialCommandRunner(
  command: string,
  args: readonly string[],
  options: OfficialCommandOptions,
): OfficialCommandResult {
  const result = spawnSync(command, [...args], options);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

// A dsh profile directory may have been linked against a foreign pnpm store
// (for example by running dsh from a terminal with a user-level pnpm). pnpm
// refuses to mix stores (ERR_PNPM_UNEXPECTED_STORE), so drop the derived
// node_modules tree and let the official install relink it against the
// managed store. node_modules is package-manager output only; settings,
// sessions, and presets live elsewhere in the dsh home.
async function reconcileForeignPnpmStore(input: {
  profileRoot: string;
  expectedStoreDir: string;
}): Promise<void> {
  const modulesYamlPath = join(
    input.profileRoot,
    "node_modules",
    ".modules.yaml",
  );
  let content: string;
  try {
    content = await readFile(modulesYamlPath, "utf8");
  } catch {
    return;
  }
  // pnpm writes this manifest as JSON (layoutVersion 5) or legacy YAML.
  let storeDir: string | undefined;
  if (content.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(content) as { storeDir?: unknown };
      if (typeof parsed.storeDir === "string") storeDir = parsed.storeDir;
    } catch {
      return;
    }
  } else {
    storeDir = content.match(/^storeDir:\s*(\S+)\s*$/m)?.[1];
  }
  if (storeDir === undefined) return;
  // pnpm appends a version directory (for example `/v11`) to the configured
  // store root; strip it on both sides so a healthy install is left alone.
  // The version leaf is matched by name (basename) so the check works with
  // both forward and backslash paths on Windows.
  const normalize = (value: string): string => {
    const resolved = resolve(value);
    return /^v\d+$/u.test(basename(resolved)) ? dirname(resolved) : resolved;
  };
  if (normalize(storeDir) === normalize(input.expectedStoreDir)) return;
  await rm(join(input.profileRoot, "node_modules"), {
    recursive: true,
    force: true,
  });
}

type ResolvedIntegratedHarnessPlugin = {
  packageName: string;
  packageRoot: string;
  manifestVersion: string;
  manifestDigest: string;
  linkOnly: boolean;
};

type OfficialPluginMarker = {
  schemaVersion: 2;
  owner: "deepseek-harness-code";
  releaseIdentity: string;
  storeDir: string;
  packages: Array<{
    packageName: string;
    packageRoot: string;
    manifestVersion: string;
    manifestDigest: string;
    linkOnly: boolean;
  }>;
  digest: string;
};

function officialPluginMarkerPayload(
  releaseIdentity: string,
  storeDir: string,
  plugins: readonly ResolvedIntegratedHarnessPlugin[],
): string {
  return JSON.stringify({
    schemaVersion: 2,
    owner: "deepseek-harness-code",
    releaseIdentity,
    storeDir: resolve(storeDir),
    packages: [...plugins]
      .map(
        ({
          packageName,
          packageRoot,
          manifestVersion,
          manifestDigest,
          linkOnly,
        }) => ({
          packageName,
          packageRoot,
          manifestVersion,
          manifestDigest,
          linkOnly,
        }),
      )
      .sort((left, right) => left.packageName.localeCompare(right.packageName)),
  });
}

function officialPluginMarkerDigest(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

type OfficialPluginMarkerRead =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "valid"; marker: OfficialPluginMarker };

async function readOfficialPluginMarker(
  markerPath: string,
): Promise<OfficialPluginMarkerRead> {
  let content: string;
  try {
    content = await readFile(markerPath, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? { status: "missing" }
      : { status: "invalid" };
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { status: "invalid" };
    }
    const marker = parsed as Partial<OfficialPluginMarker>;
    if (
      marker.schemaVersion !== 2 ||
      marker.owner !== "deepseek-harness-code" ||
      typeof marker.releaseIdentity !== "string" ||
      typeof marker.storeDir !== "string" ||
      !Array.isArray(marker.packages) ||
      typeof marker.digest !== "string" ||
      !/^[a-f0-9]{64}$/u.test(marker.digest)
    ) {
      return { status: "invalid" };
    }
    const packages = marker.packages;
    if (
      packages.some(
        (plugin) =>
          typeof plugin !== "object" ||
          plugin === null ||
          typeof plugin.packageName !== "string" ||
          typeof plugin.packageRoot !== "string" ||
          typeof plugin.manifestVersion !== "string" ||
          typeof plugin.manifestDigest !== "string" ||
          !/^[a-f0-9]{64}$/u.test(plugin.manifestDigest) ||
          typeof plugin.linkOnly !== "boolean",
      )
    ) {
      return { status: "invalid" };
    }
    const payload = JSON.stringify({
      schemaVersion: marker.schemaVersion,
      owner: marker.owner,
      releaseIdentity: marker.releaseIdentity,
      storeDir: marker.storeDir,
      packages,
    });
    if (officialPluginMarkerDigest(payload) !== marker.digest) {
      return { status: "invalid" };
    }
    return { status: "valid", marker: marker as OfficialPluginMarker };
  } catch {
    return { status: "invalid" };
  }
}

async function profileHasManagedStore(
  profileRoot: string,
  expectedStoreDir: string,
): Promise<boolean> {
  try {
    const content = await readFile(
      join(profileRoot, "node_modules", ".modules.yaml"),
      "utf8",
    );
    let storeDir: string | undefined;
    if (content.trimStart().startsWith("{")) {
      const parsed = JSON.parse(content) as { storeDir?: unknown };
      if (typeof parsed.storeDir === "string") storeDir = parsed.storeDir;
    } else {
      storeDir = content.match(/^storeDir:\s*(\S+)\s*$/m)?.[1];
    }
    if (storeDir === undefined) return false;
    const normalize = (value: string): string => {
      const resolved = resolve(value);
      return /^v\d+$/u.test(basename(resolved)) ? dirname(resolved) : resolved;
    };
    return normalize(storeDir) === normalize(expectedStoreDir);
  } catch {
    return false;
  }
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/u.test(value) || /^\\\\/u.test(value);
}

function normalizeWindowsPath(value: string): string {
  const normalized = windowsPath.normalize(value.replaceAll("/", "\\"));
  if (/^[A-Za-z]:/u.test(normalized)) {
    return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1).replaceAll("\\", "/")}`;
  }
  return normalized.replaceAll("\\", "/");
}

function equivalentPackageRoot(left: string, right: string): boolean {
  const leftIsWindows = isWindowsAbsolutePath(left);
  const rightIsWindows = isWindowsAbsolutePath(right);
  if (leftIsWindows || rightIsWindows) {
    return (
      leftIsWindows &&
      rightIsWindows &&
      normalizeWindowsPath(left) === normalizeWindowsPath(right)
    );
  }
  return resolve(left) === resolve(right);
}

function manifestDependencyMatchesPackageRoot(
  dependency: string | undefined,
  packageRoot: string,
): boolean {
  return (
    dependency !== undefined &&
    dependency.startsWith("link:") &&
    equivalentPackageRoot(dependency.slice("link:".length), packageRoot)
  );
}

async function profileHasNoLinkOnlyBundles(
  profileRoot: string,
  linkOnlyNames: ReadonlySet<string>,
): Promise<boolean> {
  if (linkOnlyNames.size === 0) return true;
  try {
    const profile = JSON.parse(
      await readFile(join(profileRoot, "package.json"), "utf8"),
    ) as {
      dsh?: { profile?: { bundles?: unknown } };
    };
    const bundles = profile.dsh?.profile?.bundles;
    return (
      !Array.isArray(bundles) ||
      !bundles.some(
        (name): name is string =>
          typeof name === "string" && linkOnlyNames.has(name),
      )
    );
  } catch {
    return false;
  }
}

async function removeLinkOnlyBundles(
  profileRoot: string,
  linkOnlyNames: ReadonlySet<string>,
): Promise<void> {
  if (linkOnlyNames.size === 0) return;
  try {
    const profilePath = join(profileRoot, "package.json");
    const profile = JSON.parse(await readFile(profilePath, "utf8")) as {
      dsh?: { profile?: { bundles?: unknown } };
    };
    const bundles = profile.dsh?.profile?.bundles;
    if (!Array.isArray(bundles)) return;
    const filtered = bundles.filter(
      (name) => typeof name !== "string" || !linkOnlyNames.has(name),
    );
    if (filtered.length === bundles.length) return;
    profile.dsh!.profile!.bundles = filtered;
    await writeFile(
      profilePath,
      `${JSON.stringify(profile, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // Profile package.json read/write failure is non-fatal.
  }
}

type OfficialPluginInstallState = "unchanged" | "legacy-unchanged";

async function inspectOfficialPluginInstall(input: {
  dshHome: string;
  pnpmStoreDir: string;
  releaseIdentity: string;
  plugins: readonly ResolvedIntegratedHarnessPlugin[];
}): Promise<OfficialPluginInstallState | undefined> {
  const markerRead = await readOfficialPluginMarker(
    join(input.dshHome, OFFICIAL_PLUGIN_MARKER),
  );
  if (markerRead.status === "invalid") return undefined;
  const marker = markerRead.status === "valid" ? markerRead.marker : undefined;
  if (marker !== undefined) {
    const payload = officialPluginMarkerPayload(
      input.releaseIdentity,
      input.pnpmStoreDir,
      input.plugins,
    );
    if (
      marker.releaseIdentity !== input.releaseIdentity ||
      marker.storeDir !== resolve(input.pnpmStoreDir) ||
      marker.digest !== officialPluginMarkerDigest(payload)
    ) {
      return undefined;
    }
  }
  let dependencies: Record<string, string>;
  try {
    dependencies = await readManifestDependencies(
      join(input.dshHome, "profiles", "web", "package.json"),
    );
  } catch {
    return undefined;
  }
  if (
    input.plugins.some(
      (plugin) =>
        !manifestDependencyMatchesPackageRoot(
          dependencies[plugin.packageName],
          plugin.packageRoot,
        ),
    )
  ) {
    return undefined;
  }
  const linkOnlyNames = new Set(
    input.plugins
      .filter((plugin) => plugin.linkOnly === true)
      .map((plugin) => plugin.packageName),
  );
  if (
    !(await profileHasNoLinkOnlyBundles(
      join(input.dshHome, "profiles", "web"),
      linkOnlyNames,
    ))
  ) {
    return undefined;
  }
  if (
    !(await profileHasManagedStore(
      join(input.dshHome, "profiles", "web"),
      input.pnpmStoreDir,
    ))
  ) {
    return undefined;
  }
  return markerRead.status === "missing" ? "legacy-unchanged" : "unchanged";
}

async function writeOfficialPluginMarker(input: {
  dshHome: string;
  pnpmStoreDir: string;
  releaseIdentity: string;
  plugins: readonly ResolvedIntegratedHarnessPlugin[];
}): Promise<void> {
  const markerPayload = officialPluginMarkerPayload(
    input.releaseIdentity,
    input.pnpmStoreDir,
    input.plugins,
  );
  const marker: OfficialPluginMarker = {
    schemaVersion: 2,
    owner: "deepseek-harness-code",
    releaseIdentity: input.releaseIdentity,
    storeDir: resolve(input.pnpmStoreDir),
    packages: JSON.parse(markerPayload)
      .packages as OfficialPluginMarker["packages"],
    digest: officialPluginMarkerDigest(markerPayload),
  };
  await mkdir(input.dshHome, { recursive: true });
  await writeFile(
    join(input.dshHome, OFFICIAL_PLUGIN_MARKER),
    `${JSON.stringify(marker, null, 2)}\n`,
    "utf8",
  );
}

/** Install integrated packages through the public dsh plugin command. */
export async function ensureOfficialHarnessInstall(
  input: OfficialHarnessInstallInput,
): Promise<OfficialHarnessInstallResult> {
  const plugins: ResolvedIntegratedHarnessPlugin[] = [];
  for (const plugin of input.integratedPlugins) {
    const packageRoot = await realpath(plugin.packageRoot);
    const manifestContent = await readFile(
      join(packageRoot, "package.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestContent) as {
      name?: unknown;
      version?: unknown;
    };
    if (manifest.name !== plugin.packageName) {
      throw new Error(
        `Integrated package ${plugin.packageName} does not match ${String(manifest.name)}`,
      );
    }
    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
      throw new Error(
        `Integrated package ${plugin.packageName} has no version`,
      );
    }
    plugins.push({
      packageName: plugin.packageName,
      packageRoot,
      manifestVersion: manifest.version,
      manifestDigest: createHash("sha256")
        .update(manifestContent)
        .digest("hex"),
      linkOnly: plugin.linkOnly === true,
    });
  }

  const integratedNames = new Set(plugins.map((plugin) => plugin.packageName));
  const legacyPluginSpecs = (input.legacyPluginSpecs ?? []).filter((plugin) => {
    if (
      plugin.packageName.trim() === "" ||
      plugin.installSpec.trim() === "" ||
      plugin.packageName.includes("\0") ||
      plugin.installSpec.includes("\0")
    ) {
      throw new Error("Legacy plugin specification is invalid");
    }
    return !integratedNames.has(plugin.packageName);
  });
  const installRequests = [
    ...legacyPluginSpecs.map((plugin) => ({
      packageName: plugin.packageName,
      installSpec: plugin.installSpec,
    })),
    ...plugins.map((plugin) => ({
      packageName: plugin.packageName,
      installSpec: plugin.packageRoot,
    })),
  ];
  if (installRequests.length === 0) {
    return { status: "unchanged", packages: [] };
  }

  const installState =
    legacyPluginSpecs.length === 0
      ? await inspectOfficialPluginInstall({
          dshHome: input.dshHome,
          pnpmStoreDir: input.pnpmStoreDir,
          releaseIdentity: input.releaseIdentity ?? "unknown",
          plugins,
        })
      : undefined;
  if (installState !== undefined) {
    if (installState === "legacy-unchanged") {
      await writeOfficialPluginMarker({
        dshHome: input.dshHome,
        pnpmStoreDir: input.pnpmStoreDir,
        releaseIdentity: input.releaseIdentity ?? "unknown",
        plugins,
      });
    }
    return {
      status: "unchanged",
      packages: installRequests.map((request) => request.packageName),
    };
  }

  await writePnpmLaunchers(
    input.runtimeBinRoot,
    input.nodeExecutable,
    input.serverEverythingRoot,
  );
  const profileRoot = join(input.dshHome, "profiles", "web");
  await reconcileForeignPnpmStore({
    profileRoot,
    expectedStoreDir: input.pnpmStoreDir,
  });
  const inheritedEnv = input.env ?? process.env;
  const existingPath = inheritedEnv.PATH;
  const env: Record<string, string | undefined> = {
    ...inheritedEnv,
    DSH_HOME: input.dshHome,
    DHC_NODE_EXECUTABLE: input.nodeExecutable,
    DHC_PNPM_ENTRY: input.pnpmEntry,
    DHC_PNPM_STORE_DIR: input.pnpmStoreDir,
    // The pnpm launchers resolve Node through DHC_NODE_EXECUTABLE, but the
    // plugin installs they run may execute native-module postinstall scripts
    // that invoke `node` by name, and a GUI launch inherits a minimal PATH.
    PATH: [input.runtimeBinRoot, dirname(input.nodeExecutable), existingPath]
      .filter((entry) => entry !== undefined && entry !== "")
      .join(delimiter),
  };
  const runCommand = input.runCommand ?? defaultOfficialCommandRunner;
  const installAll = async (): Promise<void> => {
    const result = runCommand(
      input.nodeExecutable,
      [
        input.dshEntry,
        "plugin",
        "--profile",
        "web",
        "add",
        ...installRequests.map((request) => request.installSpec),
      ],
      {
        encoding: "utf8",
        env,
        shell: false,
        windowsHide: true,
      },
    );
    if (result.error !== undefined || result.status !== 0) {
      const exit = result.status === null ? "spawn" : String(result.status);
      const diagnostic =
        result.error?.message ?? String(result.stderr ?? "").slice(0, 2_000);
      throw new Error(
        `official plugin installation failed for ${installRequests.map((request) => request.packageName).join(", ")} (exit ${exit}): ${diagnostic}`,
      );
    }
  };
  try {
    await installAll();
  } catch (error) {
    // A corrupted derived node_modules — for example a self-referential
    // symlink left by an interrupted concurrent pnpm install — fails every
    // pnpm invocation with ELOOP. node_modules is package-manager output
    // only, so rebuild it once and retry the whole official reconciliation.
    await rm(join(profileRoot, "node_modules"), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
    await installAll();
    void error;
  }
  const linkOnlyNames = new Set(
    plugins
      .filter((plugin) => plugin.linkOnly === true)
      .map((plugin) => plugin.packageName),
  );
  await removeLinkOnlyBundles(profileRoot, linkOnlyNames);
  await writeOfficialPluginMarker({
    dshHome: input.dshHome,
    pnpmStoreDir: input.pnpmStoreDir,
    releaseIdentity: input.releaseIdentity ?? "unknown",
    plugins,
  });
  return {
    status: "installed",
    packages: installRequests.map((request) => request.packageName),
  };
}

const LEGACY_DATA_ENTRIES = [
  ".credentials.yaml",
  ".anonymous-user-id",
  "settings.yaml",
  "cordis.patch.yml",
  "mode-boost-activity.jsonl",
  "sessions",
  "attachments",
  "storages",
  "skills",
  ".agent-presets",
  "super-injector",
] as const;

const PRIVATE_SCALAR_FILES = new Set([".credentials.yaml", "settings.yaml"]);

async function digestPath(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function filesMatch(source: string, target: string): Promise<boolean> {
  const [sourceStat, targetStat] = await Promise.all([
    lstat(source),
    lstat(target),
  ]);
  if (
    !sourceStat.isFile() ||
    !targetStat.isFile() ||
    sourceStat.size !== targetStat.size
  ) {
    return false;
  }
  const [sourceDigest, targetDigest] = await Promise.all([
    digestPath(source),
    digestPath(target),
  ]);
  return sourceDigest === targetDigest;
}

function normalizedLegacyInstallSpec(
  packageName: string,
  spec: string,
  legacyProfileRoot: string,
): LegacyPluginSpec | undefined {
  if (
    packageName.length === 0 ||
    spec.length === 0 ||
    packageName.includes("\0") ||
    spec.includes("\0") ||
    spec.length > 2_048
  ) {
    return undefined;
  }
  for (const protocol of ["link:", "file:"] as const) {
    if (!spec.startsWith(protocol)) continue;
    const configuredPath = spec.slice(protocol.length);
    if (configuredPath.length === 0) return undefined;
    return {
      packageName,
      installSpec: `${protocol}${resolve(legacyProfileRoot, configuredPath)}`,
    };
  }
  if (
    /^(?:github:|git:|git\+|https?:|npm:)/.test(spec) ||
    spec.startsWith("/")
  ) {
    return { packageName, installSpec: spec };
  }
  if (spec.startsWith("workspace:")) return undefined;
  return { packageName, installSpec: `${packageName}@${spec}` };
}

async function readManifestDependencies(
  manifestPath: string,
): Promise<Record<string, string>> {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      dependencies?: unknown;
    };
    if (
      typeof manifest.dependencies !== "object" ||
      manifest.dependencies === null
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(manifest.dependencies).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function missingLegacyPluginSpecs(
  legacyHome: string,
  dshHome: string,
): Promise<LegacyPluginSpec[]> {
  const legacyProfileRoot = join(legacyHome, "profiles", "web");
  const legacy = await readManifestDependencies(
    join(legacyProfileRoot, "package.json"),
  );
  const target = await readManifestDependencies(
    join(dshHome, "profiles", "web", "package.json"),
  );
  return Object.entries(legacy)
    .filter(([packageName]) => !(packageName in target))
    .map(([packageName, spec]) =>
      normalizedLegacyInstallSpec(packageName, spec, legacyProfileRoot),
    )
    .filter((value): value is LegacyPluginSpec => value !== undefined)
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
}

/** Copy legacy Harness data into the official Home without overwriting it. */
export async function migrateLegacyHarnessHome(
  input: HarnessMigrationInput,
): Promise<HarnessMigrationResult> {
  const legacyHome = resolve(input.legacyHome);
  const dshHome = resolve(input.dshHome);
  const emptyResult = {
    copied: [],
    conflicts: [],
    skippedSymlinks: [],
    legacyPluginSpecs: [],
  };
  if (legacyHome === dshHome) return { status: "not-needed", ...emptyResult };
  try {
    if (!(await lstat(legacyHome)).isDirectory()) {
      return { status: "not-needed", ...emptyResult };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "not-needed", ...emptyResult };
    }
    throw error;
  }

  const copied: string[] = [];
  const conflicts: string[] = [];
  const skippedSymlinks: string[] = [];
  const createdFiles: string[] = [];
  const createdDirectories: string[] = [];
  const copyFileOperation = input.copyFileOperation ?? copyFile;

  async function ensureTargetDirectory(path: string): Promise<void> {
    try {
      const entry = await lstat(path);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new Error(`Harness migration target is not a directory: ${path}`);
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(path);
    if (parent !== path) await ensureTargetDirectory(parent);
    await mkdir(path, { mode: 0o700 });
    createdDirectories.push(path);
  }

  async function mergeEntry(relativePath: string): Promise<void> {
    const source = join(legacyHome, relativePath);
    const target = join(dshHome, relativePath);
    let sourceStat;
    try {
      sourceStat = await lstat(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (sourceStat.isSymbolicLink()) {
      skippedSymlinks.push(relativePath);
      return;
    }
    let targetStat;
    try {
      targetStat = await lstat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    if (sourceStat.isDirectory()) {
      if (
        targetStat !== undefined &&
        (!targetStat.isDirectory() || targetStat.isSymbolicLink())
      ) {
        conflicts.push(relativePath);
        return;
      }
      if (targetStat === undefined) await ensureTargetDirectory(target);
      const entries = await readdir(source, { withFileTypes: true });
      for (const entry of entries.sort((left, right) =>
        left.name.localeCompare(right.name),
      )) {
        await mergeEntry(join(relativePath, entry.name));
      }
      return;
    }
    if (!sourceStat.isFile()) {
      skippedSymlinks.push(relativePath);
      return;
    }
    if (targetStat !== undefined) {
      if (!(await filesMatch(source, target))) conflicts.push(relativePath);
      return;
    }
    await ensureTargetDirectory(dirname(target));
    createdFiles.push(target);
    await copyFileOperation(source, target);
    const topLevel = relativePath.split(/[\\/]/, 1)[0] ?? relativePath;
    await chmod(
      target,
      PRIVATE_SCALAR_FILES.has(topLevel) ? 0o600 : sourceStat.mode & 0o777,
    );
    copied.push(relativePath);
  }

  try {
    for (const entry of LEGACY_DATA_ENTRIES) await mergeEntry(entry);
  } catch (error) {
    for (const file of createdFiles.reverse()) {
      await rm(file, { force: true });
    }
    for (const directory of createdDirectories.reverse()) {
      await rmdir(directory).catch(() => undefined);
    }
    throw error;
  }

  const legacyPluginSpecs = await missingLegacyPluginSpecs(legacyHome, dshHome);
  copied.sort();
  conflicts.sort();
  skippedSymlinks.sort();
  return {
    status:
      copied.length > 0 || legacyPluginSpecs.length > 0
        ? "migrated"
        : "unchanged",
    copied,
    conflicts,
    skippedSymlinks,
    legacyPluginSpecs,
  };
}

type ManagedPresetMarker = {
  schemaVersion: 1;
  owner: "deepseek-harness-code";
  presetId: string;
  sourceVersion: string;
  sourceDigest: string;
};

export type ManagedPresetInstallResult = {
  status: "installed" | "updated" | "unchanged" | "conflict";
  path: string;
};

export type ManagedPresetStartupResult =
  | ManagedPresetInstallResult
  | { status: "unavailable"; path: string };

type ManagedSkillMarker = {
  schemaVersion: 1;
  owner: "deepseek-harness-code";
  skillName: string;
  sourceVersion: string;
  sourceDigest: string;
};

type ManagedSkillInstallResult = {
  status: "installed" | "updated" | "unchanged" | "conflict";
  path: string;
};

export type ManagedSkillsInstallSummary = {
  installed: string[];
  updated: string[];
  unchanged: string[];
  conflicts: string[];
};

export type ManagedSkillsStartupResult =
  | { status: "available"; summary: ManagedSkillsInstallSummary }
  | { status: "unavailable"; path: string };

type PresetSourceFile = {
  relativePath: string;
  content: Buffer;
};

export type PresetDisplayMetadata = {
  name: string;
  description: string;
};

async function collectRegularFiles(
  root: string,
  relativeRoot = "",
): Promise<PresetSourceFile[]> {
  const directory = join(root, relativeRoot);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: PresetSourceFile[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relativePath = join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRegularFiles(root, relativePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Managed preset/skill source contains an unsupported filesystem entry: ${relativePath}`,
      );
    }
    files.push({
      relativePath,
      content: await readFile(join(root, relativePath)),
    });
  }
  return files;
}

function digestFiles(files: readonly PresetSourceFile[]): string {
  const digest = createHash("sha256");
  for (const file of [...files].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  )) {
    digest.update(file.relativePath);
    digest.update("\0");
    digest.update(file.content);
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function collectPresetSource(
  presetId: string,
  sourceRoot: string,
  version: string,
  metadataRoot?: string,
  displayMetadata?: PresetDisplayMetadata,
): Promise<{ files: PresetSourceFile[]; version: string }> {
  const files = await collectRegularFiles(sourceRoot);
  if (displayMetadata !== undefined) {
    const presetFile = files.find((file) => file.relativePath === "preset.yml");
    if (presetFile === undefined) {
      throw new Error(`Managed preset ${presetId} is missing preset.yml`);
    }
    presetFile.content = Buffer.from(
      `name: ${displayMetadata.name}\ndescription: ${displayMetadata.description}\n`,
    );
  }
  if (metadataRoot !== undefined) {
    for (const name of MANAGED_PRESET_METADATA) {
      try {
        files.push({
          relativePath: name,
          content: await readFile(join(metadataRoot, name)),
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  const paths = new Set(files.map((file) => file.relativePath));
  for (const required of ["agent.cordis.yml", "preset.yml"]) {
    if (!paths.has(required)) {
      throw new Error(`Managed preset ${presetId} is missing ${required}`);
    }
  }
  return { files, version };
}

async function packagedPresetFiles(
  packagedRoot: string,
): Promise<{ files: PresetSourceFile[]; version: string }> {
  const manifest = JSON.parse(
    await readFile(join(packagedRoot, "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Anchored Standard package has no valid version");
  }
  return collectPresetSource(
    ANCHORED_PRESET_ID,
    join(packagedRoot, "preset"),
    manifest.version,
    packagedRoot,
  );
}

function isManagedMarker(
  value: unknown,
  presetId: string,
): value is ManagedPresetMarker {
  if (typeof value !== "object" || value === null) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.schemaVersion === 1 &&
    marker.owner === "deepseek-harness-code" &&
    marker.presetId === presetId &&
    typeof marker.sourceVersion === "string" &&
    typeof marker.sourceDigest === "string" &&
    /^[a-f0-9]{64}$/.test(marker.sourceDigest)
  );
}

async function readManagedMarker(
  target: string,
  presetId: string,
): Promise<ManagedPresetMarker | undefined> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(target, MANAGED_PRESET_MARKER), "utf8"),
    );
    return isManagedMarker(value, presetId) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function installedPresetDigest(target: string): Promise<string> {
  const files = (await collectRegularFiles(target)).filter(
    (file) => file.relativePath !== MANAGED_PRESET_MARKER,
  );
  return digestFiles(files);
}

async function writeManagedPreset(
  target: string,
  files: readonly PresetSourceFile[],
  marker: ManagedPresetMarker,
): Promise<void> {
  await mkdir(target, { recursive: true, mode: 0o700 });
  for (const file of files) {
    const destination = join(target, file.relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, file.content, { mode: 0o600 });
  }
  await writeFile(
    join(target, MANAGED_PRESET_MARKER),
    `${JSON.stringify(marker, undefined, 2)}\n`,
    { mode: 0o600 },
  );
}

async function existingDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function existingEntryKind(
  path: string,
): Promise<"absent" | "directory" | "other"> {
  try {
    return (await lstat(path)).isDirectory() ? "directory" : "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
    throw error;
  }
}

/** Install an app-owned agent preset without overwriting unknown user data. */
export async function installManagedPreset(
  dshHome: string,
  sourceRoot: string,
  presetId: string,
  version: string,
  metadataRoot?: string,
  displayMetadata?: PresetDisplayMetadata,
): Promise<ManagedPresetInstallResult> {
  const presetRoot = join(dshHome, ".agent-presets");
  const target = join(presetRoot, presetId);
  const source = await collectPresetSource(
    presetId,
    sourceRoot,
    version,
    metadataRoot,
    displayMetadata,
  );
  const sourceDigest = digestFiles(source.files);
  const targetKind = await existingEntryKind(target);
  if (targetKind === "other") return { status: "conflict", path: target };
  const targetExists = targetKind === "directory";
  const marker = targetExists
    ? await readManagedMarker(target, presetId)
    : undefined;
  if (targetExists && marker === undefined)
    return { status: "conflict", path: target };
  if (marker !== undefined) {
    const currentDigest = await installedPresetDigest(target);
    if (currentDigest !== marker.sourceDigest) {
      return { status: "conflict", path: target };
    }
    if (
      currentDigest === sourceDigest &&
      marker.sourceVersion === source.version
    ) {
      return { status: "unchanged", path: target };
    }
  }

  await mkdir(presetRoot, { recursive: true, mode: 0o700 });
  const suffix = `${process.pid}.${randomUUID()}`;
  const staging = join(presetRoot, `${presetId}.${suffix}.tmp`);
  const backup = join(presetRoot, `${presetId}.${suffix}.bak`);
  const nextMarker: ManagedPresetMarker = {
    schemaVersion: 1,
    owner: "deepseek-harness-code",
    presetId,
    sourceVersion: source.version,
    sourceDigest,
  };
  try {
    await writeManagedPreset(staging, source.files, nextMarker);
    if (targetExists) await rename(target, backup);
    await rename(staging, target);
    if (targetExists) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (targetExists && !(await existingDirectory(target))) {
      await rename(backup, target);
    }
    throw error;
  }
  return { status: targetExists ? "updated" : "installed", path: target };
}

/** Keep an invalid optional preset from preventing the Standard runtime from starting. */
export async function installManagedPresetForStartup(
  dshHome: string,
  sourceRoot: string,
  presetId: string,
  version: string,
  metadataRoot?: string,
  displayMetadata?: PresetDisplayMetadata,
): Promise<ManagedPresetStartupResult> {
  try {
    return await installManagedPreset(
      dshHome,
      sourceRoot,
      presetId,
      version,
      metadataRoot,
      displayMetadata,
    );
  } catch {
    return {
      status: "unavailable",
      path: join(dshHome, ".agent-presets", presetId),
    };
  }
}

/** Install the app-owned Anchored Standard preset (compat entry point). */
export async function ensureAnchoredStandardPreset(
  dshHome: string,
  packagedRoot: string,
): Promise<ManagedPresetInstallResult> {
  const source = await packagedPresetFiles(packagedRoot);
  return installManagedPreset(
    dshHome,
    join(packagedRoot, "preset"),
    ANCHORED_PRESET_ID,
    source.version,
    packagedRoot,
  );
}

/** Keep an invalid optional preset from preventing the Standard runtime from starting. */
export async function installAnchoredStandardPresetForStartup(
  dshHome: string,
  packagedRoot: string,
): Promise<ManagedPresetStartupResult> {
  try {
    return await ensureAnchoredStandardPreset(dshHome, packagedRoot);
  } catch {
    return {
      status: "unavailable",
      path: join(dshHome, ".agent-presets", ANCHORED_PRESET_ID),
    };
  }
}

function isManagedSkillMarker(value: unknown): value is ManagedSkillMarker {
  if (typeof value !== "object" || value === null) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.schemaVersion === 1 &&
    marker.owner === "deepseek-harness-code" &&
    typeof marker.skillName === "string" &&
    marker.skillName.length > 0 &&
    typeof marker.sourceVersion === "string" &&
    typeof marker.sourceDigest === "string" &&
    /^[a-f0-9]{64}$/.test(marker.sourceDigest)
  );
}

async function readManagedSkillMarker(
  target: string,
): Promise<ManagedSkillMarker | undefined> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(target, MANAGED_PRESET_MARKER), "utf8"),
    );
    return isManagedSkillMarker(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function installedSkillDigest(target: string): Promise<string> {
  const files = (await collectRegularFiles(target)).filter(
    (file) => file.relativePath !== MANAGED_PRESET_MARKER,
  );
  return digestFiles(files);
}

async function writeManagedSkill(
  target: string,
  files: readonly PresetSourceFile[],
  marker: ManagedSkillMarker,
): Promise<void> {
  await mkdir(target, { recursive: true, mode: 0o700 });
  for (const file of files) {
    const destination = join(target, file.relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, file.content, { mode: 0o600 });
  }
  await writeFile(
    join(target, MANAGED_PRESET_MARKER),
    `${JSON.stringify(marker, undefined, 2)}\n`,
    { mode: 0o600 },
  );
}

type PackagedSuperpowersSkill = {
  name: string;
  files: PresetSourceFile[];
};

async function packagedSuperpowersSkills(packagedRoot: string): Promise<{
  version: string;
  skills: PackagedSuperpowersSkill[];
}> {
  const manifest = JSON.parse(
    await readFile(join(packagedRoot, "package.json"), "utf8"),
  ) as { name?: unknown; version?: unknown };
  if (
    manifest.name !== SUPERPOWERS_PACKAGE_NAME ||
    typeof manifest.version !== "string" ||
    manifest.version.length === 0
  ) {
    throw new Error("Superpowers package has no valid name and version");
  }
  const skillRoot = join(packagedRoot, SUPERPOWERS_SKILLS_DIRECTORY);
  const entries = await readdir(skillRoot, { withFileTypes: true });
  const skills: PackagedSuperpowersSkill[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) {
      throw new Error(
        `Superpowers package contains an unsupported skill entry: ${entry.name}`,
      );
    }
    const files = await collectRegularFiles(join(skillRoot, entry.name));
    if (!files.some((file) => file.relativePath === "SKILL.md")) {
      throw new Error(`Superpowers skill is missing SKILL.md: ${entry.name}`);
    }
    skills.push({ name: entry.name, files });
  }
  if (skills.length === 0) throw new Error("Superpowers package has no skills");
  return { version: manifest.version, skills };
}

async function ensureSuperpowersSkill(
  dshHome: string,
  sourceVersion: string,
  source: PackagedSuperpowersSkill,
): Promise<ManagedSkillInstallResult> {
  const skillsRoot = join(dshHome, SUPERPOWERS_SKILLS_DIRECTORY);
  const target = join(skillsRoot, source.name);
  const sourceDigest = digestFiles(source.files);
  const targetKind = await existingEntryKind(target);
  if (targetKind === "other") return { status: "conflict", path: target };
  const targetExists = targetKind === "directory";
  const marker = targetExists
    ? await readManagedSkillMarker(target)
    : undefined;
  if (targetExists && marker === undefined)
    return { status: "conflict", path: target };
  if (marker !== undefined) {
    const currentDigest = await installedSkillDigest(target);
    if (currentDigest !== marker.sourceDigest)
      return { status: "conflict", path: target };
    if (
      currentDigest === sourceDigest &&
      marker.sourceVersion === sourceVersion
    ) {
      return { status: "unchanged", path: target };
    }
  }

  await mkdir(skillsRoot, { recursive: true, mode: 0o700 });
  const suffix = `${process.pid}.${randomUUID()}`;
  const staging = join(skillsRoot, `.${source.name}.${suffix}.tmp`);
  const backup = join(skillsRoot, `.${source.name}.${suffix}.bak`);
  const nextMarker: ManagedSkillMarker = {
    schemaVersion: 1,
    owner: "deepseek-harness-code",
    skillName: source.name,
    sourceVersion,
    sourceDigest,
  };
  try {
    await writeManagedSkill(staging, source.files, nextMarker);
    if (targetExists) await rename(target, backup);
    await rename(staging, target);
    if (targetExists) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (targetExists && !(await existingDirectory(target))) {
      await rename(backup, target);
    }
    throw error;
  }
  return { status: targetExists ? "updated" : "installed", path: target };
}

/** Install app-owned Superpowers skills while preserving every user skill. */
export async function ensureSuperpowersSkills(
  dshHome: string,
  packagedRoot: string,
): Promise<ManagedSkillsInstallSummary> {
  const packaged = await packagedSuperpowersSkills(packagedRoot);
  const summary: ManagedSkillsInstallSummary = {
    installed: [],
    updated: [],
    unchanged: [],
    conflicts: [],
  };
  for (const skill of packaged.skills) {
    const result = await ensureSuperpowersSkill(
      dshHome,
      packaged.version,
      skill,
    );
    if (result.status === "installed") summary.installed.push(skill.name);
    else if (result.status === "updated") summary.updated.push(skill.name);
    else if (result.status === "unchanged") summary.unchanged.push(skill.name);
    else summary.conflicts.push(skill.name);
  }
  return summary;
}

/** Keep an unavailable optional skill bundle from blocking Harness startup. */
export async function installSuperpowersSkillsForStartup(
  dshHome: string,
  packagedRoot: string,
): Promise<ManagedSkillsStartupResult> {
  try {
    return {
      status: "available",
      summary: await ensureSuperpowersSkills(dshHome, packagedRoot),
    };
  } catch {
    return {
      status: "unavailable",
      path: join(dshHome, SUPERPOWERS_SKILLS_DIRECTORY),
    };
  }
}
