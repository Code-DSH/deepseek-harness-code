import { app, dialog, type BrowserWindow } from "electron";

import { getUpdaterConfig } from "../updater/updater-config.js";
import { checkForUpdate, type UpdaterCheckDeps } from "../updater/updater.js";

export interface UpdaterHostOptions {
  /** Window to parent update dialogs to (undefined = app-modal). */
  parentWindow?: () => BrowserWindow | undefined;
}

export interface UpdaterCheckOutcome {
  available: boolean;
  version?: string;
}

/**
 * Host glue for the informational update check. BETA2 deliberately does not
 * schedule background checks, download installers, replace the application,
 * or restart it. Installation remains an explicit user action from Releases.
 */
export class UpdaterHost {
  private readonly deps: UpdaterCheckDeps;
  private checking = false;

  constructor(private readonly options: UpdaterHostOptions = {}) {
    const config = getUpdaterConfig();
    this.deps = {
      manifestUrl: config.manifestUrl,
      currentVersion: app.getVersion(),
      platform: process.platform as "darwin" | "win32" | "linux",
      ...(config.fetchDeps !== undefined
        ? { fetchDeps: config.fetchDeps }
        : {}),
    };
  }

  /** User-initiated informational check. `silent` suppresses status dialogs. */
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
      await this.showMessageBox(
        "Update available",
        `A new version ${version} is available. Download it from GitHub Releases to install it.`,
        ["OK"],
        notes,
      );
      return { available: true, version };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A 404 on the manifest means no update manifest is published yet
      // (no release carries update-manifest.json) — treat as "no updates
      // available" rather than a failure, so the manual 检查更新 button does
      // not surface a scary error before a release manifest exists.
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
