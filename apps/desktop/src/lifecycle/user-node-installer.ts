import { exec } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { posix, win32 } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function platformPathOf(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix;
}

/**
 * The directory where the app installs Node for the user.
 * macOS/Linux: `~/.local/share/dsh-node/v<version>/`
 * Windows: `%LOCALAPPDATA%\dsh-node\v<version>\`
 */
export function getInstallDir(
  platform: NodeJS.Platform,
  homeDir: string,
  version: string,
  localAppData?: string,
): string {
  const { join } = platformPathOf(platform);
  const baseDir =
    platform === "win32"
      ? (localAppData ?? join(homeDir, "AppData", "Local"))
      : join(homeDir, ".local", "share");
  return join(baseDir, "dsh-node", `v${version}`);
}

/**
 * The path to the `node` binary inside an app-managed install directory.
 */
export function getNodeBinaryPath(
  platform: NodeJS.Platform,
  installDir: string,
): string {
  const { join } = platformPathOf(platform);
  if (platform === "win32") return join(installDir, "node.exe");
  return join(installDir, "bin", "node");
}

/**
 * Build the `export PATH=...` line for a shell profile on unix.
 */
export function buildPathExport(installDir: string): string {
  return `export PATH="${installDir}/bin:$PATH"`;
}

/**
 * Determine which shell profile file to modify. Returns `undefined` on
 * Windows (the user PATH registry key is used instead).
 */
export function getShellProfilePath(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (platform === "win32") return undefined;
  const { join } = platformPathOf(platform);
  const shell = env.SHELL ?? "";
  if (shell.endsWith("zsh")) return join(homeDir, ".zshrc");
  if (shell.endsWith("bash")) return join(homeDir, ".bashrc");
  return join(homeDir, ".profile");
}

// ── Profile markers (idempotent PATH updates) ────────────────────────

function markerStart(version: string): string {
  return `# >>> dsh-node v${version} >>>`;
}

function markerEnd(version: string): string {
  return `# <<< dsh-node v${version} <<<`;
}

export function buildProfileMarker(version: string): string {
  return markerStart(version);
}

/**
 * Check whether a profile already contains the marker for the given version.
 */
export function hasProfileMarker(content: string, version: string): boolean {
  return content.includes(markerStart(version));
}

// ── Archive extraction ────────────────────────────────────────────────

/**
 * Extract a downloaded Node.js archive to the install directory.
 * - tar.gz / tar.xz: uses the system `tar` command.
 * - zip (Windows): uses PowerShell `Expand-Archive`.
 *
 * The Node.js archive unpacks to `node-v<version>-<platform>-<arch>/` at the
 * top level. The contents are moved into {@link destDir} so the binary lives
 * directly under `destDir/bin/node` (unix) or `destDir\node.exe` (Windows).
 */
export async function extractNodeArchive(
  archivePath: string,
  destDir: string,
  platform: NodeJS.Platform,
): Promise<void> {
  mkdirSync(destDir, { recursive: true });

  if (platform === "win32") {
    // PowerShell Expand-Archive handles .zip
    const psScript = `Expand-Archive -Force -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}'`;
    await execAsync(
      `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
      {
        timeout: 120_000,
      },
    );
    // Move contents from the top-level dir into destDir
    moveArchiveContentsToDest(destDir, platform);
    return;
  }

  // tar.gz / tar.xz — extract, then flatten the top-level directory
  await execAsync(`tar -xf "${archivePath}" -C "${destDir}"`, {
    timeout: 120_000,
  });
  moveArchiveContentsToDest(destDir, platform);
}

function moveArchiveContentsToDest(
  destDir: string,
  platform: NodeJS.Platform,
): void {
  const { join } = platformPathOf(platform);
  // The archive contains a single top-level directory like node-v22.13.0-darwin-arm64/
  try {
    const entries = readdirSync(destDir) as string[];
    const topLevelDir = entries.find((e) => e.startsWith("node-v"));
    if (topLevelDir === undefined) return;
    const sourceDir = join(destDir, topLevelDir);
    const inner = readdirSync(sourceDir) as string[];
    for (const entry of inner) {
      const from = join(sourceDir, entry);
      const to = join(destDir, entry);
      renameSync(from, to);
    }
    rmdirSync(sourceDir);
  } catch {
    // Best-effort flatten; if it fails, the binary may still be found
  }
}

// ── Shell PATH update ─────────────────────────────────────────────────

/**
 * Update the user's shell profile to add the app-managed Node bin directory
 * to PATH. If the marker for the current version already exists, the existing
 * block is replaced. Otherwise, a new block is appended. The original profile
 * is backed up before modification.
 */
export async function updateShellPath(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
  version: string,
  installDir: string,
): Promise<void> {
  if (platform === "win32") {
    await updateWindowsUserPath(installDir);
    return;
  }

  const profilePath = getShellProfilePath(platform, homeDir, env);
  if (profilePath === undefined) return;

  let content = "";
  try {
    content = readFileSync(profilePath, "utf8");
  } catch {
    // Profile doesn't exist yet — create it
  }

  // Back up the existing profile
  if (existsSync(profilePath)) {
    copyFileSync(profilePath, `${profilePath}.dsh-backup`);
  }

  const pathExport = buildPathExport(installDir);
  const start = markerStart(version);
  const end = markerEnd(version);
  const block = `${start}\n${pathExport}\n${end}`;

  if (hasProfileMarker(content, version)) {
    // Replace the existing block for this version
    const regex = new RegExp(
      `${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`,
      "g",
    );
    content = content.replace(regex, block);
  } else {
    content = content.trimEnd();
    content = content === "" ? block : `${content}\n\n${block}\n`;
  }

  writeFileSync(profilePath, content, { mode: 0o644 });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * On Windows, update the user PATH via the registry to include the
 * app-managed Node directory. Uses `reg query` and `reg add` rather than
 * `setx` (which has a 1024-character limit).
 */
async function updateWindowsUserPath(installDir: string): Promise<void> {
  let currentPath = "";
  try {
    const { stdout } = await execAsync(
      `reg query "HKCU\\Environment" /v Path`,
      { timeout: 10_000 },
    );
    const match = stdout.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/s);
    if (match) currentPath = (match[1] ?? "").trim();
  } catch {
    // Path key doesn't exist yet
  }

  if (currentPath.includes(installDir)) return; // already present

  const newPath =
    currentPath === "" ? installDir : `${installDir};${currentPath}`;
  await execAsync(
    `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /f /d "${newPath.replace(/"/g, '\\"')}"`,
    { timeout: 10_000 },
  );
}
