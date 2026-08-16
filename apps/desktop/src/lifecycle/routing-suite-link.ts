import { lstat, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  ensureDesktopPluginBundle,
  ensurePluginLink,
  installManagedPresetForStartup,
  type ManagedPresetStartupResult,
} from "./desktop-plugin-link.js";

/**
 * Auto-assembly for the bundled dsh-routing-suite snapshot
 * (github.com/yjh051108/dsh-routing-suite):
 *
 *   injector/   -> @dsh-external/dsh-super-injector  official bundle layer
 *   mode-boost/ -> @dsh-external/dsh-mode-boost       user patch layer insert
 *   preset/     -> router-standard + router-spec      managed agent presets
 *
 * The desktop host already owns the Web profile (see desktop-plugin-link.ts),
 * so assembly here only appends the suite's layers idempotently and never
 * touches user-authored profile content.
 */

const ROUTING_INJECTOR_PACKAGE = "@dsh-external/dsh-super-injector";
const ROUTING_MODE_BOOST_PACKAGE = "@dsh-external/dsh-mode-boost";
const ROUTING_MODE_BOOST_PATCH_ID = "mode-boost";
const ROUTING_PRESET_DIRECTORY = "preset";
const ROUTING_VERSIONS_FILE = "versions.json";

const LEGACY_MODE_BOOST_PATCH_BLOCK = `- insert:
    - id: ${ROUTING_MODE_BOOST_PATCH_ID}
      name: '${ROUTING_MODE_BOOST_PACKAGE}'
      config: {}
`;

// The rc.6 Node Loader cannot resolve a bare package name from a profile-local
// link. Address the linked package relative to the profile's cordis.yml.
const MANAGED_ROUTING_PATCH_BLOCK = `- insert:
    - id: ${ROUTING_MODE_BOOST_PATCH_ID}
      name: './node_modules/@dsh-external/dsh-mode-boost/lib/index.js'
      config: {}
`;

const PROFILE_PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`;

function isEmptyPatchDocument(content: string): boolean {
  const dataLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  return dataLines.length === 1 && dataLines[0] === "[]";
}

function withoutEmptyPatchSequence(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "[]")
    .join("\n")
    .replace(/\s*$/, "");
}

function appendManagedRoutingPatch(content: string): string {
  const prefix = isEmptyPatchDocument(content)
    ? withoutEmptyPatchSequence(content)
    : content.replace(/\s*$/, "");
  return prefix === ""
    ? MANAGED_ROUTING_PATCH_BLOCK
    : `${prefix}\n${MANAGED_ROUTING_PATCH_BLOCK}`;
}

/** Return the untouched prefix before the exact app-managed 0.3.0 block. */
function legacyManagedPatchPrefix(content: string): string | undefined {
  const normalized = content.replace(/\s*$/, "");
  const managedBlock = LEGACY_MODE_BOOST_PATCH_BLOCK.trimEnd();
  if (!normalized.endsWith(managedBlock)) return undefined;
  return normalized.slice(0, -managedBlock.length);
}

export type RoutingSuitePresetInstall = {
  id: string;
  status: ManagedPresetStartupResult["status"];
};

export type RoutingSuiteInstallSummary = {
  bundles: { packageName: string; linked: boolean }[];
  modeBoost: { linked: boolean; patch: "added" | "present" };
  presets: RoutingSuitePresetInstall[];
};

export type RoutingSuiteStartupResult =
  | { status: "available"; summary: RoutingSuiteInstallSummary }
  | { status: "unavailable"; path: string };

async function existingEntry(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Append suite-managed bundles to the Web profile layer list idempotently. */
async function ensureSuiteBundles(
  dshHome: string,
  packageNames: readonly string[],
): Promise<void> {
  const profileRoot = join(dshHome, "profiles", "web");
  const manifestPath = join(profileRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    dsh?: { profile?: { bundles?: unknown } };
  };
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles)
    ? manifest.dsh.profile.bundles.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const next = [...bundles];
  for (const packageName of packageNames) {
    if (!next.includes(packageName)) next.push(packageName);
  }
  if (next.length === bundles.length) return;
  manifest.dsh ??= {};
  manifest.dsh.profile ??= {};
  manifest.dsh.profile.bundles = next;
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    { mode: 0o600 },
  );
  await rename(temporaryPath, manifestPath);
}

/** Link a suite bundle, tolerating an already-present package directory. */
async function linkSuiteBundle(
  dshHome: string,
  routingSuiteRoot: string,
  relativePath: string,
  packageName: string,
): Promise<{ linked: boolean }> {
  const pluginRoot = join(routingSuiteRoot, relativePath);
  if (!(await isDirectory(pluginRoot))) {
    throw new Error(`routing-suite: missing component directory ${pluginRoot}`);
  }
  try {
    await ensurePluginLink(dshHome, pluginRoot, packageName);
    return { linked: true };
  } catch (error) {
    // A package already present through another install path (e.g. the user
    // ran `dsh plugin add` themselves) is fine — never replace it.
    const modulesRoot = join(dshHome, "profiles", "web", "node_modules");
    if (await existingEntry(join(modulesRoot, packageName))) {
      return { linked: false };
    }
    throw error;
  }
}

/** Register the host-plane boost plugin through the profile's user patch layer. */
async function ensureModeBoostPatch(
  dshHome: string,
): Promise<"added" | "present"> {
  const profileRoot = join(dshHome, "profiles", "web");
  const patchPath = join(profileRoot, "cordis.patch.yml");
  let content: string;
  try {
    content = await readFile(patchPath, "utf8");
  } catch {
    content = PROFILE_PATCH_TEMPLATE;
  }
  const legacyPrefix = legacyManagedPatchPrefix(content);
  if (legacyPrefix !== undefined) {
    await writeFile(patchPath, appendManagedRoutingPatch(legacyPrefix), {
      mode: 0o600,
    });
    return "present";
  }
  if (content.includes(ROUTING_MODE_BOOST_PACKAGE)) return "present";
  const block = appendManagedRoutingPatch(content);
  await writeFile(patchPath, block, { mode: 0o600 });
  return "added";
}

async function readRouterPresetVersion(
  routingSuiteRoot: string,
): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(
      await readFile(join(routingSuiteRoot, ROUTING_VERSIONS_FILE), "utf8"),
    ) as { components?: { id?: unknown; version?: unknown }[] };
    const router = manifest.components?.find(
      (component) => component.id === "router-preset",
    );
    return typeof router?.version === "string" ? router.version : undefined;
  } catch {
    return undefined;
  }
}

/** Install every authored router preset under the suite's preset directory. */
async function ensureRouterPresets(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingSuitePresetInstall[]> {
  const presetRoot = join(routingSuiteRoot, ROUTING_PRESET_DIRECTORY);
  const version =
    (await readRouterPresetVersion(routingSuiteRoot)) ?? "snapshot";
  const ids: string[] = [];
  for (const entry of (await readdir(presetRoot, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    if (
      entry.isDirectory() &&
      (await existingEntry(join(presetRoot, entry.name, "agent.cordis.yml")))
    ) {
      ids.push(entry.name);
    }
  }
  const presets: RoutingSuitePresetInstall[] = [];
  for (const id of ids) {
    const result = await installManagedPresetForStartup(
      dshHome,
      join(presetRoot, id),
      id,
      version,
      presetRoot,
    );
    presets.push({ id, status: result.status });
  }
  return presets;
}

/** Assemble the bundled routing suite into the app-owned Harness profile. */
export async function ensureRoutingSuite(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingSuiteInstallSummary> {
  // The desktop bundle registration must run first so the suite's bundle
  // layer is appended after the host-owned one.
  await ensureDesktopPluginBundle(dshHome);

  const injector = await linkSuiteBundle(
    dshHome,
    routingSuiteRoot,
    "injector",
    ROUTING_INJECTOR_PACKAGE,
  );
  await ensureSuiteBundles(dshHome, [ROUTING_INJECTOR_PACKAGE]);

  const modeBoost = await linkSuiteBundle(
    dshHome,
    routingSuiteRoot,
    "mode-boost",
    ROUTING_MODE_BOOST_PACKAGE,
  );
  const patch = await ensureModeBoostPatch(dshHome);

  const presets = await ensureRouterPresets(dshHome, routingSuiteRoot);

  return {
    bundles: [
      { packageName: ROUTING_INJECTOR_PACKAGE, linked: injector.linked },
    ],
    modeBoost: { linked: modeBoost.linked, patch },
    presets,
  };
}

/** Keep an invalid routing suite from preventing Harness startup. */
export async function installRoutingSuiteForStartup(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingSuiteStartupResult> {
  try {
    return {
      status: "available",
      summary: await ensureRoutingSuite(dshHome, routingSuiteRoot),
    };
  } catch (error) {
    const diagnostic =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "routing suite unavailable";
    process.stderr.write(`[DeepSeek Harness Code] ${diagnostic}\n`);
    return { status: "unavailable", path: routingSuiteRoot };
  }
}
