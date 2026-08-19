import { join } from "node:path";

import {
  launchWatchdog,
  type WatchdogHandshake,
  type WatchdogLauncherOptions,
  type WatchdogShutdownResult,
} from "../../../../packages/watchdog/src/launcher.js";

export interface WatchdogLaunchContext {
  appPath: string;
  resourcesPath: string;
  userDataPath: string;
  electronExecutable: string;
  isPackaged: boolean;
}

export type WatchdogLauncher = (
  options: WatchdogLauncherOptions,
) => WatchdogHandshake;

export type WatchdogStartResult =
  | { status: "launched" }
  | { status: "already-running" }
  | { status: "failed"; diagnostic: string };

export function createWatchdogLaunchOptions(
  context: WatchdogLaunchContext,
): WatchdogLauncherOptions {
  const rootPath = join(context.userDataPath, "watchdog");
  return {
    electronExecutable: context.electronExecutable,
    watchdogEntry: context.isPackaged
      ? join(context.resourcesPath, "watchdog", "entry.js")
      : join(context.appPath, "dist", "watchdog", "entry.js"),
    target: {
      executable: context.electronExecutable,
      args: context.isPackaged ? [] : [context.appPath],
    },
    statePath: join(rootPath, "state", "watchdog.json"),
    markerPath: join(rootPath, "state", "abnormal-exit.marker"),
    logPath: join(rootPath, "logs", "watchdog.log"),
    rootPath,
  };
}

export class WatchdogHost {
  private handshake: WatchdogHandshake | undefined;
  private shutdownInFlight: Promise<WatchdogShutdownResult> | undefined;

  constructor(
    private readonly context: WatchdogLaunchContext,
    private readonly launcher: WatchdogLauncher = launchWatchdog,
  ) {}

  start(): WatchdogStartResult {
    if (this.handshake !== undefined) return { status: "already-running" };
    try {
      this.handshake = this.launcher(createWatchdogLaunchOptions(this.context));
      return { status: "launched" };
    } catch (error) {
      return {
        status: "failed",
        diagnostic:
          error instanceof Error
            ? error.message.slice(0, 2_000)
            : "Watchdog launch failed",
      };
    }
  }

  async shutdown(): Promise<WatchdogShutdownResult> {
    if (this.shutdownInFlight !== undefined) return this.shutdownInFlight;
    const handshake = this.handshake;
    if (handshake === undefined) return { status: "timed-out" };
    this.shutdownInFlight = (async () => {
      try {
        return await handshake.shutdown();
      } finally {
        handshake.disconnect();
      }
    })();
    return this.shutdownInFlight;
  }
}
