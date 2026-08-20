import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import * as smokeRuntime from "../../scripts/smoke-packaged-runtime.mjs";

import {
  parseLoopbackListeners,
  verifySmokeEvidence,
  assertKnownRunnerArchitecture,
  validateArtifactContract,
  parseWindowsPeMachine,
  buildPackagedSmokeLaunch,
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

describe("packaged runtime listener selection", () => {
  test("isolates Harness Home and disables only the Linux CI sandbox", () => {
    expect(buildPackagedSmokeLaunch("linux", "/tmp/smoke-user-data")).toEqual({
      args: ["--no-sandbox"],
      env: { DSH_HOME: "/tmp/smoke-user-data/dsh-home" },
    });
    expect(buildPackagedSmokeLaunch("win32", "C:\\smoke-user-data")).toEqual({
      args: [],
      env: { DSH_HOME: join("C:\\smoke-user-data", "dsh-home") },
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
        resources: ["desktop-plugin/package.json"],
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
        harnessHome: "/tmp/dsh",
        resourceRoot: "/tmp/resources",
        systemNode: { executable: "/usr/bin/node", version: "24.1.0" },
        timestamps: {
          readyAt: "2026-08-19T00:00:01.000Z",
          finalAt: "2026-08-19T00:00:02.000Z",
        },
      },
    };

    expect(verifySmokeEvidence(evidence, expectedMetadata)).toEqual({
      origin: "http://127.0.0.1:41002",
      appPid: 7000,
      harnessPid: 7002,
      port: 41002,
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

  test("fails closed for unknown Linux and Windows runner architectures but preserves macOS variants", () => {
    expect(() => assertKnownRunnerArchitecture("linux", "arm64")).toThrow(
      /architecture/i,
    );
    expect(() => assertKnownRunnerArchitecture("win32", "ia32")).toThrow(
      /architecture/i,
    );
    expect(() => assertKnownRunnerArchitecture("linux", "mips64")).toThrow(
      /architecture/i,
    );
    expect(() =>
      assertKnownRunnerArchitecture("darwin", "arm64"),
    ).not.toThrow();
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
