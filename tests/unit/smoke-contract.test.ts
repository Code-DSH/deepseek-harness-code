import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { writeEvidenceAtomically } from "../../apps/desktop/src/lifecycle/atomic-evidence.js";
import * as smokeContract from "../../apps/desktop/src/lifecycle/smoke-contract.js";

import {
  buildSmokeFinalEvidence,
  buildSmokeReadyEvidence,
  awaitSmokeAcknowledgement,
  completeSmokeShutdown,
  isEvidencePathWithinRoot,
  parseSmokeConfig,
  resolveApplicationUserDataPath,
  validateSmokeRuntimeProvenance,
} from "../../apps/desktop/src/lifecycle/smoke-contract.js";

const smokeMetadata = {
  matrixLabel: "windows-x64" as const,
  packageKind: "nsis",
  expectedArchitecture: "x64",
  artifactFilename: "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
  artifactSha256: "a".repeat(64),
  startedAt: "2026-08-19T00:00:00.000Z",
};

const smokeConfig = {
  path: "/tmp/smoke.json",
  root: "/tmp",
  userDataPath: "/tmp/smoke-user-data",
  runId: "run-1234",
  scenario: "runtime" as const,
  ...smokeMetadata,
};

const smokeEnv = {
  SMOKE_USER_DATA_PATH: "/tmp/smoke-user-data",
  MATRIX_LABEL: smokeMetadata.matrixLabel,
  PACKAGE_KIND: smokeMetadata.packageKind,
  EXPECTED_ARCHITECTURE: smokeMetadata.expectedArchitecture,
  ARTIFACT_FILENAME: smokeMetadata.artifactFilename,
  ARTIFACT_SHA256: smokeMetadata.artifactSha256,
  SMOKE_STARTED_AT: smokeMetadata.startedAt,
};

type NodeRequiredContract = {
  buildSmokeNodeRequiredEvidence: (
    config: Omit<typeof smokeConfig, "scenario"> & {
      scenario: "node-required";
    },
    runtime: {
      platform: NodeJS.Platform;
      architecture: string;
      appPid: number;
    },
  ) => Record<string, unknown>;
  resolveStartupSystemNode: <T>(
    config: { scenario: "runtime" | "node-required" } | undefined,
    resolver: () => T,
  ) => { mode: "runtime"; node: T } | { mode: "node-required" };
  shouldCreateWindowOnActivate: (
    nodeRequiredSmokeActive: boolean,
    windowCount: number,
  ) => boolean;
};

function nodeRequiredContract(): NodeRequiredContract {
  const contract = smokeContract as unknown as Partial<NodeRequiredContract>;
  expect(contract.buildSmokeNodeRequiredEvidence).toBeTypeOf("function");
  expect(contract.resolveStartupSystemNode).toBeTypeOf("function");
  expect(contract.shouldCreateWindowOnActivate).toBeTypeOf("function");
  return contract as NodeRequiredContract;
}

describe("application-owned smoke contract", () => {
  it("is disabled unless CI mode and an allowed runtime are both explicit", () => {
    expect(parseSmokeConfig({})).toBeUndefined();
    expect(
      parseSmokeConfig({
        SMOKE_MODE: "ci",
        SMOKE_EVIDENCE_PATH: "relative.json",
      }),
    ).toBeUndefined();
    expect(
      parseSmokeConfig({
        SMOKE_MODE: "ci",
        SMOKE_EVIDENCE_ROOT: "/tmp",
        SMOKE_EVIDENCE_PATH: "/tmp/smoke.json",
        SMOKE_RUN_ID: "run-1",
      }),
    ).toBeUndefined();
  });

  it("parses an absolute evidence path only for packaged CI smoke", () => {
    const config = parseSmokeConfig(
      {
        SMOKE_MODE: "ci",
        SMOKE_EVIDENCE_ROOT: "/tmp",
        SMOKE_EVIDENCE_PATH: "/tmp/smoke.json",
        SMOKE_RUN_ID: "run-1234",
        ...smokeEnv,
      },
      { isPackaged: true },
    );

    expect(config).toEqual({
      path: "/tmp/smoke.json",
      root: "/tmp",
      userDataPath: "/tmp/smoke-user-data",
      acknowledgementPath: "/tmp/smoke.json.ack",
      runId: "run-1234",
      scenario: "runtime",
      ...smokeMetadata,
    });
  });

  it("accepts node-required only for a fully validated packaged smoke", () => {
    const env = {
      SMOKE_MODE: "ci",
      SMOKE_SCENARIO: "node-required",
      SMOKE_ALLOW_UNPACKAGED: "1",
      SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
      SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
      SMOKE_RUN_ID: "run-node-required",
      ...smokeEnv,
      SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
    };

    expect(parseSmokeConfig(env)).toBeUndefined();
    expect(parseSmokeConfig(env, { isPackaged: true })).toMatchObject({
      scenario: "node-required",
      runId: "run-node-required",
      matrixLabel: "windows-x64",
      packageKind: "nsis",
      expectedArchitecture: "x64",
    });
    expect(
      parseSmokeConfig(
        { ...env, SMOKE_SCENARIO: "download-node" },
        { isPackaged: true },
      ),
    ).toBeUndefined();
  });

  it("calls the real resolver and activates node-required only when it is missing", () => {
    const contract = nodeRequiredContract();
    const missingResolver = vi.fn(() => undefined);
    const nodeRequiredConfig = parseSmokeConfig(
      {
        SMOKE_MODE: "ci",
        SMOKE_SCENARIO: "node-required",
        SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
        SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
        SMOKE_RUN_ID: "run-node-required",
        ...smokeEnv,
        SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
      },
      { isPackaged: true },
    );

    expect(nodeRequiredConfig).toBeDefined();
    expect(
      contract.resolveStartupSystemNode(nodeRequiredConfig, missingResolver),
    ).toEqual({ mode: "node-required" });
    expect(missingResolver).toHaveBeenCalledTimes(1);
  });

  it("uses a discovered production Node despite a complete node-required environment", () => {
    const contract = nodeRequiredContract();
    const node = { executable: "/usr/bin/node", version: "24.1.0" };
    const resolver = vi.fn(() => node);

    expect(
      contract.resolveStartupSystemNode(
        { ...smokeConfig, scenario: "node-required" },
        resolver,
      ),
    ).toEqual({ mode: "runtime", node });
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("never recreates a window from macOS activate during node-required smoke", () => {
    const contract = nodeRequiredContract();

    expect(contract.shouldCreateWindowOnActivate(true, 0)).toBe(false);
    expect(contract.shouldCreateWindowOnActivate(false, 0)).toBe(true);
    expect(contract.shouldCreateWindowOnActivate(false, 1)).toBe(false);
  });

  it.each([
    [
      "win32",
      "x64",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-x64.msi",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-win-x64.zip",
    ],
    [
      "win32",
      "arm64",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-arm64.msi",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-win-arm64.zip",
    ],
    [
      "darwin",
      "arm64",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0.pkg",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-arm64.tar.gz",
    ],
    [
      "darwin",
      "x64",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0.pkg",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-x64.tar.gz",
    ],
    [
      "linux",
      "x64",
      "https://nodejs.org/en/download",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-x64.tar.xz",
    ],
    [
      "linux",
      "arm64",
      "https://nodejs.org/en/download",
      "https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-arm64.tar.xz",
    ],
  ] as const)(
    "builds explicit no-Harness prerequisite evidence for %s %s",
    (platform, architecture, installerUrl, archiveUrl) => {
      const contract = nodeRequiredContract();
      const evidence = contract.buildSmokeNodeRequiredEvidence(
        { ...smokeConfig, scenario: "node-required" },
        { platform, architecture, appPid: 3001 },
      );

      expect(evidence).toMatchObject({
        phase: "node-required",
        scenario: "node-required",
        minimumNodeVersion: "22.13.0",
        installerUrl,
        archiveUrl,
        platform,
        architecture,
        appPid: 3001,
        packaged: true,
        harnessStarted: false,
        listenerObserved: false,
      });
      expect(evidence).not.toHaveProperty("harnessOrigin");
      expect(evidence).not.toHaveProperty("harnessPid");
      expect(evidence).not.toHaveProperty("listenerPid");
    },
  );

  it("uses only a validated smoke user-data root", () => {
    expect(
      resolveApplicationUserDataPath("/normal/user-data", {
        userDataPath: "/tmp/smoke-user-data",
      }),
    ).toBe("/tmp/smoke-user-data");
    expect(resolveApplicationUserDataPath("/normal/user-data")).toBe(
      "/normal/user-data",
    );
    expect(
      parseSmokeConfig(
        {
          SMOKE_MODE: "ci",
          SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
          SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
          SMOKE_RUN_ID: "run-1234",
          ...smokeEnv,
          SMOKE_USER_DATA_PATH: "/tmp/outside",
        },
        { isPackaged: true },
      ),
    ).toBeUndefined();
  });

  it("builds ready evidence from the exact loopback origin and process IDs", () => {
    const evidence = buildSmokeReadyEvidence(smokeConfig, {
      harnessOrigin: "http://127.0.0.1:41001",
      appPid: 3001,
      harnessPid: 3002,
      listenerPid: 3002,
      readinessProbePassed: true,
      packaged: true,
      resources: ["desktop-plugin/package.json"],
      harnessHome: "/tmp/dsh",
      resourceRoot: "/tmp/resources",
      systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
    });

    expect(evidence).toMatchObject({
      phase: "ready",
      harnessOrigin: "http://127.0.0.1:41001",
      appPid: 3001,
      harnessPid: 3002,
      readinessProbePassed: true,
      packaged: true,
    });
    expect(JSON.stringify(evidence)).not.toMatch(
      /prompt|response|credential|token/i,
    );
  });

  it("builds final evidence only after watchdog ack and Harness retirement", () => {
    const evidence = buildSmokeFinalEvidence(smokeConfig, {
      ready: {
        phase: "ready",
        harnessOrigin: "http://127.0.0.1:41001",
        appPid: 3001,
        harnessPid: 3002,
        listenerPid: 3002,
        readinessProbePassed: true,
        packaged: true,
        ...smokeMetadata,
        resources: ["desktop-plugin/package.json"],
        runId: "run-1234",
        harnessHome: "/tmp/dsh",
        resourceRoot: "/tmp/resources",
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
        timestamps: { readyAt: "2026-08-19T00:00:00.000Z" },
      },
      watchdogAcked: true,
      harnessRetired: true,
    });

    expect(evidence).toMatchObject({
      phase: "final",
      appPid: 3001,
      harnessPid: 3002,
      listenerPid: 3002,
      watchdogAcked: true,
      harnessRetired: true,
    });
  });

  it("rejects smoke configuration without an externally supplied run nonce", () => {
    expect(
      parseSmokeConfig(
        {
          SMOKE_MODE: "ci",
          SMOKE_EVIDENCE_ROOT: "/tmp",
          SMOKE_EVIDENCE_PATH: "/tmp/smoke.json",
        },
        { isPackaged: true },
      ),
    ).toBeUndefined();
  });

  it("requires evidence to stay inside the runner-owned evidence root", () => {
    expect(
      parseSmokeConfig(
        {
          SMOKE_MODE: "ci",
          SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
          SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
          SMOKE_RUN_ID: "run-1234",
          ...smokeEnv,
          SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
        },
        { isPackaged: true },
      ),
    ).toEqual({
      path: "/tmp/evidence/run.json",
      root: "/tmp/evidence",
      userDataPath: "/tmp/evidence/user-data",
      acknowledgementPath: "/tmp/evidence/run.json.ack",
      runId: "run-1234",
      scenario: "runtime",
      ...smokeMetadata,
    });
    expect(
      parseSmokeConfig(
        {
          SMOKE_MODE: "ci",
          SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
          SMOKE_EVIDENCE_PATH: "/tmp/other/run.json",
          SMOKE_RUN_ID: "run-1234",
          ...smokeEnv,
          SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
        },
        { isPackaged: true },
      ),
    ).toBeUndefined();
    expect(
      isEvidencePathWithinRoot("/tmp/evidence/link/run.json", "/tmp/evidence"),
    ).toBe(true);
  });

  it("records runtime provenance and system Node metadata", () => {
    const evidence = buildSmokeReadyEvidence(smokeConfig, {
      harnessOrigin: "http://127.0.0.1:41001",
      appPid: 3001,
      harnessPid: 3002,
      listenerPid: 3002,
      readinessProbePassed: true,
      packaged: true,
      resources: ["desktop-plugin/package.json"],
      harnessHome: "/tmp/dsh",
      resourceRoot: "/tmp/resources",
      systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
    });

    expect(evidence).toMatchObject({
      harnessHome: "/tmp/dsh",
      resourceRoot: "/tmp/resources",
      systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
      timestamps: { readyAt: expect.any(String) },
    });
  });

  it("requires an allowlisted package matrix in CI smoke configuration", () => {
    expect(
      parseSmokeConfig({
        SMOKE_MODE: "ci",
        SMOKE_ALLOW_UNPACKAGED: "1",
        SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
        SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
        SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
        SMOKE_RUN_ID: "run-1234",
        MATRIX_LABEL: "windows-x64",
        PACKAGE_KIND: "nsis",
        EXPECTED_ARCHITECTURE: "x64",
        ARTIFACT_FILENAME:
          "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
        ARTIFACT_SHA256: "a".repeat(64),
        SMOKE_STARTED_AT: "2026-08-19T00:00:00.000Z",
      }),
    ).toMatchObject({
      matrixLabel: "windows-x64",
      packageKind: "nsis",
      expectedArchitecture: "x64",
      artifactFilename:
        "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
      artifactSha256: "a".repeat(64),
      startedAt: "2026-08-19T00:00:00.000Z",
    });
    expect(
      parseSmokeConfig({
        SMOKE_MODE: "ci",
        SMOKE_ALLOW_UNPACKAGED: "1",
        SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
        SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
        SMOKE_USER_DATA_PATH: "/tmp/evidence/user-data",
        SMOKE_RUN_ID: "run-1234",
        MATRIX_LABEL: "unknown",
        PACKAGE_KIND: "nsis",
        EXPECTED_ARCHITECTURE: "x64",
        ARTIFACT_FILENAME: "misleading-x64.txt",
        ARTIFACT_SHA256: "a".repeat(64),
        SMOKE_STARTED_AT: "2026-08-19T00:00:00.000Z",
      }),
    ).toBeUndefined();
  });

  it("rejects packaged smoke configuration without artifact metadata", () => {
    expect(
      parseSmokeConfig(
        {
          SMOKE_MODE: "ci",
          SMOKE_EVIDENCE_ROOT: "/tmp/evidence",
          SMOKE_EVIDENCE_PATH: "/tmp/evidence/run.json",
          SMOKE_RUN_ID: "run-1234",
        },
        { isPackaged: true },
      ),
    ).toBeUndefined();
  });

  it("rejects runtime provenance outside its isolated resource root", () => {
    expect(() =>
      validateSmokeRuntimeProvenance(
        {
          harnessHome: "/tmp/isolated/home",
          resourceRoot: "/tmp/resources",
          systemNode: {
            executable: "/definitely/missing/node",
            version: "24.1.0",
          },
        },
        ["/tmp/isolated", "/tmp/resources"],
      ),
    ).toThrow(/Node|executable|existing/i);
  });

  it("waits between malformed acknowledgements before timing out", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-ack-"));
    const acknowledgementPath = join(root, "ready.json.ack");
    await writeFile(acknowledgementPath, "{malformed", "utf8");
    let now = 0;
    const requestQuit = vi.fn();
    const delay = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });

    await expect(
      awaitSmokeAcknowledgement(
        {
          acknowledgementPath,
          runId: "run-1234",
          appPid: 3001,
          timeoutMs: 300,
          pollIntervalMs: 100,
        },
        { now: () => now, delay, requestQuit },
      ),
    ).rejects.toThrow("packaged smoke ready acknowledgement timed out");
    expect(delay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      100, 100, 100,
    ]);
    expect(now).toBe(300);
    expect(requestQuit).not.toHaveBeenCalled();
  });

  it("waits between missing acknowledgements before timing out", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-ack-"));
    let now = 0;
    const requestQuit = vi.fn();
    const delay = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });

    await expect(
      awaitSmokeAcknowledgement(
        {
          acknowledgementPath: join(root, "missing.json.ack"),
          runId: "run-1234",
          appPid: 3001,
          timeoutMs: 200,
          pollIntervalMs: 100,
        },
        { now: () => now, delay, requestQuit },
      ),
    ).rejects.toThrow("packaged smoke ready acknowledgement timed out");
    expect(delay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      100, 100,
    ]);
    expect(now).toBe(200);
    expect(requestQuit).not.toHaveBeenCalled();
  });

  it("requests quit when ready evidence receives its matching acknowledgement", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-ack-"));
    const acknowledgementPath = join(root, "ready.json.ack");
    const ready = buildSmokeReadyEvidence(
      {
        path: join(root, "ready.json"),
        root,
        userDataPath: join(root, "user-data"),
        acknowledgementPath,
        runId: "run-1234",
        scenario: "runtime",
        ...smokeMetadata,
      },
      {
        harnessOrigin: "http://127.0.0.1:41001",
        appPid: 3001,
        harnessPid: 3002,
        listenerPid: 3002,
        readinessProbePassed: true,
        packaged: true,
        resources: ["desktop-plugin/package.json"],
        harnessHome: join(root, "dsh"),
        resourceRoot: join(root, "resources"),
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
      },
    );
    await writeFile(
      acknowledgementPath,
      JSON.stringify({ runId: ready.runId, appPid: ready.appPid }),
      "utf8",
    );
    const delay = vi.fn(async () => undefined);

    const requestQuit = vi.fn();

    await awaitSmokeAcknowledgement(
      {
        acknowledgementPath,
        runId: ready.runId,
        appPid: ready.appPid,
        timeoutMs: 200,
        pollIntervalMs: 100,
      },
      { now: () => 0, delay, requestQuit },
    );

    expect(requestQuit).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(acknowledgementPath, "utf8"))).toEqual({
      runId: "run-1234",
      appPid: 3001,
    });
  });

  it("quits exactly once after final smoke evidence is written", async () => {
    const events: string[] = [];
    const quit = vi.fn(() => events.push("quit"));

    await completeSmokeShutdown({
      writeFinalEvidence: async () => {
        events.push("evidence");
      },
      quit,
      reportFailure: vi.fn(),
    });

    expect(events).toEqual(["evidence", "quit"]);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("reports a bounded redacted evidence failure and still quits once", async () => {
    const quit = vi.fn();
    const reportFailure = vi.fn();

    await completeSmokeShutdown({
      writeFinalEvidence: async () => {
        throw new Error(
          `rename failed api_key=secret-value ${"x".repeat(3_000)}`,
        );
      },
      quit,
      reportFailure,
    });

    expect(quit).toHaveBeenCalledTimes(1);
    expect(reportFailure).toHaveBeenCalledTimes(1);
    const reported = reportFailure.mock.calls[0]?.[0];
    expect(reported).toContain("api_key=[REDACTED]");
    expect(reported).not.toContain("secret-value");
    expect(reported?.length).toBeLessThanOrEqual(2_000);
  });

  it("atomically replaces regular smoke evidence without a residual temporary file", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-write-"));
    const evidencePath = join(root, "evidence.json");
    await writeFile(evidencePath, "old evidence\n", "utf8");

    // When
    await writeEvidenceAtomically(evidencePath, { phase: "ready" });

    // Then
    expect(await readFile(evidencePath, "utf8")).toBe(
      `${JSON.stringify({ phase: "ready" })}\n`,
    );
    expect((await lstat(evidencePath)).isFile()).toBe(true);
    expect(await readdir(root)).toEqual(["evidence.json"]);
  });

  it("rejects a symbolic-link smoke evidence destination without changing its target", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-final-link-"));
    const targetPath = join(root, "target.json");
    const evidencePath = join(root, "evidence.json");
    await writeFile(targetPath, "protected\n", "utf8");
    await symlink(targetPath, evidencePath);

    // When
    const write = writeEvidenceAtomically(evidencePath, { phase: "ready" });

    // Then
    await expect(write).rejects.toThrow(/symbolic link/i);
    expect(await readFile(targetPath, "utf8")).toBe("protected\n");
    expect((await lstat(evidencePath)).isSymbolicLink()).toBe(true);
    expect((await readdir(root)).sort()).toEqual([
      "evidence.json",
      "target.json",
    ]);
  });

  it("rejects an exclusive temporary-path symbolic link without changing its target", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-temp-link-"));
    const evidencePath = join(root, "evidence.json");
    const targetPath = join(root, "target.json");
    const nonce = "fixed-nonce";
    const temporaryPath = `${evidencePath}.${nonce}.tmp`;
    await writeFile(targetPath, "protected\n", "utf8");
    await symlink(targetPath, temporaryPath);

    // When
    const write = writeEvidenceAtomically(
      evidencePath,
      { phase: "ready" },
      { createNonce: () => nonce },
    );

    // Then
    await expect(write).rejects.toThrow();
    expect(await readFile(targetPath, "utf8")).toBe("protected\n");
    expect((await lstat(temporaryPath)).isSymbolicLink()).toBe(true);
    expect(await readdir(root)).not.toContain("evidence.json");
  });

  it("cleans its temporary file when atomic replacement fails", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-rename-fail-"));
    const evidencePath = join(root, "evidence.json");
    const nonce = "rename-failure";
    await writeFile(evidencePath, "old evidence\n", "utf8");

    // When
    const write = writeEvidenceAtomically(
      evidencePath,
      { phase: "final" },
      {
        createNonce: () => nonce,
        rename: async () => {
          throw new Error("forced rename failure");
        },
      },
    );

    // Then
    await expect(write).rejects.toThrow("forced rename failure");
    expect(await readFile(evidencePath, "utf8")).toBe("old evidence\n");
    expect(await readdir(root)).toEqual(["evidence.json"]);
  });

  it("cleans its temporary file when evidence serialization fails", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-write-fail-"));
    const evidencePath = join(root, "evidence.json");
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    await writeFile(evidencePath, "old evidence\n", "utf8");

    // When
    const write = writeEvidenceAtomically(evidencePath, cyclic, {
      createNonce: () => "serialization-failure",
    });

    // Then
    await expect(write).rejects.toThrow();
    expect(await readFile(evidencePath, "utf8")).toBe("old evidence\n");
    expect(await readdir(root)).toEqual(["evidence.json"]);
  });

  it("still quits when a real filesystem evidence write fails", async () => {
    // Given
    const root = await mkdtemp(join(tmpdir(), "dhc-smoke-quit-fail-"));
    const quit = vi.fn();
    const reportFailure = vi.fn();

    // When
    await completeSmokeShutdown({
      writeFinalEvidence: () =>
        writeEvidenceAtomically(root, { phase: "final" }),
      quit,
      reportFailure,
    });

    // Then
    expect(quit).toHaveBeenCalledTimes(1);
    expect(reportFailure).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual([]);
  });
});
