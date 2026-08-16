import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CrashStore } from "../src/crash-store.js";
import { StructuredLogger } from "../src/logger.js";
import { redactLogString, redactLogValue } from "../src/redaction.js";
import { validateLaunchTarget } from "../src/validation.js";
import { Watchdog } from "../src/watchdog.js";

const temporaryPaths: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "deepseek-watchdog-"));
  temporaryPaths.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("watchdog process contract", () => {
  it("acknowledges shutdown before the normal parent disconnect and never relaunches", async () => {
    const directory = await temporaryDirectory();
    const launches: Array<{ executable: string; args: readonly string[] }> = [];
    const acknowledgements: unknown[] = [];
    const watchdog = new Watchdog({
      executable:
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      args: ["--restore-session"],
      crashStore: new CrashStore(join(directory, "crashes.json")),
      now: () => 1_000,
      schedule: () => undefined,
      launch: (executable, args) => launches.push({ executable, args }),
      notify: (message) => acknowledgements.push(message),
    });

    watchdog.receive("shutdown");
    watchdog.disconnect();

    expect(launches).toEqual([]);
    expect(acknowledgements).toEqual(["shutdown-ack"]);
  });

  it("relaunches an abnormal disconnect with the fixed executable and argument vector", async () => {
    const directory = await temporaryDirectory();
    const launches: Array<{ executable: string; args: readonly string[] }> = [];
    const scheduled: number[] = [];
    const watchdog = new Watchdog({
      executable:
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      args: ["--restore-session", "--profile", "default"],
      crashStore: new CrashStore(join(directory, "crashes.json")),
      now: () => 1_000,
      schedule: (callback, delayMs) => {
        scheduled.push(delayMs);
        callback();
      },
      launch: (executable, args) => launches.push({ executable, args }),
    });

    watchdog.disconnect();

    expect(scheduled).toEqual([1_000]);
    expect(launches).toEqual([
      {
        executable:
          "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        args: ["--restore-session", "--profile", "default"],
      },
    ]);
  });

  it("persists crashes across watchdog instances and opens the circuit on the third crash in five minutes", async () => {
    const directory = await temporaryDirectory();
    const markerPath = join(directory, "crash-loop.json");
    const crashPath = join(directory, "crashes.json");
    const decisions: string[] = [];
    const createWatchdog = (time: number) =>
      new Watchdog({
        executable:
          "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        args: [],
        crashStore: new CrashStore(crashPath, markerPath),
        now: () => time,
        schedule: () => decisions.push("restart"),
        launch: () => undefined,
      });

    createWatchdog(1_000).disconnect();
    createWatchdog(2_000).disconnect();
    createWatchdog(3_000).disconnect();

    expect(decisions).toEqual(["restart", "restart"]);
    expect(JSON.parse(await readFile(markerPath, "utf8"))).toMatchObject({
      reason: "crash-loop",
      crashCount: 3,
      openedAt: 3_000,
    });
  });

  it("expires old persisted crashes before calculating the next backoff", async () => {
    const directory = await temporaryDirectory();
    const crashPath = join(directory, "crashes.json");
    const scheduled: number[] = [];
    const first = new Watchdog({
      executable:
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      args: [],
      crashStore: new CrashStore(crashPath),
      now: () => 1_000,
      schedule: (_callback, delayMs) => scheduled.push(delayMs),
      launch: () => undefined,
    });
    first.disconnect();
    const later = new Watchdog({
      executable:
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      args: [],
      crashStore: new CrashStore(crashPath),
      now: () => 301_001,
      schedule: (_callback, delayMs) => scheduled.push(delayMs),
      launch: () => undefined,
    });

    later.disconnect();

    expect(scheduled).toEqual([1_000, 1_000]);
  });
});

describe("watchdog safety and diagnostics", () => {
  it("rejects relative executables, empty arguments, and paths outside the validated root", () => {
    expect(() => validateLaunchTarget("DeepSeek Harness", [])).toThrow(
      /absolute executable/i,
    );
    expect(() =>
      validateLaunchTarget(
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        [""],
      ),
    ).toThrow(/non-empty strings/i);
    expect(
      () =>
        new CrashStore(
          "/tmp/outside/crashes.json",
          "/tmp/other/crash-loop.json",
        ),
    ).toThrow(/same directory/i);
  });

  it("rotates structured logs at the configured byte limit and retains only five files", async () => {
    const directory = await temporaryDirectory();
    const logger = new StructuredLogger(join(directory, "watchdog.log"), {
      maxBytes: 80,
      maxFiles: 5,
    });

    for (let index = 0; index < 7; index += 1) {
      await logger.write("watchdog-event", { index, detail: "x".repeat(64) });
    }

    expect(await logger.listFiles()).toEqual([
      join(directory, "watchdog.log"),
      join(directory, "watchdog.log.1"),
      join(directory, "watchdog.log.2"),
      join(directory, "watchdog.log.3"),
      join(directory, "watchdog.log.4"),
    ]);
  });

  it("truncates a single oversized log event so that no file exceeds its byte limit", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "watchdog.log");
    const logger = new StructuredLogger(path, { maxBytes: 80, maxFiles: 5 });

    await logger.write("watchdog-event", { detail: "x".repeat(200) });

    const content = await readFile(path, "utf8");
    expect(Buffer.byteLength(content)).toBeLessThanOrEqual(80);
    expect(JSON.parse(content)).toMatchObject({ truncated: true });
  });

  it("redacts free-form secrets, URL query secrets, and structured request bodies before logging", () => {
    expect(
      redactLogString(
        "Authorization: Bearer top-secret Cookie=sid-secret https://localhost/?api_key=query-secret request body: private prompt",
      ),
    ).toBe(
      "Authorization: [REDACTED] Cookie=[REDACTED] https://localhost/?api_key=[REDACTED] request body: [REDACTED]",
    );
    expect(
      redactLogValue({
        message: "response body: model output",
        nested: { credentialPath: "/Users/person/.config/credentials.json" },
      }),
    ).toEqual({
      message: "response body: [REDACTED]",
      nested: { credentialPath: "[REDACTED]" },
    });
  });
});
