import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";

const DESKTOP_PACKAGE_NAME = "deepseek-harness-desktop-plugin";
const ANCHORED_PACKAGE_NAME = "dsh-anchored-standard";
const ANCHORED_PRESET_ID = "anchored-standard";
const SUPERPOWERS_PACKAGE_NAME = "superpowers";
const SUPERPOWERS_SKILLS_DIRECTORY = "skills";
const MANAGED_PRESET_MARKER = ".deepseek-harness-code-managed.json";
const MANAGED_PRESET_METADATA = [
  "LICENSE",
  "NOTICE",
  "UPSTREAM.json",
  "UPSTREAM-SHA256SUMS",
  "LOCAL-PATCHES.md",
] as const;
const OFFICIAL_WEB_BUNDLES = [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
];
const MANAGED_BUNDLES = [DESKTOP_PACKAGE_NAME, ANCHORED_PACKAGE_NAME];

async function existingLinkTarget(
  linkPath: string,
): Promise<string | undefined> {
  try {
    const stat = await lstat(linkPath);
    if (!stat.isSymbolicLink()) {
      throw new Error(
        `Desktop plugin link path is occupied by a non-link entry: ${linkPath}`,
      );
    }
    return resolve(dirname(linkPath), await readlink(linkPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Expose a packaged plugin through the dedicated Harness profile's normal
 * Node package resolution without invoking pnpm or mutating the application.
 */
export async function ensurePluginLink(
  dshHome: string,
  pluginRoot: string,
  packageName: string,
): Promise<string> {
  const canonicalPluginRoot = await realpath(pluginRoot);
  const modulesRoot = join(dshHome, "profiles", "web", "node_modules");
  const linkPath = join(modulesRoot, packageName);
  await mkdir(modulesRoot, { recursive: true, mode: 0o700 });
  // Scoped package names nest one directory (node_modules/@scope/name).
  await mkdir(dirname(linkPath), { recursive: true, mode: 0o700 });
  const currentTarget = await existingLinkTarget(linkPath);
  if (currentTarget === canonicalPluginRoot) return linkPath;
  if (currentTarget !== undefined) await unlink(linkPath);
  await symlink(
    canonicalPluginRoot,
    linkPath,
    process.platform === "win32" ? "junction" : "dir",
  );
  return linkPath;
}

export async function ensureDesktopPluginLink(
  dshHome: string,
  pluginRoot: string,
): Promise<string> {
  return ensurePluginLink(dshHome, pluginRoot, DESKTOP_PACKAGE_NAME);
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
): Promise<{ files: PresetSourceFile[]; version: string }> {
  const files = await collectRegularFiles(sourceRoot);
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
): Promise<ManagedPresetInstallResult> {
  const presetRoot = join(dshHome, ".agent-presets");
  const target = join(presetRoot, presetId);
  const source = await collectPresetSource(
    presetId,
    sourceRoot,
    version,
    metadataRoot,
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
): Promise<ManagedPresetStartupResult> {
  try {
    return await installManagedPreset(
      dshHome,
      sourceRoot,
      presetId,
      version,
      metadataRoot,
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

/** Ensure the app-owned Web profile loads the desktop package as a standard dsh bundle. */
export async function ensureDesktopPluginBundle(
  dshHome: string,
): Promise<string> {
  const profileRoot = join(dshHome, "profiles", "web");
  const manifestPath = join(profileRoot, "package.json");
  await mkdir(profileRoot, { recursive: true, mode: 0o700 });
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    manifest = { name: "dsh-profile-web", private: true, dependencies: {} };
  }
  const dsh = (manifest.dsh ??= {}) as Record<string, unknown>;
  const profile = (dsh.profile ??= {}) as Record<string, unknown>;
  const existing = Array.isArray(profile.bundles)
    ? profile.bundles.filter(
        (value): value is string =>
          typeof value === "string" && !MANAGED_BUNDLES.includes(value),
      )
    : [];
  profile.bundles = [
    ...new Set([...OFFICIAL_WEB_BUNDLES, ...existing, DESKTOP_PACKAGE_NAME]),
  ];
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    { mode: 0o600 },
  );
  await rename(temporaryPath, manifestPath);
  return manifestPath;
}
