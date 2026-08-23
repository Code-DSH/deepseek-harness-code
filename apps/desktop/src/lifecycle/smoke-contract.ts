import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { redactStartupDiagnostic } from "./startup-diagnostics.js";
import { getNodeDownloadUrls } from "./node-downloader.js";
import { MINIMUM_NODE_VERSION } from "./system-node.js";

const MATRIX = {
  "windows-x64": { packageKind: "nsis", expectedArchitecture: "x64" },
  "windows-arm64": { packageKind: "nsis", expectedArchitecture: "arm64" },
  "macos-universal": { packageKind: "dmg", expectedArchitecture: "universal" },
  "linux-x64": {
    packageKinds: ["appimage", "deb"],
    expectedArchitecture: "x64",
  },
  "linux-arm64": {
    packageKinds: ["appimage", "deb"],
    expectedArchitecture: "arm64",
  },
} as const;
type SmokeMatrixLabel = keyof typeof MATRIX;
export type SmokeScenario = "runtime" | "node-required";

export type SmokeConfig = {
  readonly path: string;
  readonly acknowledgementPath?: string;
  readonly root: string;
  readonly userDataPath: string;
  readonly runId: string;
  readonly scenario: SmokeScenario;
  readonly matrixLabel: SmokeMatrixLabel;
  readonly packageKind: string;
  readonly expectedArchitecture: string;
  readonly artifactFilename: string;
  readonly artifactSha256: string;
  readonly startedAt: string;
};

export type SmokeNodeRequiredEvidence = {
  readonly phase: "node-required";
  readonly scenario: "node-required";
  readonly minimumNodeVersion: string;
  readonly installerUrl: string;
  readonly archiveUrl: string;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly appPid: number;
  readonly packaged: true;
  readonly harnessStarted: false;
  readonly listenerObserved: false;
  readonly runId: string;
  readonly matrixLabel: SmokeMatrixLabel;
  readonly packageKind: string;
  readonly expectedArchitecture: string;
  readonly artifactFilename: string;
  readonly artifactSha256: string;
  readonly startedAt: string;
  readonly timestamps: { readonly nodeRequiredAt: string };
};

export type SmokeReadyEvidence = {
  readonly phase: "ready";
  readonly harnessOrigin: string;
  readonly appPid: number;
  readonly harnessPid: number;
  readonly listenerPid: number;
  readonly readinessProbePassed: true;
  readonly packaged: boolean;
  readonly resources: readonly string[];
  readonly runId: string;
  readonly matrixLabel: SmokeMatrixLabel;
  readonly packageKind: string;
  readonly expectedArchitecture: string;
  readonly artifactFilename: string;
  readonly artifactSha256: string;
  readonly startedAt: string;
  readonly harnessHome: string;
  readonly resourceRoot: string;
  readonly systemNode: {
    readonly executable: string;
    readonly version: string | null;
  };
  readonly timestamps: { readonly readyAt: string; readonly finalAt?: string };
};

export type SmokeFinalEvidence = Omit<SmokeReadyEvidence, "phase"> & {
  readonly phase: "final";
  readonly watchdogAcked: boolean;
  readonly harnessRetired: boolean;
};

type SmokeEnv = Readonly<Record<string, string | undefined>>;

type SmokeAcknowledgementOptions = {
  readonly acknowledgementPath: string;
  readonly runId: string;
  readonly appPid: number;
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
};

type SmokeAcknowledgementDependencies = {
  readonly now: () => number;
  readonly delay: (milliseconds: number) => Promise<void>;
  readonly requestQuit: () => void;
};

type SmokeShutdownOptions = {
  readonly writeFinalEvidence: () => Promise<void>;
  readonly quit: () => void;
  readonly reportFailure: (message: string) => void;
};

type SmokeRuntime = {
  readonly harnessOrigin: string;
  readonly appPid: number;
  readonly harnessPid: number;
  readonly listenerPid: number;
  readonly readinessProbePassed: true;
  readonly packaged: boolean;
  readonly resources: readonly string[];
  readonly harnessHome: string;
  readonly resourceRoot: string;
  readonly systemNode: {
    readonly executable: string;
    readonly version: string | null;
  };
  readonly startedAt?: string;
};

export function parseSmokeConfig(
  env: SmokeEnv,
  options: { readonly isPackaged: boolean } = {
    isPackaged: false,
  },
): SmokeConfig | undefined {
  if (env.SMOKE_MODE !== "ci") return undefined;
  const scenario = env.SMOKE_SCENARIO ?? "runtime";
  if (scenario !== "runtime" && scenario !== "node-required") return undefined;
  if (scenario === "node-required" && !options.isPackaged) return undefined;
  if (!options.isPackaged && env.SMOKE_ALLOW_UNPACKAGED !== "1")
    return undefined;
  const path = env.SMOKE_EVIDENCE_PATH;
  const root = env.SMOKE_EVIDENCE_ROOT;
  const userDataPath = env.SMOKE_USER_DATA_PATH;
  const acknowledgementPath = env.SMOKE_ACK_PATH ?? `${path ?? ""}.ack`;
  if (
    path === undefined ||
    root === undefined ||
    userDataPath === undefined ||
    !isEvidencePathWithinRoot(path, root) ||
    !isEvidencePathWithinRoot(acknowledgementPath, root) ||
    !isEvidencePathWithinRoot(userDataPath, root)
  )
    return undefined;
  const runId = env.SMOKE_RUN_ID;
  if (runId === undefined || !/^[A-Za-z0-9_-]{8,128}$/.test(runId))
    return undefined;
  const matrixLabel = env.MATRIX_LABEL;
  const packageKind = env.PACKAGE_KIND;
  const expectedArchitecture = env.EXPECTED_ARCHITECTURE;
  const artifactFilename = env.ARTIFACT_FILENAME;
  const artifactSha256 = env.ARTIFACT_SHA256;
  const startedAt = env.SMOKE_STARTED_AT;
  if (
    matrixLabel === undefined ||
    packageKind === undefined ||
    expectedArchitecture === undefined ||
    artifactFilename === undefined ||
    artifactSha256 === undefined ||
    startedAt === undefined ||
    !isSmokeMatrix(matrixLabel, packageKind, expectedArchitecture) ||
    !/^[a-f0-9]{64}$/u.test(artifactSha256) ||
    !isIsoTimestamp(startedAt)
  )
    return undefined;
  return {
    path,
    root,
    userDataPath,
    ...(acknowledgementPath === "" ? {} : { acknowledgementPath }),
    runId,
    scenario,
    matrixLabel: matrixLabel as SmokeMatrixLabel,
    packageKind,
    expectedArchitecture,
    artifactFilename,
    artifactSha256,
    startedAt,
  };
}

export function resolveStartupSystemNode<T>(
  config: Pick<SmokeConfig, "scenario"> | undefined,
  resolver: () => T,
):
  | { readonly mode: "runtime"; readonly node: T }
  | {
      readonly mode: "node-required";
    } {
  const node = resolver();
  return node === undefined && config?.scenario === "node-required"
    ? { mode: "node-required" }
    : { mode: "runtime", node };
}

export function shouldCreateWindowOnActivate(
  nodeRequiredSmokeActive: boolean,
  windowCount: number,
): boolean {
  return !nodeRequiredSmokeActive && windowCount === 0;
}

export function buildSmokeNodeRequiredEvidence(
  config: SmokeConfig,
  runtime: {
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
    readonly appPid: number;
  },
): SmokeNodeRequiredEvidence {
  if (config.scenario !== "node-required") {
    throw new Error("node-required evidence requires its validated scenario");
  }
  if (!Number.isInteger(runtime.appPid) || runtime.appPid <= 0) {
    throw new Error("node-required evidence requires a valid application PID");
  }
  const { installerUrl, archiveUrl } = getNodeDownloadUrls(
    runtime.platform,
    runtime.architecture,
    MINIMUM_NODE_VERSION,
  );
  for (const url of [installerUrl, archiveUrl]) {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "nodejs.org"
    ) {
      throw new Error("node-required Node URL must use official nodejs.org");
    }
  }
  return {
    phase: "node-required",
    scenario: "node-required",
    minimumNodeVersion: MINIMUM_NODE_VERSION,
    installerUrl,
    archiveUrl,
    platform: runtime.platform,
    architecture: runtime.architecture,
    appPid: runtime.appPid,
    packaged: true,
    harnessStarted: false,
    listenerObserved: false,
    runId: config.runId,
    matrixLabel: config.matrixLabel,
    packageKind: config.packageKind,
    expectedArchitecture: config.expectedArchitecture,
    artifactFilename: config.artifactFilename,
    artifactSha256: config.artifactSha256,
    startedAt: config.startedAt,
    timestamps: { nodeRequiredAt: new Date().toISOString() },
  };
}

export function resolveApplicationUserDataPath(
  defaultPath: string,
  smokeConfig?: Pick<SmokeConfig, "userDataPath">,
): string {
  return smokeConfig?.userDataPath ?? defaultPath;
}

export async function awaitSmokeAcknowledgement(
  options: SmokeAcknowledgementOptions,
  dependencies: SmokeAcknowledgementDependencies,
): Promise<void> {
  const deadline = dependencies.now() + options.timeoutMs;
  while (dependencies.now() < deadline) {
    try {
      const acknowledgement: unknown = JSON.parse(
        await readFile(options.acknowledgementPath, "utf8"),
      );
      if (
        typeof acknowledgement === "object" &&
        acknowledgement !== null &&
        "runId" in acknowledgement &&
        acknowledgement.runId === options.runId &&
        "appPid" in acknowledgement &&
        acknowledgement.appPid === options.appPid
      ) {
        dependencies.requestQuit();
        return;
      }
    } catch (error) {
      const isPendingAcknowledgement =
        error instanceof SyntaxError ||
        (error instanceof Error && "code" in error && error.code === "ENOENT");
      if (!isPendingAcknowledgement) throw error;
    }
    const remainingMs = deadline - dependencies.now();
    if (remainingMs > 0) {
      await dependencies.delay(Math.min(options.pollIntervalMs, remainingMs));
    }
  }
  throw new Error("packaged smoke ready acknowledgement timed out");
}

export async function completeSmokeShutdown(
  options: SmokeShutdownOptions,
): Promise<void> {
  try {
    await options.writeFinalEvidence();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "unknown evidence write error";
    options.reportFailure(
      redactStartupDiagnostic(`Final smoke evidence write failed: ${detail}`),
    );
  } finally {
    options.quit();
  }
}

function isIsoTimestamp(value: string): boolean {
  return (
    Number.isFinite(Date.parse(value)) &&
    value === new Date(value).toISOString()
  );
}

function isSmokeMatrix(
  label: string,
  packageKind: string,
  architecture: string,
): label is SmokeMatrixLabel {
  const expected = MATRIX[label as SmokeMatrixLabel];
  if (expected === undefined || expected.expectedArchitecture !== architecture)
    return false;
  return "packageKind" in expected
    ? expected.packageKind === packageKind
    : expected.packageKinds.includes(packageKind as "appimage" | "deb");
}

export function isEvidencePathWithinRoot(path: string, root: string): boolean {
  if (!isAbsolute(path) || !isAbsolute(root)) return false;
  const relativePath = relative(root, path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

export function assertSmokePathIsNotSymlink(path: string): void {
  const info = lstatSync(path);
  if (info.isSymbolicLink())
    throw new Error("smoke evidence path is a symbolic link");
}

export function validateSmokeRuntimeProvenance(
  runtime: Pick<SmokeRuntime, "harnessHome" | "resourceRoot" | "systemNode">,
  isolatedRoots: readonly string[],
): void {
  if (!isAbsolute(runtime.harnessHome) || !isAbsolute(runtime.resourceRoot))
    throw new Error("Harness Home and resource root must be absolute");
  if (
    !isAbsolute(runtime.systemNode.executable) ||
    !existsSync(runtime.systemNode.executable) ||
    !statSync(runtime.systemNode.executable).isFile()
  )
    throw new Error("system Node executable must be an existing file");
  if (
    runtime.systemNode.version === null ||
    compareVersions(runtime.systemNode.version, "22.13.0") < 0
  )
    throw new Error("system Node version must be at least 22.13.0");
  const roots = isolatedRoots.map((root) => realpathSync(resolve(root)));
  for (const value of [runtime.harnessHome, runtime.resourceRoot]) {
    const resolved = realpathSync(resolve(value));
    if (!roots.some((root) => isEvidencePathWithinRoot(resolved, root)))
      throw new Error("runtime provenance escapes isolated roots");
  }
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .match(/^(\d+)\.(\d+)\.(\d+)/u)
      ?.slice(1)
      .map(Number) ?? [];
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function buildSmokeReadyEvidence(
  config: SmokeConfig,
  runtime: SmokeRuntime,
): SmokeReadyEvidence {
  return {
    phase: "ready",
    harnessOrigin: runtime.harnessOrigin,
    appPid: runtime.appPid,
    harnessPid: runtime.harnessPid,
    listenerPid: runtime.listenerPid,
    readinessProbePassed: runtime.readinessProbePassed,
    packaged: runtime.packaged,
    resources: [...runtime.resources],
    runId: config.runId,
    matrixLabel: config.matrixLabel,
    packageKind: config.packageKind,
    expectedArchitecture: config.expectedArchitecture,
    artifactFilename: config.artifactFilename,
    artifactSha256: config.artifactSha256,
    startedAt: config.startedAt,
    harnessHome: runtime.harnessHome,
    resourceRoot: runtime.resourceRoot,
    systemNode: runtime.systemNode,
    timestamps: { readyAt: new Date().toISOString() },
  };
}

export function buildSmokeFinalEvidence(
  config: SmokeConfig,
  state: {
    readonly ready: SmokeReadyEvidence;
    readonly watchdogAcked: boolean;
    readonly harnessRetired: boolean;
  },
): SmokeFinalEvidence {
  return {
    ...state.ready,
    phase: "final",
    watchdogAcked: state.watchdogAcked,
    harnessRetired: state.harnessRetired,
    runId: config.runId,
    timestamps: {
      ...state.ready.timestamps,
      finalAt: new Date().toISOString(),
    },
  };
}
