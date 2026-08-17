import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MANAGED_MARKER = ".agents-md.managed.json";
const MARKER_SCHEMA_VERSION = 1;
const MARKER_OWNER = "deepseek-harness-code";
const TARGET_FILE = "AGENTS.md";

export type GlobalAgentPromptStartupStatus =
  | "installed"
  | "updated"
  | "current"
  | "conflict"
  | "unavailable";

export interface GlobalAgentPromptStartupResult {
  status: GlobalAgentPromptStartupStatus;
}

export interface GlobalAgentPromptAdoptResult {
  status: "adopted" | "unavailable";
  backupPath?: string;
}

interface ManagedMarker {
  schemaVersion: number;
  owner: string;
  digest: string;
  installedAt: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function timestampSlug(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/u, "Z");
}

async function readManagedMarker(
  markerPath: string,
): Promise<ManagedMarker | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(markerPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const marker = parsed as Partial<ManagedMarker>;
    if (
      marker.schemaVersion !== MARKER_SCHEMA_VERSION ||
      marker.owner !== MARKER_OWNER ||
      typeof marker.digest !== "string" ||
      marker.digest.length !== 64
    ) {
      return undefined;
    }
    return marker as ManagedMarker;
  } catch {
    return undefined;
  }
}

async function installBundledPrompt(input: {
  dshHome: string;
  bundledPath: string;
  digest: string;
}): Promise<void> {
  await mkdir(input.dshHome, { recursive: true });
  await copyFile(input.bundledPath, join(input.dshHome, TARGET_FILE));
  await writeFile(
    join(input.dshHome, MANAGED_MARKER),
    `${JSON.stringify(
      {
        schemaVersion: MARKER_SCHEMA_VERSION,
        owner: MARKER_OWNER,
        digest: input.digest,
        installedAt: new Date().toISOString(),
      },
      undefined,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

/**
 * Ownership-safe startup installation of the bundled global AGENTS.md into
 * the official Harness home. Installs when the user has no global prompt,
 * upgrades an unmodified app-managed copy when the app release changes it,
 * and never touches a user-authored or user-edited file.
 */
export async function installGlobalAgentPromptForStartup(input: {
  dshHome: string;
  resourceRoot: string;
}): Promise<GlobalAgentPromptStartupResult> {
  const bundledPath = join(input.resourceRoot, TARGET_FILE);
  if (!(await pathExists(bundledPath))) {
    return { status: "unavailable" };
  }
  const bundledDigest = await sha256File(bundledPath);
  const targetPath = join(input.dshHome, TARGET_FILE);
  if (!(await pathExists(targetPath))) {
    await installBundledPrompt({
      dshHome: input.dshHome,
      bundledPath,
      digest: bundledDigest,
    });
    return { status: "installed" };
  }
  const marker = await readManagedMarker(
    join(input.dshHome, MANAGED_MARKER),
  );
  if (marker === undefined) {
    return { status: "conflict" };
  }
  const targetDigest = await sha256File(targetPath);
  if (targetDigest !== marker.digest) {
    // The user edited the app-managed copy; it is theirs now.
    return { status: "conflict" };
  }
  if (targetDigest === bundledDigest) {
    return { status: "current" };
  }
  await installBundledPrompt({
    dshHome: input.dshHome,
    bundledPath,
    digest: bundledDigest,
  });
  return { status: "updated" };
}

/**
 * Explicit user action: back up the current global AGENTS.md and replace it
 * with the bundled prompt. Unlike the startup installer, this intentionally
 * overwrites user-owned content after the caller confirmed the switch.
 */
export async function adoptBundledGlobalAgentPrompt(input: {
  dshHome: string;
  resourceRoot: string;
  now?: () => Date;
}): Promise<GlobalAgentPromptAdoptResult> {
  const bundledPath = join(input.resourceRoot, TARGET_FILE);
  if (!(await pathExists(bundledPath))) {
    return { status: "unavailable" };
  }
  const digest = await sha256File(bundledPath);
  const targetPath = join(input.dshHome, TARGET_FILE);
  let backupPath: string | undefined;
  if (await pathExists(targetPath)) {
    const stamp = timestampSlug(input.now?.() ?? new Date());
    const pendingBackup = join(
      input.dshHome,
      `${TARGET_FILE}.backup-${stamp}`,
    );
    await rename(targetPath, pendingBackup);
    backupPath = pendingBackup;
  }
  await installBundledPrompt({
    dshHome: input.dshHome,
    bundledPath,
    digest,
  });
  return backupPath === undefined
    ? { status: "adopted" }
    : { status: "adopted", backupPath };
}
