import { app, dialog, type BrowserWindow } from "electron";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createPlatformReplace } from "../updater/replace/index.js";
import { getUpdaterConfig } from "../updater/updater-config.js";
import {
  applyUpdate,
  checkForUpdate,
  type UpdaterDeps,
  type UpdateAsset,
} from "../updater/updater.js";

export interface UpdaterHostOptions {
  /** Window to parent update dialogs to (undefined = app-modal). */
  parentWindow?: () => BrowserWindow | undefined;
}

export interface UpdaterCheckOutcome {
  available: boolean;
  version?: string;
}

/**
 * Host glue for the auto-updater: builds the UpdaterDeps from app state +
 * updater-config, schedules periodic checks, surfaces an available update via
 * a dialog, and applies it on user consent. The actual bundle swap + relaunch
 * happens in the platform ReplaceFn (a detached helper on macOS).
 */
export class UpdaterHost {
  private readonly deps: UpdaterDeps;
  private interval: NodeJS.Timeout | undefined;
  private checking = false;

  constructor(private readonly options: UpdaterHostOptions = {}) {
    const config = getUpdaterConfig();
    const tempDir = join(app.getPath("userData"), "updater-temp");
    mkdirSync(tempDir, { recursive: true });
    this.deps = {
      manifestUrl: config.manifestUrl,
      currentVersion: app.getVersion(),
      platform: process.platform as "darwin" | "win32" | "linux",
      tempDir,
      replace: createPlatformReplace({ exit: () => app.exit(0) }),
      ...(config.fetchDeps !== undefined
        ? { fetchDeps: config.fetchDeps }
        : {}),
    };
  }

  /** Remove leftover staging/helper from a prior run. */
  cleanupTemp(): void {
    const tempDir = this.deps.tempDir;
    try {
      rmSync(join(tempDir, "dsh-update-staging"), {
        recursive: true,
        force: true,
      });
    } catch {
      // Best effort.
    }
    try {
      rmSync(join(tempDir, "dsh-update-helper.sh"), { force: true });
    } catch {
      // Best effort.
    }
  }

  schedule(initialDelayMs = 10_000, intervalMs = 6 * 60 * 60_000): void {
    setTimeout(() => {
      void this.check({ silent: true });
    }, initialDelayMs);
    this.interval = setInterval(() => {
      void this.check({ silent: true });
    }, intervalMs);
  }

  stop(): void {
    if (this.interval !== undefined) clearInterval(this.interval);
    this.interval = undefined;
  }

  /** Manual or automatic check. `silent` skips the "no update" dialog. */
  async check(opts: { silent?: boolean } = {}): Promise<UpdaterCheckOutcome> {
    if (this.checking) return { available: false };
    this.checking = true;
    try {
      const result = await checkForUpdate(this.deps);
      if (!result.available || result.asset === undefined) {
        if (!opts.silent) {
          void this.showMessageBox(
            "No updates available",
            "You are running the latest version.",
            ["OK"],
          );
        }
        return { available: false };
      }
      const version = result.manifest?.latestVersion ?? "";
      const notes = result.manifest?.notes ?? "";
      const apply =
        process.env.DSC_UPDATER_AUTO_APPLY === "1"
          ? true
          : await this.confirmApply(version, notes);
      if (apply) {
        await this.apply(result.asset);
      }
      return { available: true, version };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A 404 on the manifest means no update manifest is published yet
      // (no release carries update-manifest.json) — treat as "no updates
      // available" rather than a failure, so the manual 检查更新 button
      // and the periodic silent check don't surface a scary error.
      if (/404|not found/i.test(message)) {
        if (!opts.silent) {
          void this.showMessageBox(
            "No updates available",
            "You are running the latest version.",
            ["OK"],
          );
        }
        return { available: false };
      }
      process.stderr.write(`updater: check failed: ${message}\n`);
      if (!opts.silent) {
        void this.showMessageBox(
          "Update check failed",
          message.slice(0, 1_000),
          ["OK"],
        );
      }
      return { available: false };
    } finally {
      this.checking = false;
    }
  }

  async apply(asset: UpdateAsset): Promise<void> {
    await applyUpdate(this.deps, asset);
  }

  private async confirmApply(version: string, notes: string): Promise<boolean> {
    const res = await this.showMessageBox(
      "Update available",
      `A new version ${version} is available.`,
      ["Update now", "Later"],
      notes ||
        "The app will download, verify, and restart to apply the update.",
    );
    return res === 0;
  }

  private async showMessageBox(
    title: string,
    message: string,
    buttons: string[],
    detail?: string,
  ): Promise<number> {
    const parent = this.options.parentWindow?.();
    const options = {
      type: "question" as const,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      title,
      message,
      ...(detail === undefined ? {} : { detail }),
    };
    const result =
      parent !== undefined && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
    return result.response;
  }
}
