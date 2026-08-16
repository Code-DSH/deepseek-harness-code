import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  WatchdogHost,
  createWatchdogLaunchOptions,
  type WatchdogLaunchContext,
} from "../../apps/desktop/src/lifecycle/watchdog-host.js";

const baseContext: WatchdogLaunchContext = {
  appPath: "/repo",
  resourcesPath: "/resources",
  userDataPath: "/Users/test/Library/Application Support/DeepSeek Harness",
  electronExecutable:
    "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
  isPackaged: false,
};

const watchdogRoot = join(
  "/Users/test/Library/Application Support/DeepSeek Harness",
  "watchdog",
);

describe("desktop watchdog host adapter", () => {
  it("uses development paths and passes the app path to the restarted target", () => {
    expect(createWatchdogLaunchOptions(baseContext)).toMatchObject({
      watchdogEntry: join("/repo", "dist", "watchdog", "entry.js"),
      target: { executable: baseContext.electronExecutable, args: ["/repo"] },
      rootPath: watchdogRoot,
      statePath: join(watchdogRoot, "state", "watchdog.json"),
      markerPath: join(watchdogRoot, "state", "abnormal-exit.marker"),
      logPath: join(watchdogRoot, "logs", "watchdog.log"),
    });
  });

  it("uses packaged resources and no target arguments for a packaged app", () => {
    expect(
      createWatchdogLaunchOptions({ ...baseContext, isPackaged: true }),
    ).toMatchObject({
      watchdogEntry: join("/resources", "watchdog", "entry.js"),
      target: { executable: baseContext.electronExecutable, args: [] },
    });
  });

  it("launches at most one watchdog and reports a synchronous launch failure", () => {
    const handshake = {
      shutdown: vi.fn(async () => undefined),
      disconnect: vi.fn(),
    };
    const launcher = vi.fn(() => handshake);
    const host = new WatchdogHost(baseContext, launcher);

    expect(host.start()).toEqual({ status: "launched" });
    expect(host.start()).toEqual({ status: "already-running" });
    expect(launcher).toHaveBeenCalledTimes(1);

    const failed = new WatchdogHost(baseContext, () => {
      throw new Error("entry missing");
    });
    expect(failed.start()).toMatchObject({
      status: "failed",
      diagnostic: "entry missing",
    });
  });

  it("awaits the shutdown handshake before disconnecting and never repeats it", async () => {
    const events: string[] = [];
    const handshake = {
      shutdown: vi.fn(async () => {
        events.push("ack");
      }),
      disconnect: vi.fn(() => {
        events.push("disconnect");
      }),
    };
    const host = new WatchdogHost(baseContext, () => handshake);
    host.start();

    await Promise.all([host.shutdown(), host.shutdown()]);

    expect(events).toEqual(["ack", "disconnect"]);
    expect(handshake.shutdown).toHaveBeenCalledOnce();
    expect(handshake.disconnect).toHaveBeenCalledOnce();
  });
});
