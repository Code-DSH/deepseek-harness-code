import { spawn } from "node:child_process";

import type { ReplaceFn } from "../updater.js";
import { createDarwinReplace } from "./darwin.js";
import { createLinuxReplace } from "./linux.js";
import { createWin32Replace } from "./win32.js";

export interface PlatformReplaceOptions {
  exit: () => void;
  spawn?: typeof spawn;
}

/**
 * Select the platform-specific ReplaceFn. The host builds this once and passes
 * it as `UpdaterDeps.replace`; `applyUpdate` invokes it only after the
 * installer bytes are downloaded and sha256-verified.
 */
export function createPlatformReplace(
  options: PlatformReplaceOptions,
): ReplaceFn {
  switch (process.platform) {
    case "darwin":
      return createDarwinReplace(options);
    case "win32":
      return createWin32Replace(options);
    case "linux":
      return createLinuxReplace(options);
    default:
      throw new Error(`updater: unsupported platform ${process.platform}`);
  }
}
