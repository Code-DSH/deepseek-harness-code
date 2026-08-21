import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { EventEmitter } from "node:events";

import { describe, expect, test } from "vitest";

import * as smokeRuntime from "../../scripts/smoke-packaged-runtime.mjs";

import {
  parseLoopbackListeners,
  verifySmokeEvidence,
  assertKnownRunnerArchitecture,
  validateArtifactContract,
  parseWindowsPeMachine,
  buildPackagedSmokeLaunch,
  waitForPackagedExit,
  waitForEvidenceWithExitGrace,
  removeSmokeUserData,
  redactPackagedDiagnostic,
  waitForSmokeAcknowledgement,
} from "../../scripts/smoke-packaged-runtime.mjs";

const {
  assertEvidenceRootAllowed,
  createInterruptHandler,
  writeEvidenceAtomically,
} = smokeRuntime;

const expectedMetadata = {
  runId: "run-1",
  matrixLabel: "windows-x64",
  packageKind: "nsis",
  expectedArchitecture: "x64",
  artifactFilename: "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
  artifactSha256: "a".repeat(64),
  startedAt: "2026-08-19T00:00:00.000Z",
};

function fixtureResourcePath(segments, pathJoin = join) {
  return pathJoin("/tmp/resources", ...segments);
}

function validSmokeEvidence(resources) {
  return {
    schema: 2,
    runId: "run-1",
    startedAt: expectedMetadata.startedAt,
    ready: {
      phase: "ready",
      harnessOrigin: "http://127.0.0.1:41002",
      appPid: 7000,
      harnessPid: 7002,
      listenerPid: 7002,
      readinessProbePassed: true,
      packaged: true,
      ...expectedMetadata,
      resources,
      harnessHome: "/tmp/dsh",
      resourceRoot: "/tmp/resources",
      systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
      timestamps: { readyAt: "2026-08-19T00:00:01.000Z" },
    },
    final: {
      phase: "final",
      harnessOrigin: "http://127.0.0.1:41002",
      appPid: 7000,
      harnessPid: 7002,
      listenerPid: 7002,
      watchdogAcked: true,
      harnessRetired: true,
      ...expectedMetadata,
      resources,
      harnessHome: "/tmp/dsh",
      resourceRoot: "/tmp/resources",
      systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
      timestamps: {
        readyAt: "2026-08-19T00:00:01.000Z",
        finalAt: "2026-08-19T00:07:00.000Z",
      },
    },
  };
}

function requiredRuntimeExport(name) {
  const value = smokeRuntime[name];
  expect(value, `missing packaged smoke export ${name}`).toBeTypeOf("function");
  return value;
}

function validNodeRequiredEvidence() {
  return {
    schema: 2,
    runId: "run-1",
    startedAt: expectedMetadata.startedAt,
    nodeRequired: {
      phase: "node-required",
      scenario: "node-required",
      minimumNodeVersion: "22.13.0",
      installerUrl: "https://nodejs.org/dist/v22.13.0/node-v22.13.0-x64.msi",
      platform: "win32",
      architecture: "x64",
      appPid: 7000,
      packaged: true,
      harnessStarted: false,
      listenerObserved: false,
      ...expectedMetadata,
      timestamps: { nodeRequiredAt: "2026-08-19T00:00:01.000Z" },
    },
  };
}

describe("packaged runtime listener selection", () => {
  test("validates node-required evidence separately from Harness runtime evidence", () => {
    const verifyNodeRequiredEvidence = requiredRuntimeExport(
      "verifyNodeRequiredEvidence",
    );

    expect(
      verifyNodeRequiredEvidence(validNodeRequiredEvidence(), {
        ...expectedMetadata,
        platform: "win32",
        runnerArchitecture: "x64",
        maxDurationMs: 10 * 60_000,
      }),
    ).toEqual({ appPid: 7000, nodeRequiredDurationMs: 1_000 });

    for (const forbidden of ["harnessOrigin", "harnessPid", "listenerPid"]) {
      const evidence = validNodeRequiredEvidence();
      evidence.nodeRequired[forbidden] = forbidden.endsWith("Pid")
        ? 7002
        : "http://127.0.0.1:41002";
      expect(() =>
        verifyNodeRequiredEvidence(evidence, {
          ...expectedMetadata,
          platform: "win32",
          runnerArchitecture: "x64",
        }),
      ).toThrow(/Harness|listener|origin|PID/i);
    }

    for (const mutation of [
      { minimumNodeVersion: "22.12.0" },
      { installerUrl: "https://example.com/node.msi" },
    ]) {
      const evidence = validNodeRequiredEvidence();
      Object.assign(evidence.nodeRequired, mutation);
      expect(() =>
        verifyNodeRequiredEvidence(evidence, {
          ...expectedMetadata,
          platform: "win32",
          runnerArchitecture: "x64",
        }),
      ).toThrow(/official Node installer/i);
    }
  });

  test("removes Node lookup managers and hosted Node paths only for node-required", () => {
    const buildPackagedSmokeEnvironment = requiredRuntimeExport(
      "buildPackagedSmokeEnvironment",
    );
    const env = {
      PATH: "/opt/hostedtoolcache/node/24.18.0/x64/bin:/usr/local/bin:/usr/bin:/bin",
      NVM_DIR: "/home/runner/.nvm",
      VOLTA_HOME: "/home/runner/.volta",
      FNM_DIR: "/home/runner/.fnm",
      NODE_OPTIONS: "--require=/tmp/bootstrap.cjs",
      PNPM_HOME: "/home/runner/.local/share/pnpm",
      KEEP_ME: "yes",
    };

    expect(buildPackagedSmokeEnvironment("linux", env, "runtime")).toEqual(env);
    expect(
      buildPackagedSmokeEnvironment("linux", env, "node-required"),
    ).toEqual({
      PATH: "/usr/local/bin:/usr/bin:/bin",
      KEEP_ME: "yes",
    });
  });

  test("runs runtime and node-required against every installed package form", async () => {
    const workflow = await readFile(
      new URL("../../.github/workflows/package.yml", import.meta.url),
      "utf8",
    );

    for (const evidenceName of [
      "smoke-evidence-windows-node-required.json",
      "smoke-evidence-linux-appimage-node-required.json",
      "smoke-evidence-linux-deb-node-required.json",
      "smoke-evidence-${{ matrix.runner-architecture }}-node-required.json",
    ]) {
      expect(workflow).toContain(evidenceName);
    }
    expect(workflow.match(/--scenario runtime/gu)).toHaveLength(4);
    expect(workflow.match(/--scenario node-required/gu)).toHaveLength(4);
  });

  test("builds positive resource fixtures with platform path semantics", () => {
    expect(
      fixtureResourcePath(["dsh-lan-access", "package.json"], win32.join),
    ).toBe("\\tmp\\resources\\dsh-lan-access\\package.json");
  });

  test("rejects smoke evidence that omits the packaged LAN plugin manifest", () => {
    expect(() =>
      verifySmokeEvidence(
        validSmokeEvidence(["/tmp/resources/desktop-plugin/package.json"]),
        {
          ...expectedMetadata,
          maxDurationMs: 10 * 60_000,
        },
      ),
    ).toThrow(/dsh-lan-access/u);
  });

  test("waits for the packaged app to exit naturally after final evidence", async () => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    const waiting = waitForPackagedExit(child, 100);
    child.exitCode = 0;
    child.emit("exit", 0, null);

    await expect(waiting).resolves.toBe(true);
  });

  test("accepts final evidence written just after a clean process exit", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-final-evidence-"));
    const path = join(root, "final.json");
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    const waiting = waitForEvidenceWithExitGrace({
      path,
      deadline: Date.now() + 1_000,
      runId: "run-final",
      phase: "final",
      child,
      exitGraceMs: 500,
    });
    child.exitCode = 0;
    child.emit("exit", 0, null);
    await writeFile(
      path,
      JSON.stringify({
        schema: 2,
        runId: "run-final",
        final: { phase: "final" },
      }),
    );

    await expect(waiting).resolves.toMatchObject({
      final: { phase: "final" },
    });
  });

  test("retries removal of the isolated smoke user-data directory", async () => {
    let received;
    await removeSmokeUserData("/tmp/isolated-smoke", async (...args) => {
      received = args;
    });

    expect(received).toEqual([
      "/tmp/isolated-smoke",
      {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      },
    ]);
  });

  test("isolates Harness Home and disables only the Linux CI sandbox", () => {
    expect(buildPackagedSmokeLaunch("linux", "/tmp/smoke-user-data")).toEqual({
      args: ["--user-data-dir=/tmp/smoke-user-data", "--no-sandbox"],
      env: { DSH_HOME: "/tmp/smoke-user-data/dsh-home" },
    });
    expect(buildPackagedSmokeLaunch("win32", "C:\\smoke-user-data")).toEqual({
      args: ["--user-data-dir=C:\\smoke-user-data"],
      env: { DSH_HOME: "C:\\smoke-user-data\\dsh-home" },
    });
  });

  test("keeps product smoke runner free of agent metadata paths", async () => {
    const source = await readFile(
      new URL("../../scripts/smoke-packaged-runtime.mjs", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain(".omo");
  });

  test("rejects evidence roots nested under a configured metadata root", async () => {
    const metadataRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-metadata-"));
    const evidenceRoot = join(metadataRoot, "evidence");
    await mkdir(evidenceRoot);

    await expect(
      assertEvidenceRootAllowed(evidenceRoot, metadataRoot),
    ).rejects.toThrow(/metadata root/i);
  });

  test("parses the Windows netstat listener PID without using it for selection", () => {
    const listeners = parseLoopbackListeners(
      "  TCP    127.0.0.1:41002    0.0.0.0:0    LISTENING    7002",
      "win32",
    );

    expect(listeners).toEqual([{ port: 41002, pid: 7002 }]);
  });

  test("selects the native listener command for Windows, Linux, and macOS", () => {
    expect(smokeRuntime.listenerCommand("win32")).toEqual({
      command: "netstat",
      args: ["-ano", "-p", "tcp"],
    });
    expect(smokeRuntime.listenerCommand("linux")).toEqual({
      command: "ss",
      args: ["-ltnp"],
    });
    expect(smokeRuntime.listenerCommand("darwin")).toEqual({
      command: "lsof",
      args: ["-nP", "-iTCP", "-sTCP:LISTEN"],
    });
  });

  test("parses only exact macOS IPv4 loopback listeners with their PID", () => {
    const listeners = parseLoopbackListeners(
      [
        "COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME",
        "node 7002 trip 24u IPv4 0x1 0t0 TCP 127.0.0.1:41002 (LISTEN)",
        "node 7003 trip 25u IPv4 0x2 0t0 TCP *:41003 (LISTEN)",
        "node 7004 trip 26u IPv4 0x3 0t0 TCP 0.0.0.0:41004 (LISTEN)",
        "node 7005 trip 27u IPv6 0x4 0t0 TCP [::1]:41005 (LISTEN)",
      ].join("\n"),
      "darwin",
    );

    expect(listeners).toEqual([{ port: 41002, pid: 7002 }]);
  });

  test("accepts only app-owned ready and final shutdown evidence for this run", () => {
    const evidence = {
      schema: 2,
      runId: "run-1",
      startedAt: "2026-08-19T00:00:00.000Z",
      ready: {
        phase: "ready",
        harnessOrigin: "http://127.0.0.1:41002",
        appPid: 7000,
        harnessPid: 7002,
        listenerPid: 7002,
        readinessProbePassed: true,
        packaged: true,
        ...expectedMetadata,
        resources: [
          fixtureResourcePath(["desktop-plugin", "package.json"]),
          fixtureResourcePath(["dsh-lan-access", "package.json"]),
        ],
        harnessHome: "/tmp/dsh",
        resourceRoot: "/tmp/resources",
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
        timestamps: { readyAt: "2026-08-19T00:00:01.000Z" },
      },
      final: {
        phase: "final",
        harnessOrigin: "http://127.0.0.1:41002",
        appPid: 7000,
        harnessPid: 7002,
        listenerPid: 7002,
        watchdogAcked: true,
        harnessRetired: true,
        ...expectedMetadata,
        resources: [
          fixtureResourcePath(["desktop-plugin", "package.json"]),
          fixtureResourcePath(["dsh-lan-access", "package.json"]),
        ],
        harnessHome: "/tmp/dsh",
        resourceRoot: "/tmp/resources",
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
        timestamps: {
          readyAt: "2026-08-19T00:00:01.000Z",
          finalAt: "2026-08-19T00:07:00.000Z",
        },
      },
    };

    expect(
      verifySmokeEvidence(evidence, {
        ...expectedMetadata,
        maxDurationMs: 10 * 60_000,
      }),
    ).toEqual({
      origin: "http://127.0.0.1:41002",
      appPid: 7000,
      harnessPid: 7002,
      port: 41002,
      readyDurationMs: 1_000,
    });
  });

  test("rejects evidence from a different smoke run", () => {
    expect(() =>
      verifySmokeEvidence({ schema: 2, runId: "old" }, expectedMetadata),
    ).toThrow(/run nonce/i);
  });

  test("rejects evidence when the listener owner differs from Harness", () => {
    expect(() =>
      verifySmokeEvidence(
        {
          schema: 2,
          runId: "run-1",
          startedAt: expectedMetadata.startedAt,
          ready: {
            phase: "ready",
            harnessOrigin: "http://127.0.0.1:41002",
            appPid: 7000,
            harnessPid: 7002,
            listenerPid: 7003,
            readinessProbePassed: true,
            packaged: true,
            ...expectedMetadata,
            resources: ["desktop-plugin/package.json"],
            runId: "run-1",
            harnessHome: "/tmp/dsh",
            resourceRoot: "/tmp/resources",
            systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
            timestamps: {
              readyAt: "2026-08-19T00:00:01.000Z",
              finalAt: "2026-08-19T00:00:02.000Z",
            },
          },
          final: {
            phase: "final",
            harnessOrigin: "http://127.0.0.1:41002",
            appPid: 7000,
            harnessPid: 7002,
            listenerPid: 7003,
            watchdogAcked: true,
            harnessRetired: true,
            ...expectedMetadata,
            harnessHome: "/tmp/dsh",
            resourceRoot: "/tmp/resources",
            systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
            timestamps: {
              readyAt: "2026-08-19T00:00:01.000Z",
              finalAt: "2026-08-19T00:00:02.000Z",
            },
          },
        },
        expectedMetadata,
      ),
    ).toThrow(/listener owner/i);
  });

  test("accepts x64 and arm64 only on every packaged smoke platform", () => {
    for (const platform of ["win32", "linux", "darwin"]) {
      for (const arch of ["x64", "arm64"]) {
        expect(() =>
          assertKnownRunnerArchitecture(platform, arch),
        ).not.toThrow();
      }
    }
    expect(() => assertKnownRunnerArchitecture("win32", "ia32")).toThrow(
      /architecture/i,
    );
    expect(() => assertKnownRunnerArchitecture("linux", "mips64")).toThrow(
      /architecture/i,
    );
    expect(() => assertKnownRunnerArchitecture("freebsd", "x64")).toThrow(
      /platform/i,
    );
  });

  test("inspects native PE x64 and arm64 machine fixtures", async () => {
    for (const [arch, machine] of [
      ["x64", 34404],
      ["arm64", 43620],
    ]) {
      const pe = Buffer.alloc(128);
      pe.writeUInt32LE(64, 60);
      pe.writeUInt16LE(machine, 68);

      await expect(
        smokeRuntime.inspectArchitecture("C:\\DeepSeek Harness Code.exe", {
          platform: "win32",
          arch,
          expectedArchitecture: arch,
          runnerArchitecture: arch,
          readFile: async () => pe,
        }),
      ).resolves.toEqual({
        runner: arch,
        platform: "win32",
        machine: String(machine),
      });
    }
  });

  test("inspects native Linux x86-64 and AArch64 ELF fixtures", async () => {
    for (const [arch, file] of [
      ["x64", "ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV)"],
      ["arm64", "ELF 64-bit LSB pie executable, ARM aarch64, version 1 (SYSV)"],
    ]) {
      await expect(
        smokeRuntime.inspectArchitecture("/opt/deepseek-harness-code", {
          platform: "linux",
          arch,
          expectedArchitecture: arch,
          runnerArchitecture: arch,
          execFile: async () => ({ stdout: `${file}\n` }),
        }),
      ).resolves.toEqual({ runner: arch, platform: "linux", file });
    }
  });

  test("requires both x86_64 and arm64 slices in the macOS executable", async () => {
    const archs = "x86_64 arm64";

    await expect(
      smokeRuntime.inspectArchitecture(
        "/tmp/Applications/DeepSeek Harness Code.app/Contents/MacOS/DeepSeek Harness Code",
        {
          platform: "darwin",
          arch: "arm64",
          expectedArchitecture: "universal",
          runnerArchitecture: "arm64",
          execFile: async () => ({ stdout: `${archs}\n` }),
        },
      ),
    ).resolves.toEqual({
      runner: "arm64",
      platform: "darwin",
      archs,
    });

    await expect(
      smokeRuntime.inspectArchitecture("/tmp/DeepSeek Harness Code", {
        platform: "darwin",
        arch: "x64",
        expectedArchitecture: "universal",
        runnerArchitecture: "x64",
        execFile: async () => ({ stdout: "x86_64\n" }),
      }),
    ).rejects.toThrow(/universal|arm64/i);
  });

  test("rejects Windows and Linux target or host architecture mismatches", async () => {
    await expect(
      smokeRuntime.inspectArchitecture("C:\\DeepSeek Harness Code.exe", {
        platform: "win32",
        arch: "x64",
        expectedArchitecture: "arm64",
        runnerArchitecture: "x64",
        readFile: async () => Buffer.alloc(128),
      }),
    ).rejects.toThrow(/target|expected|runner|architecture/i);

    await expect(
      smokeRuntime.inspectArchitecture("/opt/deepseek-harness-code", {
        platform: "linux",
        arch: "arm64",
        expectedArchitecture: "x64",
        runnerArchitecture: "x64",
        execFile: async () => ({
          stdout: "ELF 64-bit LSB pie executable, x86-64\n",
        }),
      }),
    ).rejects.toThrow(/host|runner|architecture/i);
  });

  test("rejects a macOS smoke matrix that does not match the native host", async () => {
    await expect(
      smokeRuntime.inspectArchitecture("/tmp/DeepSeek Harness Code", {
        platform: "darwin",
        arch: "arm64",
        expectedArchitecture: "universal",
        runnerArchitecture: "x64",
        execFile: async () => ({ stdout: "x86_64 arm64\n" }),
      }),
    ).rejects.toThrow(/host|runner|architecture/i);
  });

  test("validates matrix metadata and artifact filename architecture", () => {
    expect(() =>
      validateArtifactContract({
        matrixLabel: "windows-x64",
        packageKind: "nsis",
        expectedArchitecture: "x64",
        artifactFilename:
          "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
        artifactPath:
          "/tmp/DeepSeek-Harness-Code-0.1.0-windows-arm64-setup.exe",
      }),
    ).toThrow(/architecture|filename/i);
    expect(() =>
      validateArtifactContract({
        matrixLabel: "unknown",
        packageKind: "nsis",
        expectedArchitecture: "x64",
        artifactFilename:
          "DeepSeek-Harness-Code-0.1.0-BETA1-windows-x64-setup.exe",
        artifactPath: "/tmp/DeepSeek-Harness-Code-0.1.0-windows-x64-setup.exe",
      }),
    ).toThrow(/matrix|allowlist/i);
  });

  test("accepts native Linux x64 artifact names and parses a PE machine", () => {
    for (const [packageKind, filename] of [
      ["appimage", "DeepSeek-Harness-Code-0.1.0-BETA2-linux-x86_64.AppImage"],
      ["deb", "DeepSeek-Harness-Code-0.1.0-BETA2-linux-amd64.deb"],
    ]) {
      expect(() =>
        validateArtifactContract({
          matrixLabel: "linux-x64",
          packageKind,
          expectedArchitecture: "x64",
          artifactFilename: filename,
          artifactPath: `/tmp/${filename}`,
        }),
      ).not.toThrow();
    }
    const pe = Buffer.alloc(128);
    pe.writeUInt32LE(64, 60);
    pe.writeUInt16LE(34404, 68);
    expect(parseWindowsPeMachine(pe)).toBe(34404);
  });

  test("bounds and redacts packaged process diagnostics", () => {
    const diagnostic = redactPackagedDiagnostic(
      `${"x".repeat(10_000)} authorization=Bearer-secret token=abc123 password=hunter2 sk-abcdefghijk`,
    );
    expect(diagnostic.length).toBeLessThanOrEqual(8_000);
    expect(diagnostic).not.toContain("Bearer-secret");
    expect(diagnostic).not.toContain("abc123");
    expect(diagnostic).not.toContain("hunter2");
    expect(diagnostic).not.toContain("sk-abcdefghijk");
  });

  test("rejects a misleading architecture substring without the exact package filename", () => {
    expect(() =>
      validateArtifactContract({
        matrixLabel: "windows-x64",
        packageKind: "nsis",
        expectedArchitecture: "x64",
        artifactFilename: "misleading-x64.txt",
        artifactPath: "/tmp/misleading-x64.txt",
      }),
    ).toThrow(/filename|extension/i);
  });

  test("rejects an otherwise valid extension with a misleading artifact stem", () => {
    expect(() =>
      validateArtifactContract({
        matrixLabel: "windows-x64",
        packageKind: "nsis",
        expectedArchitecture: "x64",
        artifactFilename: "DeepSeek-Harness-Code-nightly-windows-x64-setup.exe",
        artifactPath:
          "/tmp/DeepSeek-Harness-Code-nightly-windows-x64-setup.exe",
      }),
    ).toThrow(/filename|extension/i);
  });

  test("rejects evidence without exact artifact metadata", () => {
    const evidence = {
      schema: 2,
      runId: "run-1",
      startedAt: expectedMetadata.startedAt,
      ready: {
        phase: "ready",
        runId: "run-1",
      },
      final: {
        phase: "final",
        runId: "run-1",
      },
    };

    expect(() => verifySmokeEvidence(evidence, expectedMetadata)).toThrow(
      /metadata/i,
    );
  });

  test("rejects ready and final evidence when the artifact SHA metadata is absent", () => {
    const evidence = {
      schema: 2,
      runId: "run-1",
      startedAt: expectedMetadata.startedAt,
      ready: {
        phase: "ready",
        runId: "run-1",
        matrixLabel: expectedMetadata.matrixLabel,
        packageKind: expectedMetadata.packageKind,
        expectedArchitecture: expectedMetadata.expectedArchitecture,
        artifactFilename: expectedMetadata.artifactFilename,
      },
      final: {
        phase: "final",
        runId: "run-1",
        matrixLabel: expectedMetadata.matrixLabel,
        packageKind: expectedMetadata.packageKind,
        expectedArchitecture: expectedMetadata.expectedArchitecture,
        artifactFilename: expectedMetadata.artifactFilename,
      },
    };

    expect(() => verifySmokeEvidence(evidence, expectedMetadata)).toThrow(
      /metadata|artifactSha256/i,
    );
  });

  test("rejects evidence whose echoed hash differs from the independently computed artifact hash", () => {
    const evidence = {
      schema: 2,
      runId: "run-1",
      startedAt: expectedMetadata.startedAt,
      ready: {
        phase: "ready",
        runId: "run-1",
        ...expectedMetadata,
        artifactSha256: "b".repeat(64),
      },
      final: {
        phase: "final",
        runId: "run-1",
        ...expectedMetadata,
        artifactSha256: "b".repeat(64),
      },
    };

    expect(() => verifySmokeEvidence(evidence, expectedMetadata)).toThrow(
      /metadata|SHA-256|hash/i,
    );
  });

  test("requires final timestamp ordering and fresh evidence", () => {
    const evidence = {
      schema: 2,
      runId: "run-1",
      startedAt: "2026-08-19T00:00:00.000Z",
      ready: {
        phase: "ready",
        harnessOrigin: "http://127.0.0.1:41002",
        readinessProbePassed: true,
        packaged: true,
        ...expectedMetadata,
        appPid: 7000,
        harnessPid: 7002,
        listenerPid: 7002,
        resources: [fixtureResourcePath(["dsh-lan-access", "package.json"])],
        harnessHome: "/tmp/dsh",
        resourceRoot: "/tmp/resources",
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
        timestamps: { readyAt: "2026-08-18T00:00:00.000Z" },
        runId: "run-1",
      },
      final: {
        phase: "final",
        harnessOrigin: "http://127.0.0.1:41002",
        appPid: 7000,
        harnessPid: 7002,
        listenerPid: 7002,
        watchdogAcked: true,
        harnessRetired: true,
        ...expectedMetadata,
        resources: [fixtureResourcePath(["dsh-lan-access", "package.json"])],
        timestamps: {
          readyAt: "2026-08-18T00:00:00.000Z",
          finalAt: "2026-08-19T00:00:01.000Z",
        },
        runId: "run-1",
      },
    };
    expect(() => verifySmokeEvidence(evidence, expectedMetadata)).toThrow(
      /timestamp|fresh/i,
    );
  });

  test("rejects readiness beyond the 600000 ms hard deadline", () => {
    const evidence = validSmokeEvidence([
      fixtureResourcePath(["dsh-lan-access", "package.json"]),
    ]);
    evidence.ready.timestamps.readyAt = "2026-08-19T00:10:00.001Z";
    evidence.final.timestamps.readyAt = evidence.ready.timestamps.readyAt;
    evidence.final.timestamps.finalAt = "2026-08-19T00:10:00.002Z";

    expect(() =>
      verifySmokeEvidence(evidence, {
        ...expectedMetadata,
        maxDurationMs: 600_000,
      }),
    ).toThrow(/ready|600000|deadline|duration/i);
  });

  test("times out when the ready acknowledgement is missing", async () => {
    await expect(
      waitForSmokeAcknowledgement(
        "/tmp/missing-smoke-ack",
        Date.now() + 10,
        "run-1",
        7000,
      ),
    ).rejects.toThrow(/acknowledgement timed out/i);
  });

  test("serializes cleanup and exit when interruption signals repeat", async () => {
    const operations = [];
    let releaseCleanup;
    const cleanupBlocked = new Promise((resolve) => {
      releaseCleanup = resolve;
    });
    const onInterrupt = createInterruptHandler(
      async () => {
        operations.push("stop");
        await cleanupBlocked;
        operations.push("remove");
        operations.push("write");
      },
      (code) => operations.push(`exit:${code}`),
    );

    const first = onInterrupt();
    const second = onInterrupt();
    releaseCleanup();
    await Promise.all([first, second]);

    expect(operations).toEqual(["stop", "remove", "write", "exit:130"]);
  });

  test("rejects a symbolic-link final evidence path without changing its target", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-write-"));
    const targetPath = join(evidenceRoot, "target.json");
    const evidencePath = join(evidenceRoot, "final.json");
    await writeFile(targetPath, "preserve\n", "utf8");
    await symlink(targetPath, evidencePath);

    await expect(
      writeEvidenceAtomically({
        evidencePath,
        evidenceRoot,
        content: '{"schema":2}\n',
      }),
    ).rejects.toThrow(/symbolic link/i);
    expect(await readFile(targetPath, "utf8")).toBe("preserve\n");
  });

  test("opens the temporary evidence path without following symbolic links", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-write-"));
    const tempDirectory = join(evidenceRoot, "temp");
    const targetPath = join(evidenceRoot, "target.json");
    const evidencePath = join(evidenceRoot, "final.json");
    const tempPath = join(tempDirectory, "final.tmp");
    await mkdir(tempDirectory);
    await writeFile(targetPath, "preserve\n", "utf8");
    await writeFile(evidencePath, "failure evidence\n", "utf8");
    await symlink(targetPath, tempPath);

    await expect(
      writeEvidenceAtomically({
        evidencePath,
        evidenceRoot,
        content: '{"schema":2}\n',
        tempPath,
      }),
    ).rejects.toThrow(/symbolic link|exist/i);
    expect(await readFile(targetPath, "utf8")).toBe("preserve\n");
    expect(await readFile(evidencePath, "utf8")).toBe("failure evidence\n");
  });

  test("removes the temporary evidence file when atomic replacement fails", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-write-"));
    const evidencePath = join(evidenceRoot, "final.json");
    const tempPath = join(evidenceRoot, "final.tmp");
    await mkdir(evidencePath);

    await expect(
      writeEvidenceAtomically({
        evidencePath,
        evidenceRoot,
        content: '{"schema":2}\n',
        tempPath,
      }),
    ).rejects.toThrow();
    await expect(access(tempPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("preserves detailed failure evidence when fallback reporting runs", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-write-"));
    const evidencePath = join(evidenceRoot, "final.json");
    await writeFile(evidencePath, "detailed failure evidence\n", "utf8");

    await writeEvidenceAtomically({
      evidencePath,
      evidenceRoot,
      content: "fallback failure evidence\n",
      preserveExisting: true,
    });

    expect(await readFile(evidencePath, "utf8")).toBe(
      "detailed failure evidence\n",
    );
  });

  test("publishes complete evidence without leaving a temporary file", async () => {
    const evidenceRoot = await mkdtemp(join(tmpdir(), "dsh-smoke-write-"));
    const evidencePath = join(evidenceRoot, "final.json");
    const tempPath = join(evidenceRoot, "final.tmp");

    await writeEvidenceAtomically({
      evidencePath,
      evidenceRoot,
      content: '{"schema":2}\n',
      tempPath,
    });

    expect(await readFile(evidencePath, "utf8")).toBe('{"schema":2}\n');
    await expect(access(tempPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
