import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, renameSync, rmSync } from "node:fs";

import type { ReplaceFn } from "../updater.js";

export interface LinuxReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
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
    const target = process.execPath;
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
