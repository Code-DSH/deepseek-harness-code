import { join } from "node:path";

import { downloadInstaller, fetchManifest, type FetchDeps } from "./fetch.js";
import {
  platformAsset,
  type UpdateAsset,
  type UpdateManifest,
  type UpdatePlatform,
} from "./manifest.js";
import { isNewerVersion } from "./semver.js";
import { verifySha256 } from "./verify.js";

export type { UpdateAsset } from "./manifest.js";
export type DownloadFn = (
  url: string,
  dest: string,
  deps?: FetchDeps,
) => Promise<void>;
export type VerifyFn = (path: string, expected: string) => Promise<boolean>;
export type ReplaceFn = (
  asset: UpdateAsset,
  downloadedPath: string,
) => Promise<void>;

export interface UpdaterDeps {
  manifestUrl: string;
  currentVersion: string;
  platform: UpdatePlatform;
  tempDir: string;
  /** Platform-specific replace + relaunch; supplied by the host. */
  replace: ReplaceFn;
  fetchDeps?: FetchDeps;
  download?: DownloadFn;
  verify?: VerifyFn;
}

export interface UpdateCheckResult {
  available: boolean;
  manifest?: UpdateManifest;
  asset?: UpdateAsset;
}

function basenameFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? last : "installer";
  } catch {
    return "installer";
  }
}

export async function checkForUpdate(
  deps: UpdaterDeps,
): Promise<UpdateCheckResult> {
  const manifest = await fetchManifest(deps.manifestUrl, deps.fetchDeps);
  if (!isNewerVersion(manifest.latestVersion, deps.currentVersion)) {
    return { available: false };
  }
  const asset = platformAsset(manifest, deps.platform);
  return { available: true, manifest, asset };
}

export async function applyUpdate(
  deps: UpdaterDeps,
  asset: UpdateAsset,
): Promise<void> {
  const download = deps.download ?? downloadInstaller;
  const verify = deps.verify ?? verifySha256;
  const dest = join(deps.tempDir, basenameFromUrl(asset.url));
  await download(asset.url, dest, deps.fetchDeps);
  const ok = await verify(dest, asset.sha256);
  if (!ok) {
    throw new Error(`updater: sha256 mismatch for ${asset.url}`);
  }
  await deps.replace(asset, dest);
}
