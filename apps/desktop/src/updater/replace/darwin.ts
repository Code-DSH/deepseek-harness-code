import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { ReplaceFn } from "../updater.js";

export interface DarwinInstallPaths {
  bundlePath: string;
  installDir: string;
  appName: string;
}

/**
 * Walk process.execPath up to the enclosing .app bundle root and its parent
 * directory. Refuses transient locations (DMG mount under /Volumes, Gatekeeper
 * translocation under /private/tmp) where an in-place swap would not persist.
 */
export function resolveDarwinInstallPaths(
  execPath: string,
): DarwinInstallPaths {
  const segments = execPath.split("/");
  const appIndex = segments.findIndex((segment) => segment.endsWith(".app"));
  if (appIndex === -1) {
    throw new Error(
      `updater/darwin: not running from a .app bundle: ${execPath}`,
    );
  }
  const appName = segments[appIndex] ?? "";
  const bundlePath = segments.slice(0, appIndex + 1).join("/");
  const installDir = segments.slice(0, appIndex).join("/") || "/";
  if (
    installDir.startsWith("/Volumes/") ||
    installDir.startsWith("/private/tmp/") ||
    installDir.startsWith("/var/folders/")
  ) {
    throw new Error(
      `updater/darwin: refusing to update from a transient path (DMG/translocation): ${installDir}`,
    );
  }
  return { bundlePath, installDir, appName };
}

/** Build the detached bash helper that waits for PID exit, swaps, and relaunches. */
export function buildDarwinHelperScript(input: {
  pid: number;
  newAppPath: string;
  installDir: string;
  appName: string;
}): string {
  const { pid, newAppPath, installDir, appName } = input;
  return `#!/bin/bash
set -u
PID=${pid}
NEW_APP=${JSON.stringify(newAppPath)}
INSTALL_DIR=${JSON.stringify(installDir)}
APP_NAME=${JSON.stringify(appName)}
# Wait for the running app to exit, then a beat for file handles to release.
while kill -0 "$PID" 2>/dev/null; do sleep 0.3; done
sleep 1
cd "$INSTALL_DIR" || exit 1
[ -d "$APP_NAME.old" ] && rm -rf "$APP_NAME.old"
mv "$APP_NAME" "$APP_NAME.old"
if mv "$NEW_APP" "$APP_NAME" 2>/dev/null; then
  xattr -cr "$APP_NAME" 2>/dev/null || true
  rm -rf "$APP_NAME.old" 2>/dev/null || true
  open "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true
  exit 0
else
  mv "$APP_NAME.old" "$APP_NAME" 2>/dev/null || true
  open "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true
  exit 1
fi
`;
}

export function findExtractedAppBasename(stagingDir: string): string {
  const entries = readdirSync(stagingDir).filter((entry) =>
    entry.endsWith(".app"),
  );
  if (entries.length === 0) {
    throw new Error(
      "updater/darwin: no .app bundle found in the extracted update archive",
    );
  }
  return entries[0] ?? "";
}

export interface DarwinReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
}

/**
 * Build a darwin ReplaceFn: extract the verified .app.zip, clear quarantine,
 * spawn a detached helper that waits for this PID to exit, swaps the bundle,
 * clears quarantine again, and relaunches — then exit the current process so
 * the helper can take over. The helper keeps a `.app.old` rollback and
 * restores it if the move fails.
 */
export function createDarwinReplace(options: DarwinReplaceOptions): ReplaceFn {
  const doSpawn = options.spawn ?? spawn;
  return async (asset, downloadedPath) => {
    if (asset.format !== "zip") {
      throw new Error(
        `updater/darwin: unsupported asset format ${asset.format} (only zip is supported)`,
      );
    }
    const { installDir, appName } = resolveDarwinInstallPaths(process.execPath);
    const stagingDir = join(dirname(downloadedPath), "dsh-update-staging");
    rmSync(stagingDir, { recursive: true, force: true });
    mkdirSync(stagingDir, { recursive: true });
    // ditto preserves symlinks/permissions for .app bundles.
    execFileSync("ditto", ["-x", "-k", downloadedPath, stagingDir], {
      stdio: "ignore",
    });
    const extractedApp = findExtractedAppBasename(stagingDir);
    const newAppPath = join(stagingDir, extractedApp);
    // Clear quarantine/extended attributes before the swap.
    try {
      execFileSync("xattr", ["-cr", newAppPath], { stdio: "ignore" });
    } catch {
      // Best effort; the helper clears again after the move.
    }
    const helperPath = join(dirname(downloadedPath), "dsh-update-helper.sh");
    writeFileSync(
      helperPath,
      buildDarwinHelperScript({
        pid: process.pid,
        newAppPath,
        installDir,
        appName,
      }),
      { mode: 0o755 },
    );
    chmodSync(helperPath, 0o755);
    const child: ChildProcess = doSpawn("/bin/bash", [helperPath], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    options.exit();
  };
}
