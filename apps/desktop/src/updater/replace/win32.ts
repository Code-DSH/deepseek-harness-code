import { spawn, type ChildProcess } from "node:child_process";

import type { ReplaceFn } from "../updater.js";

export interface Win32ReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
}

/**
 * Minimal Windows replace: run the NSIS installer silently. electron-builder's
 * NSIS installer detects the running app, closes it, installs, and relaunches
 * when invoked with `/S`. The host exits so the installer can replace the
 * in-use binaries. (Verified on macOS for the dispatch path only; full Windows
 * validation is deferred to a Windows environment.)
 */
export function createWin32Replace(options: Win32ReplaceOptions): ReplaceFn {
  const doSpawn = options.spawn ?? spawn;
  return async (asset, downloadedPath) => {
    if (asset.format !== "nsis") {
      throw new Error(
        `updater/win32: unsupported asset format ${asset.format} (expected nsis)`,
      );
    }
    const child: ChildProcess = doSpawn(
      downloadedPath,
      ["/S", "--force-close"],
      { detached: true, stdio: "ignore", shell: false },
    );
    child.unref();
    options.exit();
  };
}
