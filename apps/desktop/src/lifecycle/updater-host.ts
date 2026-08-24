import { app } from "electron";
import { join } from "node:path";

import { getUpdaterConfig } from "../updater/updater-config.js";
import { createPlatformReplace } from "../updater/replace/index.js";
import {
  checkForUpdate,
  downloadAndVerifyUpdate,
  type ReplaceFn,
  type UpdaterDeps,
} from "../updater/updater.js";
import type { UpdateAsset } from "../updater/manifest.js";
import type { UpdaterStatus } from "../shared/contracts.js";

export interface UpdaterHostOptions {
  /** Test seam; production uses the platform-specific replacement helper. */
  replace?: ReplaceFn;
  /** Test seam; production stores downloads under Electron's temp directory. */
  tempDir?: string;
  publishStatus?: (status: UpdaterStatus) => void;
}

export interface UpdaterCheckOutcome {
  available: boolean;
  version?: string;
  applied?: boolean;
}

/**
 * Host glue for a user-confirmed update check. There is no background timer or
 * silent replacement: the user explicitly chooses “Update and restart” after
 * the manifest has been fetched and the platform asset has been selected.
 */
export class UpdaterHost {
  private readonly deps: UpdaterDeps;
  private checking = false;
  private pendingAsset: UpdateAsset | undefined;
  private downloadedPath: string | undefined;
  private pendingVersion: string | undefined;
  private pendingNotes: string | undefined;

  constructor(private readonly options: UpdaterHostOptions = {}) {
    const config = getUpdaterConfig();
    this.deps = {
      manifestUrl: config.manifestUrl,
      currentVersion: app.getVersion(),
      platform: process.platform as "darwin" | "win32" | "linux",
      architecture: process.arch === "arm64" ? "arm64" : "x64",
      tempDir:
        options.tempDir ??
        join(app.getPath("temp"), "deepseek-harness-code-updates"),
      replace:
        options.replace ??
        createPlatformReplace({
          exit: () => app.quit(),
        }),
      ...(config.fetchDeps !== undefined
        ? { fetchDeps: config.fetchDeps }
        : {}),
    };
  }

  /** User-initiated informational check. The renderer owns the visible prompt. */
  async check(opts: { silent?: boolean } = {}): Promise<UpdaterCheckOutcome> {
    void opts;
    if (this.checking) return { available: false };
    this.checking = true;
    this.pendingAsset = undefined;
    this.pendingVersion = undefined;
    this.pendingNotes = undefined;
    this.publish({ phase: "checking" });
    try {
      const result = await checkForUpdate(this.deps);
      if (!result.available || result.asset === undefined) {
        this.publish({ phase: "up-to-date" });
        return { available: false };
      }
      const version = result.manifest?.latestVersion ?? "";
      const notes = result.manifest?.notes ?? "";
      this.pendingAsset = result.asset;
      this.pendingVersion = version;
      this.pendingNotes = notes;
      this.publish({ phase: "available", version, notes });
      return { available: true, version };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/404|not found/i.test(message)) {
        this.publish({ phase: "up-to-date" });
        return { available: false };
      }
      process.stderr.write(`updater: check failed: ${message}\n`);
      this.publish({ phase: "failed", error: message.slice(0, 2_000) });
      return { available: false };
    } finally {
      this.checking = false;
    }
  }

  async apply(): Promise<UpdaterCheckOutcome> {
    const asset = this.pendingAsset;
    const version = this.pendingVersion;
    if (asset === undefined || version === undefined) {
      return { available: false };
    }
    try {
      this.downloadedPath = await downloadAndVerifyUpdate(
        this.deps,
        asset,
        (progress) => {
          this.publish({
            phase: progress.phase,
            version,
            notes: this.pendingNotes,
            ...(progress.phase === "downloading"
              ? {
                  downloadedBytes: progress.downloadedBytes,
                  ...(progress.totalBytes === undefined
                    ? {}
                    : { totalBytes: progress.totalBytes }),
                }
              : {}),
          });
        },
      );
      return { available: true, version, applied: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`updater: apply failed: ${message}\n`);
      this.publish({
        phase: "failed",
        version,
        error: message.slice(0, 2_000),
      });
      return { available: false };
    }
  }

  async restart(): Promise<void> {
    if (this.pendingAsset === undefined || this.downloadedPath === undefined) {
      return;
    }
    await this.deps.replace(this.pendingAsset, this.downloadedPath);
  }

  private publish(status: UpdaterStatus): void {
    this.options.publishStatus?.(status);
  }
}
