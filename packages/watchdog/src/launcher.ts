import { normalize } from "node:path";
import { spawn } from "node:child_process";

import {
  validateAbsoluteFilePath,
  validateLaunchTarget,
  validatePathWithinRoot,
  validateSiblingFilePaths,
  type LaunchTarget,
} from "./validation.js";

export interface WatchdogLauncherOptions {
  electronExecutable: string;
  watchdogEntry: string;
  target: LaunchTarget;
  statePath: string;
  markerPath: string;
  logPath: string;
  rootPath: string;
}

export interface WatchdogHandshake {
  shutdown(timeoutMs?: number): Promise<WatchdogShutdownResult>;
  disconnect(): void;
}

export type WatchdogShutdownResult =
  | { readonly status: "acknowledged" }
  | { readonly status: "timed-out" };

export function launchWatchdog(
  options: WatchdogLauncherOptions,
  spawnProcess = spawn,
): WatchdogHandshake {
  const electronExecutable = validateAbsoluteFilePath(
    options.electronExecutable,
    "Electron executable",
  );
  const watchdogEntry = validateAbsoluteFilePath(
    options.watchdogEntry,
    "watchdog entry",
  );
  const target = validateLaunchTarget(
    options.target.executable,
    options.target.args,
  );
  const [statePath, markerPath] = validateSiblingFilePaths(
    options.statePath,
    options.markerPath,
    "watchdog state",
  );
  validatePathWithinRoot(options.rootPath, statePath, "watchdog state path");
  validatePathWithinRoot(options.rootPath, markerPath, "watchdog marker path");
  const logPath = validatePathWithinRoot(
    options.rootPath,
    options.logPath,
    "log path",
  );
  const child = spawnProcess(
    electronExecutable,
    [
      watchdogEntry,
      "--target-executable",
      target.executable,
      "--target-args-json",
      JSON.stringify(target.args),
      "--state-path",
      statePath,
      "--marker-path",
      markerPath,
      "--log-path",
      logPath,
      "--root-path",
      normalize(options.rootPath),
    ],
    {
      detached: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      shell: false,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  child.on("error", () => undefined);
  let pendingShutdown: Promise<WatchdogShutdownResult> | undefined;
  return {
    shutdown(timeoutMs = 1_000): Promise<WatchdogShutdownResult> {
      if (pendingShutdown) return pendingShutdown;
      if (!child.connected) return Promise.resolve({ status: "timed-out" });
      pendingShutdown = new Promise<WatchdogShutdownResult>((resolve) => {
        let completed = false;
        const complete = (
          status: WatchdogShutdownResult["status"] = "acknowledged",
        ) => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          child.off("message", onMessage);
          if (child.connected) child.disconnect();
          resolve({ status });
        };
        const onMessage = (message: unknown) => {
          if (message === "shutdown-ack") complete();
        };
        const timeout = setTimeout(
          () => complete("timed-out"),
          Math.max(0, timeoutMs),
        );
        child.once("error", () => complete("timed-out"));
        child.on("message", onMessage);
        try {
          child.send("shutdown");
        } catch {
          complete("timed-out");
        }
      });
      return pendingShutdown;
    },
    disconnect(): void {
      if (child.connected) child.disconnect();
    },
  };
}
