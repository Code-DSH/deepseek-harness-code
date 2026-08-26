import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, renameSync, rmSync } from "node:fs";
import { isAbsolute } from "node:path";

import type { ReplaceFn } from "../updater.js";

export interface LinuxReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
  /** Test seam; production uses the Electron executable path. */
  execPath?: string;
  /** Test seam; production uses the process environment. */
  env?: NodeJS.ProcessEnv;
}

/**
 * AppImage launches expose the persistent image through APPIMAGE while
 * process.execPath points into the temporary mounted image. Prefer the
 * persistent path when it is absolute; retain the executable fallback for
 * development runs and non-AppImage Linux launches.
 */
export function resolveLinuxAppImageTarget(
  execPath = process.execPath,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const appImage = env.APPIMAGE;
  return appImage !== undefined && isAbsolute(appImage) ? appImage : execPath;
}

/**
 * Minimal Linux replace for AppImage assets: make the download executable,
 * atomically swap it into the running AppImage's path via rename, and relaunch.
 * `deb` assets are notify-only and not handled here (the host surfaces them as
 * a notification without an automatic apply).
 */
export function createLinuxReplace(options: LinuxReplaceOptions): ReplaceFn {
  const doSpawn = options.spawn ?? spawn;
  return async (asset, downloadedPath) => {
    if (asset.format !== "appimage") {
      throw new Error(
        `updater/linux: unsupported asset format ${asset.format} (only appimage is supported; deb is notify-only)`,
      );
    }
    chmodSync(downloadedPath, 0o755);
    const target = resolveLinuxAppImageTarget(options.execPath, options.env);
    const staging = `${target}.new`;
    const old = `${target}.old`;
    rmSync(staging, { force: true });
    renameSync(downloadedPath, staging);
    rmSync(old, { force: true });
    try {
      renameSync(target, old);
      renameSync(staging, target);
    } catch {
      // Rollback to the running binary if the swap failed.
      try {
        renameSync(staging, target);
      } catch {
        // Best effort.
      }
    }
    const child: ChildProcess = doSpawn(target, [], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    options.exit();
  };
}
