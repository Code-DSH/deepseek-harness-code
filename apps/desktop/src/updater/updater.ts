import { join } from "node:path";

import {
  downloadInstaller,
  fetchManifest,
  type DownloadProgress,
  type FetchDeps,
} from "./fetch.js";
import {
  platformAsset,
  type UpdateAsset,
  type UpdateArchitecture,
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
  expectedSize?: number,
  onProgress?: (progress: DownloadProgress) => void,
) => Promise<void>;
export type VerifyFn = (path: string, expected: string) => Promise<boolean>;
export type ReplaceFn = (
  asset: UpdateAsset,
  downloadedPath: string,
) => Promise<void>;

export type UpdateProgress =
  | ({ phase: "downloading" } & DownloadProgress)
  | { phase: "verifying" }
  | { phase: "ready-to-restart" };

export interface UpdaterCheckDeps {
  manifestUrl: string;
  currentVersion: string;
  platform: UpdatePlatform;
  architecture?: UpdateArchitecture;
  fetchDeps?: FetchDeps;
}

export interface UpdaterDeps extends UpdaterCheckDeps {
  tempDir: string;
  /** Platform-specific replace + relaunch; supplied by the host. */
  replace: ReplaceFn;
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
  deps: UpdaterCheckDeps,
): Promise<UpdateCheckResult> {
  const manifest = await fetchManifest(deps.manifestUrl, deps.fetchDeps);
  if (!isNewerVersion(manifest.latestVersion, deps.currentVersion)) {
    return { available: false };
  }
  const asset = platformAsset(manifest, deps.platform, deps.architecture);
  return { available: true, manifest, asset };
}

export async function applyUpdate(
  deps: UpdaterDeps,
  asset: UpdateAsset,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
  const dest = await downloadAndVerifyUpdate(deps, asset, onProgress);
  await deps.replace(asset, dest);
}

export async function downloadAndVerifyUpdate(
  deps: UpdaterDeps,
  asset: UpdateAsset,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<string> {
  const download = deps.download ?? downloadInstaller;
  const verify = deps.verify ?? verifySha256;
  const dest = join(deps.tempDir, basenameFromUrl(asset.url));
  onProgress?.({
    phase: "downloading",
    downloadedBytes: 0,
    totalBytes: asset.size,
  });
  await download(asset.url, dest, deps.fetchDeps, asset.size, (progress) =>
    onProgress?.({ phase: "downloading", ...progress }),
  );
  onProgress?.({ phase: "verifying" });
  const ok = await verify(dest, asset.sha256);
  if (!ok) {
    throw new Error(`updater: sha256 mismatch for ${asset.url}`);
  }
  onProgress?.({ phase: "ready-to-restart" });
  return dest;
}
