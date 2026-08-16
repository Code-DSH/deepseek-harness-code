import {
  lstat,
  mkdir,
  readFile,
  readlink,
  realpath,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const DESKTOP_PACKAGE_NAME = "deepseek-harness-desktop-plugin";
const ANCHORED_PACKAGE_NAME = "dsh-anchored-standard";
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
 * Expose the packaged plugin through the dedicated Harness profile's normal
 * Node package resolution without invoking pnpm or mutating the application.
 */
async function ensurePluginLink(
  dshHome: string,
  pluginRoot: string,
  packageName: string,
): Promise<string> {
  const canonicalPluginRoot = await realpath(pluginRoot);
  const modulesRoot = join(dshHome, "profiles", "web", "node_modules");
  const linkPath = join(modulesRoot, packageName);
  await mkdir(modulesRoot, { recursive: true, mode: 0o700 });
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

export async function ensureAnchoredStandardPluginLink(
  dshHome: string,
  pluginRoot: string,
): Promise<string> {
  return ensurePluginLink(dshHome, pluginRoot, ANCHORED_PACKAGE_NAME);
}

/** Ensure the app-owned Web profile loads the desktop package as a standard dsh bundle. */
export async function ensureDesktopPluginBundle(
  dshHome: string,
  options: { anchoredStandard: boolean },
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
  const integratedBundles = options.anchoredStandard
    ? [DESKTOP_PACKAGE_NAME, ANCHORED_PACKAGE_NAME]
    : [DESKTOP_PACKAGE_NAME];
  profile.bundles = [
    ...new Set([...OFFICIAL_WEB_BUNDLES, ...existing, ...integratedBundles]),
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
