import { spawn, type ChildProcess } from "node:child_process";
import { win32 as windowsPath } from "node:path";

import type { ReplaceFn } from "../updater.js";

export interface Win32ReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
  /** Test seam; production uses the Electron executable path. */
  execPath?: string;
}

export function resolveWindowsInstallDir(execPath = process.execPath): string {
  return windowsPath.dirname(execPath);
}

/**
 * Minimal Windows replace: run the NSIS installer silently. The explicit
 * `/D=<install-dir>` keeps custom NSIS installation locations stable while the
 * installer closes/replaces the in-use binaries. The host exits so the
 * installer can relaunch the app. (Verified on macOS for the dispatch path
 * only; full Windows validation is deferred to a Windows environment.)
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
      [
        "/S",
        "--force-close",
        `/D=${resolveWindowsInstallDir(options.execPath)}`,
      ],
      { detached: true, stdio: "ignore", shell: false },
    );
    child.unref();
    options.exit();
  };
}
