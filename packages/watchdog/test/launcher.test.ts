import { EventEmitter } from "node:events";
import { normalize } from "node:path";

import { describe, expect, it } from "vitest";

import { parseWatchdogCommandLine } from "../src/command-line.js";
import { launchWatchdog } from "../src/launcher.js";
import { createRelaunch } from "../src/runtime.js";

describe("host watchdog launcher contract", () => {
  it("starts Electron in Node mode with inherited IPC and waits for the shutdown acknowledgement before disconnecting", async () => {
    const lifecycle: string[] = [];
    const messages: unknown[] = [];
    const child = Object.assign(new EventEmitter(), {
      connected: true,
      disconnect: () => {
        lifecycle.push("disconnect");
        child.connected = false;
      },
      send: (message: unknown) => {
        lifecycle.push(`send:${String(message)}`);
        messages.push(message);
        if (message === "shutdown") child.emit("message", "shutdown-ack");
      },
    });
    const spawns: unknown[][] = [];
    const handshake = launchWatchdog(
      {
        electronExecutable:
          "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        watchdogEntry:
          "/Applications/DeepSeek Harness.app/Contents/Resources/watchdog/entry.cjs",
        target: {
          executable:
            "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
          args: ["--restore-session"],
        },
        statePath:
          "/Users/person/Library/Application Support/DeepSeek Harness/watchdog-crashes.json",
        markerPath:
          "/Users/person/Library/Application Support/DeepSeek Harness/crash-loop.json",
        logPath:
          "/Users/person/Library/Application Support/DeepSeek Harness/watchdog.log",
        rootPath: "/Users/person/Library/Application Support/DeepSeek Harness",
      },
      (...args: unknown[]) => {
        spawns.push(args);
        return child as never;
      },
    );

    expect(() =>
      child.emit("error", new Error("watchdog child spawn failure")),
    ).not.toThrow();
    await handshake.shutdown(25);

    expect(spawns).toEqual([
      [
        normalize(
          "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        ),
        [
          normalize(
            "/Applications/DeepSeek Harness.app/Contents/Resources/watchdog/entry.cjs",
          ),
          "--target-executable",
          normalize(
            "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
          ),
          "--target-args-json",
          '["--restore-session"]',
          "--state-path",
          normalize(
            "/Users/person/Library/Application Support/DeepSeek Harness/watchdog-crashes.json",
          ),
          "--marker-path",
          normalize(
            "/Users/person/Library/Application Support/DeepSeek Harness/crash-loop.json",
          ),
          "--log-path",
          normalize(
            "/Users/person/Library/Application Support/DeepSeek Harness/watchdog.log",
          ),
          "--root-path",
          normalize(
            "/Users/person/Library/Application Support/DeepSeek Harness",
          ),
        ],
        {
          detached: true,
          env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: "1" }),
          shell: false,
          stdio: ["ignore", "ignore", "ignore", "ipc"],
        },
      ],
    ]);
    expect(messages).toEqual(["shutdown"]);
    expect(lifecycle).toEqual(["send:shutdown", "disconnect"]);
    expect(child.connected).toBe(false);
  });

  it("refuses launcher state, marker, and logs that escape the app-owned root", () => {
    expect(() =>
      launchWatchdog(
        {
          electronExecutable:
            "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
          watchdogEntry:
            "/Applications/DeepSeek Harness.app/Contents/Resources/watchdog/entry.cjs",
          target: {
            executable:
              "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
            args: [],
          },
          statePath: "/tmp/watchdog-crashes.json",
          markerPath: "/tmp/crash-loop.json",
          logPath: "/tmp/watchdog.log",
          rootPath:
            "/Users/person/Library/Application Support/DeepSeek Harness",
        },
        (() => undefined) as never,
      ),
    ).toThrow(/inside the app-owned root/i);
  });

  it("reports a timeout when the watchdog never acknowledges shutdown", async () => {
    const child = Object.assign(new EventEmitter(), {
      connected: true,
      disconnect: () => {
        child.connected = false;
      },
      send: () => undefined,
    });
    const handshake = launchWatchdog(
      {
        electronExecutable: "/app/electron",
        watchdogEntry: "/app/watchdog.js",
        target: { executable: "/app/electron", args: [] },
        statePath: "/app/state.json",
        markerPath: "/app/marker.json",
        logPath: "/app/watchdog.log",
        rootPath: "/app",
      },
      (() => child) as never,
    );

    await expect(handshake.shutdown(1)).resolves.toEqual({
      status: "timed-out",
    });
  });

  it("does not leak inherited Electron Node mode or original arguments during relaunch", async () => {
    const oldNodeMode = process.env.ELECTRON_RUN_AS_NODE;
    process.env.ELECTRON_RUN_AS_NODE = "1";
    const calls: unknown[][] = [];
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
    const relaunch = createRelaunch(
      {
        write: (event, fields = {}) => {
          logs.push({ event, fields });
          return Promise.resolve();
        },
      },
      (...args: unknown[]) => {
        calls.push(args);
        return { unref: () => undefined } as never;
      },
    );

    relaunch(
      "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      [
        "--api-key",
        "secret-value",
        "--api-key=second-secret",
        '["secret-json"]',
      ],
    );
    await Promise.resolve();
    if (oldNodeMode === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
    else process.env.ELECTRON_RUN_AS_NODE = oldNodeMode;

    expect(calls[0]?.[2]).toMatchObject({
      env: expect.not.objectContaining({
        ELECTRON_RUN_AS_NODE: expect.anything(),
      }),
    });
    expect(logs).toEqual([
      {
        event: "relaunch",
        fields: {
          executable:
            "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
          argvCount: 4,
        },
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain("secret");
  });

  it("contains spawn and diagnostics errors without an unhandled rejection", async () => {
    const relaunch = createRelaunch(
      { write: () => Promise.reject(new Error("diagnostic failure")) },
      (() => {
        throw new Error("spawn failure");
      }) as never,
    );

    expect(() =>
      relaunch(
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        [],
      ),
    ).not.toThrow();
    await Promise.resolve();
  });

  it("accepts exactly the validated startup arguments and rejects unknown options", () => {
    expect(
      parseWatchdogCommandLine([
        "--target-executable",
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        "--target-args-json",
        '["--restore-session"]',
        "--state-path",
        "/Users/person/Library/Application Support/DeepSeek Harness/watchdog-crashes.json",
        "--marker-path",
        "/Users/person/Library/Application Support/DeepSeek Harness/crash-loop.json",
        "--log-path",
        "/Users/person/Library/Application Support/DeepSeek Harness/watchdog.log",
        "--root-path",
        "/Users/person/Library/Application Support/DeepSeek Harness",
      ]),
    ).toMatchObject({ args: ["--restore-session"] });
    expect(() =>
      parseWatchdogCommandLine([
        "--target-executable",
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        "--target-args-json",
        "[]",
        "--state-path",
        "/tmp/watchdog-crashes.json",
        "--marker-path",
        "/tmp/crash-loop.json",
        "--log-path",
        "/tmp/watchdog.log",
        "--root-path",
        "/Users/person/Library/Application Support/DeepSeek Harness",
      ]),
    ).toThrow(/inside the app-owned root/i);
    expect(() => parseWatchdogCommandLine(["--unknown", "value"])).toThrow(
      /all watchdog startup arguments/i,
    );
  });
});
