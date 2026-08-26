import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { constants as fsConstants } from "node:fs";
import {
  access,
  lstat,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir, networkInterfaces, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  win32,
} from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const evidencePath =
  process.env.SMOKE_EVIDENCE ??
  argument("--evidence") ??
  join(tmpdir(), `dsh-smoke-${process.pid}.json`);
const evidenceRoot = resolve(
  argument("--evidence-root") ??
    process.env.SMOKE_EVIDENCE_ROOT ??
    resolve(evidencePath, ".."),
);
const metadataRoot =
  argument("--metadata-root") ?? process.env.SMOKE_METADATA_ROOT;
const appEvidencePath = `${evidencePath}.app.json`;
const SMOKE_TIMEOUT_MS = 1_200_000;
const requestedTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 45_000);
const timeoutMs =
  Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? Math.min(requestedTimeoutMs, SMOKE_TIMEOUT_MS)
    : 45_000;
const startedAt = new Date().toISOString();

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredArgument(name) {
  const value = argument(name);
  if (value === undefined || value === "")
    throw new Error(`${name} is required`);
  return value;
}

function findExecutable() {
  const configured = argument("--executable") ?? process.env.SMOKE_EXECUTABLE;
  if (configured) return resolve(configured);
  throw new Error("SMOKE_EXECUTABLE or --executable is required");
}

function buildPackagedSmokeLaunch(platform, userDataPath) {
  const args = [`--user-data-dir=${userDataPath}`];
  if (platform === "linux") args.push("--no-sandbox");
  const pathApi = platform === "win32" ? win32 : posix;
  return {
    args,
    env: { DSH_HOME: pathApi.join(userDataPath, "dsh-home") },
  };
}

function buildPackagedSmokeEnvironment(platform, environment, scenario) {
  if (scenario === "runtime") return { ...environment };
  if (scenario !== "node-required")
    throw new Error(`unsupported packaged smoke scenario ${scenario}`);
  const pathApi = platform === "win32" ? win32 : posix;
  const result = {};
  const nodeManagerKey =
    /^(?:NODE(?:_.+)?|NVM_.+|VOLTA_HOME|FNM_.+|MISE_.+|PNPM_HOME|COREPACK_HOME|DHC_NODE_EXECUTABLE|npm_node_execpath|npm_execpath)$/iu;
  const nodePathEntry =
    /(?:^|[\\/])(?:node|nodejs|nvm|fnm|volta|mise)(?:[\\/]|$)/iu;
  for (const [key, value] of Object.entries(environment)) {
    if (nodeManagerKey.test(key)) continue;
    if (/^path$/iu.test(key) && typeof value === "string") {
      result[key] = value
        .split(pathApi.delimiter)
        .filter((entry) => entry !== "" && !nodePathEntry.test(entry))
        .join(pathApi.delimiter);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function systemNodeCandidateEntries(platform, environment, homeDirectory) {
  const pathApi = platform === "win32" ? win32 : posix;
  const { join: joinPath } = pathApi;
  if (platform === "win32") {
    const userProfile = environment.USERPROFILE ?? homeDirectory;
    const localAppData =
      environment.LOCALAPPDATA ?? joinPath(userProfile, "AppData", "Local");
    return [
      {
        id: "program-files-node",
        path: joinPath(
          environment.ProgramFiles ?? "C:\\Program Files",
          "nodejs",
          "node.exe",
        ),
      },
      {
        id: "program-files-x86-node",
        path: joinPath(
          environment["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
          "nodejs",
          "node.exe",
        ),
      },
      {
        id: "chocolatey-node",
        path: joinPath(
          environment.ProgramData ?? "C:\\ProgramData",
          "chocolatey",
          "bin",
          "node.exe",
        ),
      },
      {
        id: "scoop-node",
        path: joinPath(userProfile, "scoop", "shims", "node.exe"),
      },
      {
        id: "user-volta-node",
        path: joinPath(userProfile, ".volta", "bin", "node.exe"),
      },
      {
        id: "local-volta-node",
        path: joinPath(localAppData, ".volta", "bin", "node.exe"),
      },
    ];
  }
  if (platform !== "linux" && platform !== "darwin")
    throw new Error(`unsupported Node quarantine platform ${platform}`);
  const system =
    platform === "darwin"
      ? [
          ["homebrew-node", "/opt/homebrew/bin/node"],
          ["usr-local-node", "/usr/local/bin/node"],
        ]
      : [
          ["usr-local-node", "/usr/local/bin/node"],
          ["snap-node", "/snap/bin/node"],
          ["usr-bin-node", "/usr/bin/node"],
          ["usr-bin-nodejs", "/usr/bin/nodejs"],
        ];
  return [
    ...system.map(([id, path]) => ({ id, path })),
    {
      id: "user-volta-node",
      path: joinPath(homeDirectory, ".volta", "bin", "node"),
    },
    {
      id: "user-asdf-node",
      path: joinPath(homeDirectory, ".asdf", "shims", "node"),
    },
    {
      id: "user-local-node",
      path: joinPath(homeDirectory, ".local", "bin", "node"),
    },
    {
      id: "user-bin-node",
      path: joinPath(homeDirectory, "bin", "node"),
    },
  ];
}

const NODE_VERSION_WITH_V = /^v\d+\.\d+\.\d+$/u;
const NODE_VERSION_PLAIN = /^\d+\.\d+\.\d+$/u;

function systemNodeVersionDirectoryProbes(
  platform,
  environment,
  homeDirectory,
) {
  const pathApi = platform === "win32" ? win32 : posix;
  const { join: joinPath } = pathApi;
  if (platform === "win32") {
    const userProfile = environment.USERPROFILE ?? homeDirectory;
    const appData =
      environment.APPDATA ?? joinPath(userProfile, "AppData", "Roaming");
    const localAppData =
      environment.LOCALAPPDATA ?? joinPath(userProfile, "AppData", "Local");
    const probes = [
      {
        id: "user-nvm",
        directory: joinPath(appData, "nvm"),
        entryPattern: NODE_VERSION_WITH_V,
        relative: ["node.exe"],
      },
      {
        id: "user-fnm",
        directory: joinPath(appData, "fnm", "node-versions"),
        entryPattern: NODE_VERSION_WITH_V,
        relative: ["installation", "node.exe"],
      },
      {
        id: "local-fnm",
        directory: joinPath(localAppData, "fnm", "node-versions"),
        entryPattern: NODE_VERSION_WITH_V,
        relative: ["installation", "node.exe"],
      },
    ];
    if (
      typeof environment.NVM_HOME === "string" &&
      environment.NVM_HOME !== ""
    ) {
      probes.unshift({
        id: "environment-nvm",
        directory: environment.NVM_HOME,
        entryPattern: NODE_VERSION_WITH_V,
        relative: ["node.exe"],
      });
    }
    return probes;
  }
  if (platform !== "linux" && platform !== "darwin")
    throw new Error(`unsupported Node quarantine platform ${platform}`);
  const probes = [
    {
      id: "user-nvm",
      directory: joinPath(homeDirectory, ".nvm", "versions", "node"),
      entryPattern: NODE_VERSION_WITH_V,
      relative: ["bin", "node"],
    },
  ];
  if (platform === "darwin") {
    probes.push({
      id: "application-support-fnm",
      directory: joinPath(
        homeDirectory,
        "Library",
        "Application Support",
        "fnm",
        "node-versions",
      ),
      entryPattern: NODE_VERSION_WITH_V,
      relative: ["installation", "bin", "node"],
    });
  }
  probes.push(
    {
      id: "user-fnm",
      directory: joinPath(homeDirectory, ".fnm", "node-versions"),
      entryPattern: NODE_VERSION_WITH_V,
      relative: ["installation", "bin", "node"],
    },
    {
      id: "user-mise",
      directory: joinPath(
        homeDirectory,
        ".local",
        "share",
        "mise",
        "installs",
        "node",
      ),
      entryPattern: NODE_VERSION_PLAIN,
      relative: ["bin", "node"],
    },
    {
      id: "user-volta-images",
      directory: joinPath(homeDirectory, ".volta", "tools", "image", "node"),
      entryPattern: NODE_VERSION_PLAIN,
      relative: ["bin", "node"],
    },
  );
  if (platform === "linux") {
    probes.push({
      id: "system-n",
      directory: "/usr/local/n/versions/node",
      entryPattern: NODE_VERSION_PLAIN,
      relative: ["bin", "node"],
    });
  }
  if (typeof environment.NVM_DIR === "string" && environment.NVM_DIR !== "") {
    probes.push({
      id: "environment-nvm",
      directory: joinPath(environment.NVM_DIR, "versions", "node"),
      entryPattern: NODE_VERSION_WITH_V,
      relative: ["bin", "node"],
    });
  }
  if (
    typeof environment.VOLTA_HOME === "string" &&
    environment.VOLTA_HOME !== ""
  ) {
    probes.push({
      id: "environment-volta-images",
      directory: joinPath(environment.VOLTA_HOME, "tools", "image", "node"),
      entryPattern: NODE_VERSION_PLAIN,
      relative: ["bin", "node"],
    });
  }
  if (typeof environment.FNM_DIR === "string" && environment.FNM_DIR !== "") {
    probes.push({
      id: "environment-fnm",
      directory: joinPath(environment.FNM_DIR, "node-versions"),
      entryPattern: NODE_VERSION_WITH_V,
      relative: ["installation", "bin", "node"],
    });
  }
  return probes;
}

async function discoverSystemNodeVersionCandidates(
  platform,
  environment,
  homeDirectory,
  listDirectory = readdir,
) {
  const pathApi = platform === "win32" ? win32 : posix;
  const candidates = [];
  for (const probe of systemNodeVersionDirectoryProbes(
    platform,
    environment,
    homeDirectory,
  )) {
    let versions;
    try {
      versions = await listDirectory(probe.directory);
    } catch (error) {
      if (
        error instanceof Error &&
        ["EACCES", "ENOENT", "ENOTDIR"].includes(error.code)
      ) {
        continue;
      }
      throw new Error(
        `Node quarantine version directory inspection failed (${probe.id})`,
      );
    }
    for (const version of versions
      .filter((entry) => probe.entryPattern.test(entry))
      .sort()) {
      candidates.push({
        id: `${probe.id}-${version}`,
        path: pathApi.join(probe.directory, version, ...probe.relative),
      });
    }
  }
  return candidates;
}

function shouldQuarantineNodeCandidate({
  candidatePath,
  parentExecutablePath,
  candidateIsSymlink,
  candidateFileId,
  parentFileId,
  platform,
}) {
  if (candidateIsSymlink) return true;
  const pathApi = platform === "win32" ? win32 : posix;
  const normalize = (value) => {
    const normalized = pathApi.normalize(value);
    return platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  if (normalize(candidatePath) === normalize(parentExecutablePath))
    return false;
  const hasReliableFileId = (value) => value !== "" && !value.endsWith(":0");
  return (
    !hasReliableFileId(candidateFileId) ||
    !hasReliableFileId(parentFileId) ||
    candidateFileId !== parentFileId
  );
}

async function buildSystemNodeQuarantinePlan({
  platform = process.platform,
  environment = process.env,
  homeDirectory = homedir(),
  parentExecutablePath = process.execPath,
}) {
  const parentInfo = await stat(parentExecutablePath);
  const parentFileId = `${parentInfo.dev}:${parentInfo.ino}`;
  const plan = [];
  const fixedCandidates = systemNodeCandidateEntries(
    platform,
    environment,
    homeDirectory,
  );
  const versionCandidates = await discoverSystemNodeVersionCandidates(
    platform,
    environment,
    homeDirectory,
  );
  const pathApi = platform === "win32" ? win32 : posix;
  const seen = new Set();
  for (const entry of [...fixedCandidates, ...versionCandidates]) {
    const normalizedPath =
      platform === "win32"
        ? pathApi.normalize(entry.path).toLowerCase()
        : pathApi.normalize(entry.path);
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);
    let candidateInfo;
    try {
      candidateInfo = await lstat(entry.path);
    } catch (error) {
      if (error instanceof Error && error.code === "ENOENT") continue;
      throw new Error(
        `Node quarantine candidate inspection failed (${entry.id})`,
      );
    }
    if (
      shouldQuarantineNodeCandidate({
        candidatePath: entry.path,
        parentExecutablePath,
        candidateIsSymlink: candidateInfo.isSymbolicLink(),
        candidateFileId: `${candidateInfo.dev}:${candidateInfo.ino}`,
        parentFileId,
        platform,
      })
    ) {
      plan.push(entry);
    }
  }
  return plan;
}

async function checksum(path) {
  const info = await stat(path);
  if (!info.isFile()) {
    const entries = await inventory(path);
    return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  }
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  return new Promise((resolveHash, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function inventory(path) {
  const entries = [];
  async function visit(current) {
    const info = await stat(current);
    if (info.isFile()) {
      entries.push({ path: relative(path, current), bytes: info.size });
      return;
    }
    for (const entry of await readdir(current))
      await visit(join(current, entry));
  }
  await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function assertPathWithinRoot(path, rootPath) {
  const [resolvedPath, resolvedRoot] = await Promise.all([
    realpath(dirname(path)).then((parent) =>
      join(parent, path.split(pathSeparator()).at(-1)),
    ),
    realpath(rootPath),
  ]);
  const suffix = relative(resolvedRoot, resolvedPath);
  if (
    suffix === ".." ||
    suffix.startsWith(`..${pathSeparator()}`) ||
    resolve(suffix) === ".."
  )
    throw new Error(`path escapes smoke evidence root: ${path}`);
}

async function assertPathNotSymlink(path) {
  try {
    if ((await lstat(path)).isSymbolicLink())
      throw new Error(`refusing symbolic link evidence path: ${path}`);
  } catch (error) {
    if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
  }
}

async function assertEvidenceRootAllowed(rootPath, metadataRootPath) {
  if (metadataRootPath === undefined) return;
  const resolvedRoot = await realpath(rootPath);
  const forbiddenRoot = await realpath(metadataRootPath);
  if (
    resolvedRoot === forbiddenRoot ||
    resolvedRoot.startsWith(`${forbiddenRoot}${pathSeparator()}`)
  )
    throw new Error(
      "smoke evidence root must be outside configured metadata root",
    );
}

function pathSeparator() {
  return process.platform === "win32" ? "\\" : "/";
}

function redactPackagedDiagnostic(value) {
  return value
    .replace(
      /\b(authorization|api[-_ ]?key|token|password|secret)\b\s*[:=]\s*[^\s]+/giu,
      "$1=[redacted]",
    )
    .replace(/https:\/\/[^/@\s:]+:[^@\s]+@/giu, "https://[redacted]@")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, "[redacted-key]")
    .slice(-8_000);
}

async function writeEvidenceAtomically({
  evidencePath: finalPath,
  evidenceRoot: rootPath,
  content,
  preserveExisting = false,
  tempPath = join(
    dirname(finalPath),
    `.${finalPath.split(pathSeparator()).at(-1)}.${process.pid}.${randomUUID()}.tmp`,
  ),
}) {
  const resolvedFinalPath = resolve(finalPath);
  const resolvedTempPath = resolve(tempPath);
  await assertPathWithinRoot(resolvedFinalPath, rootPath);
  await assertPathWithinRoot(resolvedTempPath, rootPath);
  await assertPathNotSymlink(resolvedFinalPath);
  if (preserveExisting) {
    try {
      await access(resolvedFinalPath);
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
    }
  }
  await assertPathNotSymlink(resolvedTempPath);
  let handle;
  try {
    handle = await open(
      resolvedTempPath,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        fsConstants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await assertPathNotSymlink(resolvedTempPath);
    await assertPathNotSymlink(resolvedFinalPath);
    await rename(resolvedTempPath, resolvedFinalPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(resolvedTempPath).catch((unlinkError) => {
      if (!(unlinkError instanceof Error) || unlinkError.code !== "ENOENT")
        throw unlinkError;
    });
    throw error;
  }
}

function createInterruptHandler(cleanup, exit) {
  let interruption;
  return () => {
    interruption ??= cleanup().finally(() => exit(130));
    return interruption;
  };
}

function parseLoopbackListeners(output, platform = process.platform) {
  const listeners = [];
  for (const line of output.split("\n")) {
    if (platform === "darwin") {
      const match = line.match(
        /^\S+\s+(\d+)\s+.*\sTCP\s+127\.0\.0\.1:(\d+)\s+\(LISTEN\)\s*$/u,
      );
      if (match)
        listeners.push({ port: Number(match[2]), pid: Number(match[1]) });
      continue;
    }
    if (!line.includes("127.0.0.1") || !/LISTEN/i.test(line)) continue;
    const portMatch = line.match(/127\.0\.0\.1:(\d+)/);
    if (!portMatch) continue;
    const pidMatch =
      platform === "win32"
        ? line.match(/LISTENING\s+(\d+)\s*$/i)
        : line.match(/pid=(\d+)/);
    listeners.push({
      port: Number(portMatch[1]),
      pid: pidMatch ? Number(pidMatch[1]) : undefined,
    });
  }
  return listeners;
}

function listenerCommand(platform = process.platform) {
  if (platform === "win32")
    return { command: "netstat", args: ["-ano", "-p", "tcp"] };
  if (platform === "linux") return { command: "ss", args: ["-ltnp"] };
  if (platform === "darwin")
    return {
      command: "lsof",
      args: ["-nP", "-iTCP", "-sTCP:LISTEN"],
    };
  throw new Error(`unsupported smoke platform ${platform}`);
}

async function listLoopbackListeners() {
  const { command, args } = listenerCommand();
  const output = await execFileAsync(command, args, {
    windowsHide: true,
  }).then(
    ({ stdout }) => stdout,
    () => "",
  );
  return parseLoopbackListeners(output, process.platform);
}

function parseLinuxListeningSocketInodes(output, port) {
  const expectedPort = port.toString(16).toUpperCase().padStart(4, "0");
  const loopbackAddresses = new Set([
    "0100007F",
    "00000000000000000000000001000000",
    "0000000000000000FFFF00000100007F",
  ]);
  const inodes = [];
  for (const line of output.split("\n")) {
    const fields = line.trim().split(/\s+/u);
    const [address, localPort] = fields[1]?.split(":") ?? [];
    if (
      !loopbackAddresses.has(address ?? "") ||
      localPort !== expectedPort ||
      fields[3] !== "0A"
    ) {
      continue;
    }
    const inode = fields[9];
    if (inode !== undefined && /^\d+$/u.test(inode)) inodes.push(inode);
  }
  return inodes;
}

function parseWindowsListenerOwnerPids(output) {
  return output
    .split(/\s+/u)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function linuxListeningSocketInodes(port) {
  const [tcp, tcp6] = await Promise.all([
    readFile("/proc/net/tcp", "utf8").catch(() => ""),
    readFile("/proc/net/tcp6", "utf8").catch(() => ""),
  ]);
  return new Set([
    ...parseLinuxListeningSocketInodes(tcp, port),
    ...parseLinuxListeningSocketInodes(tcp6, port),
  ]);
}

async function linuxPidOwnsSocket(pid, inodes) {
  if (inodes.size === 0) return false;
  const fdRoot = `/proc/${pid}/fd`;
  const descriptors = await readdir(fdRoot).catch(() => []);
  for (const descriptor of descriptors) {
    const target = await readlink(join(fdRoot, descriptor)).catch(() => "");
    const match = target.match(/^socket:\[(\d+)\]$/u);
    if (match !== null && inodes.has(match[1])) return true;
  }
  return false;
}

async function linuxLoopbackPortOwnerPids(port) {
  const inodes = await linuxListeningSocketInodes(port);
  if (inodes.size === 0) return [];
  const entries = await readdir("/proc", { withFileTypes: true }).catch(
    () => [],
  );
  const owners = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
    const pid = Number(entry.name);
    if (await linuxPidOwnsSocket(pid, inodes)) owners.push(pid);
  }
  return owners;
}

async function windowsListenerOwnerPids(port) {
  const command = [
    "$owners = Get-NetTCPConnection",
    "-State Listen",
    `-LocalPort ${port}`,
    "-ErrorAction SilentlyContinue",
    "| Where-Object { $_.LocalAddress -eq '127.0.0.1' }",
    "| Select-Object -ExpandProperty OwningProcess -Unique;",
    "$owners",
  ].join(" ");
  const output = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { windowsHide: true },
  ).then(
    ({ stdout }) => stdout,
    () => "",
  );
  return parseWindowsListenerOwnerPids(output);
}

function nonLoopbackIpv4Addresses(interfaces = networkInterfaces()) {
  return [
    ...new Set(
      Object.values(interfaces)
        .flatMap((entries) => entries ?? [])
        .filter(
          (entry) =>
            (entry.family === "IPv4" || entry.family === 4) && !entry.internal,
        )
        .map((entry) => entry.address),
    ),
  ];
}

function canConnect(address, port, timeoutMs = 1_500) {
  return new Promise((resolveConnection) => {
    const socket = createConnection({ host: address, port });
    let settled = false;
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveConnection(connected);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function assertPortNotReachableOffLoopback(port) {
  for (const address of nonLoopbackIpv4Addresses()) {
    if (await canConnect(address, port)) {
      throw new Error(
        `Harness listener ${port} is reachable through non-loopback address ${address}`,
      );
    }
  }
}

function assertEvidenceMetadata(value, expected) {
  for (const key of [
    "runId",
    "matrixLabel",
    "packageKind",
    "expectedArchitecture",
    "artifactFilename",
    "artifactSha256",
    "startedAt",
  ]) {
    if (value?.[key] !== expected[key])
      throw new Error(`smoke evidence metadata does not match ${key}`);
  }
}

function verifySmokeEvidence(evidence, expected) {
  const ready = evidence?.ready;
  const final = evidence?.final;
  if (
    evidence?.runId !== expected.runId ||
    ready?.runId !== expected.runId ||
    final?.runId !== expected.runId
  )
    throw new Error("smoke evidence run nonce does not match current run");
  if (
    evidence?.schema !== 2 ||
    evidence?.runId !== expected.runId ||
    ready?.phase !== "ready" ||
    final?.phase !== "final"
  )
    throw new Error("smoke evidence does not contain ready and final phases");
  assertEvidenceMetadata(ready, expected);
  assertEvidenceMetadata(final, expected);
  if (evidence.startedAt !== expected.startedAt)
    throw new Error("smoke evidence metadata does not match startedAt");
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(ready.harnessOrigin))
    throw new Error("smoke evidence origin is not exact loopback HTTP");
  if (ready.harnessOrigin !== final.harnessOrigin)
    throw new Error("smoke evidence origin changed during shutdown");
  if (ready.readinessProbePassed !== true || ready.packaged !== true)
    throw new Error("smoke evidence readiness contract failed");
  if (final.watchdogAcked !== true || final.harnessRetired !== true)
    throw new Error("smoke evidence shutdown contract failed");
  if (!Number.isInteger(ready.appPid) || ready.appPid <= 0)
    throw new Error("smoke evidence app PID is invalid");
  if (!Number.isInteger(ready.harnessPid) || ready.harnessPid <= 0)
    throw new Error("smoke evidence Harness PID is invalid");
  if (final.appPid !== ready.appPid || final.harnessPid !== ready.harnessPid)
    throw new Error("smoke evidence PIDs changed during shutdown");
  if (ready.harnessPid !== ready.listenerPid)
    throw new Error("smoke listener owner does not match reported Harness PID");
  if (
    !ready.harnessHome ||
    !ready.resourceRoot ||
    !ready.systemNode?.executable
  )
    throw new Error("smoke evidence runtime provenance is incomplete");
  const lanManifest = join(
    ready.resourceRoot,
    "dsh-lan-access",
    "package.json",
  );
  if (
    !Array.isArray(ready.resources) ||
    !ready.resources.includes(lanManifest) ||
    !Array.isArray(final.resources) ||
    !final.resources.includes(lanManifest)
  ) {
    throw new Error("smoke evidence is missing dsh-lan-access/package.json");
  }
  const startedAt = Date.parse(evidence.startedAt ?? "");
  const readyAt = Date.parse(ready.timestamps?.readyAt ?? "");
  const finalAt = Date.parse(final.timestamps?.finalAt ?? "");
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(readyAt) ||
    !Number.isFinite(finalAt) ||
    readyAt < startedAt ||
    finalAt < readyAt
  )
    throw new Error("smoke evidence timestamps are not ordered");
  const requestedWindow = expected.maxDurationMs;
  const freshnessWindow =
    Number.isFinite(requestedWindow) && requestedWindow > 0
      ? Math.min(requestedWindow, SMOKE_TIMEOUT_MS)
      : 5 * 60_000;
  const readyDurationMs = readyAt - startedAt;
  if (readyDurationMs > freshnessWindow)
    throw new Error(
      `smoke ready duration ${readyDurationMs} ms exceeds deadline ${freshnessWindow} ms`,
    );
  if (finalAt - startedAt > freshnessWindow)
    throw new Error("smoke evidence exceeds the freshness window");
  return {
    origin: ready.harnessOrigin,
    appPid: ready.appPid,
    harnessPid: ready.harnessPid,
    port: Number(new URL(ready.harnessOrigin).port),
    readyDurationMs,
  };
}

function expectedNodeUrls(platform, architecture) {
  if (!["x64", "arm64"].includes(architecture))
    throw new Error(`unsupported Node installer architecture ${architecture}`);
  if (platform === "win32") {
    return {
      installerUrl: `https://nodejs.org/dist/v22.19.0/node-v22.19.0-${architecture}.msi`,
      archiveUrl: `https://nodejs.org/dist/v22.19.0/node-v22.19.0-win-${architecture}.zip`,
    };
  }
  if (platform === "darwin")
    return {
      installerUrl: "https://nodejs.org/dist/v22.19.0/node-v22.19.0.pkg",
      archiveUrl: `https://nodejs.org/dist/v22.19.0/node-v22.19.0-darwin-${architecture}.tar.gz`,
    };
  if (platform === "linux")
    return {
      installerUrl: "https://nodejs.org/en/download",
      archiveUrl: `https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-${architecture}.tar.xz`,
    };
  throw new Error(`unsupported Node installer platform ${platform}`);
}

function verifyNodeRequiredEvidence(evidence, expected) {
  const nodeRequired = evidence?.nodeRequired;
  if (
    evidence?.schema !== 2 ||
    evidence?.runId !== expected.runId ||
    nodeRequired?.runId !== expected.runId
  )
    throw new Error(
      "node-required evidence run nonce does not match current run",
    );
  if (
    nodeRequired?.phase !== "node-required" ||
    nodeRequired?.scenario !== "node-required" ||
    evidence.ready !== undefined ||
    evidence.final !== undefined
  )
    throw new Error("node-required evidence phase is invalid");
  assertEvidenceMetadata(nodeRequired, expected);
  if (evidence.startedAt !== expected.startedAt)
    throw new Error("node-required evidence metadata does not match startedAt");
  if (
    nodeRequired.platform !== expected.platform ||
    nodeRequired.architecture !== expected.runnerArchitecture
  )
    throw new Error(
      "node-required evidence platform or architecture is invalid",
    );
  const expectedUrls = expectedNodeUrls(
    expected.platform,
    expected.runnerArchitecture,
  );
  if (
    nodeRequired.minimumNodeVersion !== "22.19.0" ||
    nodeRequired.installerUrl !== expectedUrls.installerUrl ||
    nodeRequired.archiveUrl !== expectedUrls.archiveUrl
  )
    throw new Error(
      "node-required evidence does not use the official Node installer",
    );
  if (
    !Number.isInteger(nodeRequired.appPid) ||
    nodeRequired.appPid <= 0 ||
    nodeRequired.packaged !== true
  )
    throw new Error("node-required evidence application identity is invalid");
  if (
    nodeRequired.harnessStarted !== false ||
    nodeRequired.listenerObserved !== false ||
    "harnessOrigin" in nodeRequired ||
    "harnessPid" in nodeRequired ||
    "listenerPid" in nodeRequired
  )
    throw new Error(
      "node-required evidence must not report Harness origin, PID, or listener",
    );
  const evidenceStartedAt = Date.parse(evidence.startedAt ?? "");
  const nodeRequiredAt = Date.parse(
    nodeRequired.timestamps?.nodeRequiredAt ?? "",
  );
  const maxDurationMs = Math.min(
    Number.isFinite(expected.maxDurationMs) && expected.maxDurationMs > 0
      ? expected.maxDurationMs
      : SMOKE_TIMEOUT_MS,
    SMOKE_TIMEOUT_MS,
  );
  const nodeRequiredDurationMs = nodeRequiredAt - evidenceStartedAt;
  if (
    !Number.isFinite(evidenceStartedAt) ||
    !Number.isFinite(nodeRequiredAt) ||
    nodeRequiredDurationMs < 0 ||
    nodeRequiredDurationMs > maxDurationMs
  )
    throw new Error(
      "node-required evidence timestamp is outside the smoke deadline",
    );
  return { appPid: nodeRequired.appPid, nodeRequiredDurationMs };
}

function validateArtifactContract({
  matrixLabel,
  packageKind,
  expectedArchitecture,
  artifactFilename,
  artifactPath,
}) {
  const matrix = {
    "windows-x64": ["nsis", "x64"],
    "windows-arm64": ["nsis", "arm64"],
    "macos-universal": ["dmg", "universal"],
    "linux-x64": [["appimage", "deb"], "x64"],
    "linux-arm64": [["appimage", "deb"], "arm64"],
  }[matrixLabel];
  const packageKinds = Array.isArray(matrix?.[0]) ? matrix[0] : [matrix?.[0]];
  if (
    !matrix ||
    !packageKinds.includes(packageKind) ||
    matrix[1] !== expectedArchitecture
  )
    throw new Error("package matrix metadata is not allowlisted");
  const escapedArchitecture = expectedArchitecture.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  );
  const packagedArchitecture =
    expectedArchitecture === "x64" && packageKind === "appimage"
      ? "x86_64"
      : expectedArchitecture === "x64" && packageKind === "deb"
        ? "amd64"
        : escapedArchitecture;
  const artifactVersion = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;
  const packagePattern = {
    nsis: new RegExp(
      `^DeepSeek-Harness-Code-${artifactVersion}-windows-${escapedArchitecture}-setup\\.exe$`,
      "u",
    ),
    dmg: new RegExp(
      `^DeepSeek-Harness-Code-${artifactVersion}-mac-universal\\.dmg$`,
      "u",
    ),
    appimage: new RegExp(
      `^DeepSeek-Harness-Code-${artifactVersion}-linux-${packagedArchitecture}\\.AppImage$`,
      "u",
    ),
    deb: new RegExp(
      `^DeepSeek-Harness-Code-${artifactVersion}-linux-${packagedArchitecture}\\.deb$`,
      "u",
    ),
  }[packageKind];
  if (
    packagePattern === undefined ||
    !packagePattern.test(artifactFilename) ||
    basename(artifactPath) !== artifactFilename
  )
    throw new Error(
      "artifact filename or extension does not match package metadata",
    );
}

function matrixLabelFor(packageKind, expectedArchitecture) {
  const match = Object.entries({
    "windows-x64": ["nsis", "x64"],
    "windows-arm64": ["nsis", "arm64"],
    "macos-universal": ["dmg", "universal"],
    "linux-x64": [["appimage", "deb"], "x64"],
    "linux-arm64": [["appimage", "deb"], "arm64"],
  }).find(([, values]) => {
    const packageKinds = Array.isArray(values[0]) ? values[0] : [values[0]];
    return (
      packageKinds.includes(packageKind) && values[1] === expectedArchitecture
    );
  });
  if (!match) throw new Error("package matrix metadata is not allowlisted");
  return match[0];
}

async function assertResources(executable) {
  const resources = resolve(
    argument("--resources") ?? join(executable, "..", "resources"),
  );
  const required = [
    join(resources, "desktop-plugin", "package.json"),
    join(resources, "desktop-plugin", "client.js"),
    join(resources, "dsh-lan-access", "package.json"),
    join(resources, "anchored-standard-plugin", "package.json"),
    join(resources, "anchored-standard-plugin", "UPSTREAM.json"),
    join(resources, "anchored-standard-plugin", "UPSTREAM-SHA256SUMS"),
    join(resources, "anchored-standard-plugin", "preset", "agent.cordis.yml"),
    join(resources, "node-runtime", "package.json"),
    join(resources, "node-runtime", "pnpm.mjs"),
    join(resources, "routing-suite", "versions.json"),
    join(resources, "superpowers-skills", "UPSTREAM.json"),
    join(resources, "global-agent-prompt", "protocol.md"),
  ];
  for (const path of required) {
    await assertPathWithinRoot(path, resources);
    await access(path);
  }
  return required.map((path) => relative(root, path));
}

async function assertRuntimeProvenance(smokeEvidence, userData, resourcesRoot) {
  const ready = smokeEvidence.ready;
  for (const path of [
    ready.harnessHome,
    ready.resourceRoot,
    ready.systemNode.executable,
  ]) {
    if (typeof path !== "string" || !isAbsolute(path))
      throw new Error("runtime provenance paths must be absolute");
    await access(path);
  }
  await assertPathWithinRoot(ready.harnessHome, userData);
  const actualResourceRoot = await realpath(ready.resourceRoot);
  const expectedResourceRoot = await realpath(resourcesRoot);
  if (actualResourceRoot !== expectedResourceRoot)
    throw new Error("runtime resource root does not match packaged resources");
  const { stdout } = await execFileAsync(
    ready.systemNode.executable,
    ["--version"],
    {
      windowsHide: true,
    },
  );
  const match = stdout.trim().match(/^v(\d+)\.(\d+)\.(\d+)$/u);
  const major = Number(match?.[1]);
  const minor = Number(match?.[2]);
  if (!match || !((major === 22 && minor >= 19) || major >= 24))
    throw new Error("system Node must satisfy ^22.19.0 or >=24.0.0");
  if (ready.systemNode.version !== stdout.trim().slice(1))
    throw new Error("system Node version provenance does not match executable");
}

async function waitForPackagedExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timer);
      resolveExit(true);
    };
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolveExit(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

async function stopProcess(child, force = false) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  if (force && process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
    }).catch(() => undefined);
  } else if (force && child.pid !== undefined) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error)) throw error;
    }
  } else child.kill("SIGTERM");
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), 10_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit(true);
    });
  });
}

async function cleanupProcess(child) {
  if (
    child === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return;
  await stopProcess(child, true);
}

async function removeSmokeUserData(path, remove = rm) {
  await remove(path, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}

function assertKnownRunnerArchitecture(
  platform = process.platform,
  arch = process.arch,
) {
  if (!["darwin", "linux", "win32"].includes(platform))
    throw new Error(`unsupported smoke platform ${platform}`);
  if (!["x64", "arm64"].includes(arch))
    throw new Error(`unsupported ${platform} runner architecture ${arch}`);
}

async function inspectArchitecture(
  executable,
  {
    platform = process.platform,
    arch = process.arch,
    expectedArchitecture,
    runnerArchitecture,
    readFile: readExecutable = readFile,
    execFile: inspectExecutable = execFileAsync,
  } = {},
) {
  assertKnownRunnerArchitecture(platform, arch);
  assertKnownRunnerArchitecture(platform, runnerArchitecture);
  if (arch !== runnerArchitecture)
    throw new Error(
      `native host architecture ${arch} does not match runner architecture ${runnerArchitecture}`,
    );
  if (platform === "darwin") {
    if (expectedArchitecture !== "universal")
      throw new Error(
        `macOS expected architecture must be universal, got ${expectedArchitecture}`,
      );
  } else if (expectedArchitecture !== runnerArchitecture) {
    throw new Error(
      `package target architecture ${expectedArchitecture} does not match runner architecture ${runnerArchitecture}`,
    );
  }
  if (platform === "win32") {
    const machine = String(
      parseWindowsPeMachine(await readExecutable(executable)),
    );
    const expectedMachine = {
      x64: "34404",
      arm64: "43620",
    }[expectedArchitecture];
    if (machine !== expectedMachine)
      throw new Error(`unsupported Windows PE machine ${machine}`);
    return { runner: arch, platform, machine };
  }
  if (platform === "darwin") {
    const archs = await inspectExecutable("lipo", ["-archs", executable]).then(
      ({ stdout }) => stdout.trim(),
      () => undefined,
    );
    if (archs === undefined)
      throw new Error("native architecture inspection failed");
    const slices = new Set(archs.split(/\s+/u));
    if (!slices.has("x86_64") || !slices.has("arm64"))
      throw new Error(`macOS executable is not Universal: ${archs}`);
    return { runner: arch, platform, archs };
  }
  const file = await inspectExecutable("file", ["-b", executable]).then(
    ({ stdout }) => stdout.trim(),
    () => undefined,
  );
  if (file === undefined)
    throw new Error("native architecture inspection failed");
  const matchesRunner =
    arch === "x64"
      ? /\b(?:x86-64|x86_64|amd64)\b/iu.test(file)
      : /\b(?:ARM aarch64|aarch64|arm64)\b/iu.test(file);
  if (!matchesRunner)
    throw new Error(`unsupported Linux architecture: ${file}`);
  return { runner: arch, platform, file };
}

function parseWindowsPeMachine(bytes) {
  if (bytes.length < 64) throw new Error("Windows PE file is too small");
  const peOffset = bytes.readUInt32LE(60);
  if (peOffset + 6 > bytes.length)
    throw new Error("Windows PE header is outside the file");
  return bytes.readUInt16LE(peOffset + 4);
}

async function waitForEvidence(path, deadline, runId, phase) {
  const evidenceKey = phase === "node-required" ? "nodeRequired" : phase;
  while (Date.now() < deadline) {
    try {
      const evidence = JSON.parse(await readFile(path, "utf8"));
      if (
        phase === "node-required" &&
        evidence?.schema === 2 &&
        evidence?.runId === runId &&
        evidence?.ready?.phase === "ready"
      ) {
        throw new Error(
          "system Node remained resolvable during node-required smoke",
        );
      }
      if (
        evidence?.schema === 2 &&
        evidence?.runId === runId &&
        evidence?.[evidenceKey]?.phase === phase
      )
        return evidence;
    } catch (error) {
      const isTransientEvidenceRead =
        error instanceof SyntaxError ||
        (error instanceof Error &&
          "code" in error &&
          ["ENOENT", "EACCES"].includes(error.code));
      if (!isTransientEvidenceRead) throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(
    `packaged application did not publish ${phase} smoke evidence`,
  );
}

async function waitForEvidenceWithExitGrace({
  path,
  deadline,
  runId,
  phase,
  child,
  exitGraceMs = 2_000,
}) {
  let exitTimer;
  let onExit;
  const exitFailure = new Promise((_, reject) => {
    const scheduleFailure = (code, signal) => {
      const remaining = Math.max(0, deadline - Date.now());
      exitTimer = setTimeout(
        () =>
          reject(
            new Error(
              `packaged application exited before ${phase} evidence (code=${code ?? "null"}, signal=${signal ?? "null"})`,
            ),
          ),
        Math.min(exitGraceMs, remaining),
      );
    };
    onExit = scheduleFailure;
    if (child.exitCode !== null || child.signalCode !== null) {
      scheduleFailure(child.exitCode, child.signalCode);
    } else {
      child.once("exit", onExit);
    }
  });
  try {
    return await Promise.race([
      waitForEvidence(path, deadline, runId, phase),
      exitFailure,
    ]);
  } finally {
    if (onExit !== undefined) child.removeListener("exit", onExit);
    if (exitTimer !== undefined) clearTimeout(exitTimer);
  }
}

async function waitForSmokeAcknowledgement(path, deadline, runId, appPid) {
  while (Date.now() < deadline) {
    try {
      const acknowledgement = JSON.parse(await readFile(path, "utf8"));
      if (
        acknowledgement?.runId === runId &&
        acknowledgement?.appPid === appPid
      )
        return acknowledgement;
    } catch (error) {
      if (error instanceof Error && !["ENOENT", "EACCES"].includes(error.code))
        throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error("smoke ready acknowledgement timed out");
}

function verifySmokeReadyEvidence(evidence, expected) {
  const ready = evidence?.ready;
  if (
    evidence?.schema !== 2 ||
    evidence?.runId !== expected.runId ||
    ready?.runId !== expected.runId
  )
    throw new Error("smoke evidence run nonce does not match current run");
  if (ready?.phase !== "ready")
    throw new Error("smoke ready evidence is missing");
  assertEvidenceMetadata(ready, expected);
  if (evidence.startedAt !== expected.startedAt)
    throw new Error("smoke evidence metadata does not match startedAt");
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(ready.harnessOrigin))
    throw new Error("smoke evidence origin is not exact loopback HTTP");
  if (ready.readinessProbePassed !== true || ready.packaged !== true)
    throw new Error("smoke evidence readiness contract failed");
  if (
    !Number.isInteger(ready.appPid) ||
    ready.appPid <= 0 ||
    !Number.isInteger(ready.harnessPid) ||
    ready.harnessPid <= 0
  )
    throw new Error("smoke evidence PID is invalid");
  if (ready.harnessPid !== ready.listenerPid)
    throw new Error("smoke listener owner does not match reported Harness PID");
  const evidenceStartedAt = Date.parse(evidence.startedAt ?? "");
  const readyAt = Date.parse(ready.timestamps?.readyAt ?? "");
  const maxDurationMs = Math.min(
    Number.isFinite(expected.maxDurationMs) && expected.maxDurationMs > 0
      ? expected.maxDurationMs
      : SMOKE_TIMEOUT_MS,
    SMOKE_TIMEOUT_MS,
  );
  const readyDurationMs = readyAt - evidenceStartedAt;
  if (
    !Number.isFinite(evidenceStartedAt) ||
    !Number.isFinite(readyAt) ||
    readyDurationMs < 0
  )
    throw new Error("smoke ready evidence timestamps are not ordered");
  if (readyDurationMs > maxDurationMs)
    throw new Error(
      `smoke ready duration ${readyDurationMs} ms exceeds deadline ${maxDurationMs} ms`,
    );
  return {
    origin: ready.harnessOrigin,
    appPid: ready.appPid,
    harnessPid: ready.harnessPid,
    port: Number(new URL(ready.harnessOrigin).port),
    readyDurationMs,
  };
}

function assertPidDead(pid) {
  try {
    process.kill(pid, 0);
    throw new Error(`process ${pid} is still alive`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH")
      return;
    throw error;
  }
}

async function assertPortClosed(port) {
  const listeners = await listLoopbackListeners();
  if (listeners.some((listener) => listener.port === port))
    throw new Error(`Harness loopback port ${port} is still listening`);
}

async function assertPortOwned(port, pid) {
  const listeners = await listLoopbackListeners();
  const matching = listeners.filter((candidate) => candidate.port === port);
  if (matching.some((listener) => listener.pid === pid)) return;
  let platformOwners = [];
  if (process.platform === "linux") {
    platformOwners = await linuxLoopbackPortOwnerPids(port);
  } else if (process.platform === "win32") {
    platformOwners = await windowsListenerOwnerPids(port);
  }
  if (platformOwners.includes(pid)) return;
  const observedOwners = [
    ...matching.flatMap((listener) =>
      listener.pid === undefined ? [] : [listener.pid],
    ),
    ...platformOwners,
  ].filter((value, index, values) => values.indexOf(value) === index);
  if (observedOwners.length > 0) {
    throw new Error(
      `Harness listener ${port} is not owned by PID ${pid} (observed: ${observedOwners.join(", ")})`,
    );
  }
  // Hosted Windows/Linux runners can hide socket-owner and cross-process
  // liveness metadata even from same-user netstat, ss, PowerShell, /proc, and
  // signal-zero probes. In that bounded case, retain the security property
  // directly: the app has just published its random-port child identity, the
  // exact loopback URL returned HTTP 200, the same port must reject every
  // non-loopback interface address, and shutdown below must close that port.
  await assertPortNotReachableOffLoopback(port);
}

async function main() {
  const runId = randomUUID();
  const scenario = argument("--scenario") ?? "runtime";
  if (scenario !== "runtime" && scenario !== "node-required")
    throw new Error(`unsupported packaged smoke scenario ${scenario}`);
  const executable = findExecutable();
  const packageKind = requiredArgument("--package-kind");
  const expectedArchitecture = requiredArgument("--expected-architecture");
  const runnerArchitecture = requiredArgument("--runner-architecture");
  const artifactFilename = requiredArgument("--artifact-filename");
  const matrixLabel =
    argument("--matrix-label") ??
    matrixLabelFor(packageKind, expectedArchitecture);
  const artifactPath = argument("--artifact") ?? executable;
  const expectedArtifactHash =
    requiredArgument("--artifact-sha256").toLowerCase();
  const inventoryPath = argument("--inventory") ?? executable;
  validateArtifactContract({
    matrixLabel,
    packageKind,
    expectedArchitecture,
    artifactFilename,
    artifactPath,
  });
  const artifactSha256 = await checksum(artifactPath);
  const evidence = {
    schema: 2,
    runId,
    platform: process.platform,
    runnerArchitecture: process.arch,
    startedAt,
    scenario,
    artifact: {
      packageKind,
      expectedArchitecture,
      filename: artifactFilename,
      path: resolve(artifactPath),
      sha256: artifactSha256,
      inventory: await inventory(inventoryPath),
      architecture: await inspectArchitecture(executable, {
        expectedArchitecture,
        runnerArchitecture,
      }),
    },
    runtime: { executable: resolve(executable), resources: [] },
  };
  if (artifactSha256 !== expectedArtifactHash)
    throw new Error("packaged artifact SHA-256 does not match expected hash");
  await mkdir(evidenceRoot, { recursive: true });
  await assertEvidenceRootAllowed(evidenceRoot, metadataRoot);
  await assertPathWithinRoot(resolve(evidencePath), evidenceRoot);
  await assertPathWithinRoot(resolve(appEvidencePath), evidenceRoot);
  await assertPathNotSymlink(resolve(evidencePath));
  await assertPathNotSymlink(resolve(appEvidencePath));
  await assertPathNotSymlink(resolve(`${appEvidencePath}.ack`));
  await unlink(resolve(evidencePath)).catch((error) => {
    if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
  });
  await unlink(resolve(appEvidencePath)).catch((error) => {
    if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
  });
  await unlink(resolve(`${appEvidencePath}.ack`)).catch((error) => {
    if (!(error instanceof Error) || error.code !== "ENOENT") throw error;
  });
  const userData = await mkdtemp(join(evidenceRoot, ".user-data-"));
  let child;
  let childDiagnostics = "";
  let exitedCleanly = false;
  let finalization;
  const finalize = () => {
    finalization ??= (async () => {
      await cleanupProcess(child);
      evidence.finishedAt = new Date().toISOString();
      evidence.runtime.exitedCleanly = exitedCleanly;
      try {
        await writeEvidenceAtomically({
          evidencePath,
          evidenceRoot,
          content: `${JSON.stringify(evidence, null, 2)}\n`,
        });
      } finally {
        await removeSmokeUserData(userData);
      }
    })();
    return finalization;
  };
  const onInterrupt = createInterruptHandler(async () => {
    evidence.failure ??= "packaged smoke interrupted";
    await finalize();
  }, process.exit.bind(process));
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);
  const packagedLaunch = buildPackagedSmokeLaunch(process.platform, userData);
  const packagedEnvironment = buildPackagedSmokeEnvironment(
    process.platform,
    process.env,
    scenario,
  );
  child = spawn(executable, packagedLaunch.args, {
    cwd: root,
    env: {
      ...packagedEnvironment,
      APPDATA: join(userData, "appdata"),
      XDG_CONFIG_HOME: join(userData, "config"),
      XDG_DATA_HOME: join(userData, "data"),
      XDG_STATE_HOME: join(userData, "state"),
      XDG_CACHE_HOME: join(userData, "cache"),
      ...packagedLaunch.env,
      SMOKE_MODE: "ci",
      SMOKE_SCENARIO: scenario,
      SMOKE_EVIDENCE_PATH: resolve(appEvidencePath),
      SMOKE_ACK_PATH: resolve(`${appEvidencePath}.ack`),
      SMOKE_EVIDENCE_ROOT: evidenceRoot,
      SMOKE_USER_DATA_PATH: userData,
      SMOKE_RUN_ID: runId,
      MATRIX_LABEL: matrixLabel,
      PACKAGE_KIND: packageKind,
      EXPECTED_ARCHITECTURE: expectedArchitecture,
      ARTIFACT_FILENAME: artifactFilename,
      ARTIFACT_SHA256: artifactSha256,
      SMOKE_STARTED_AT: startedAt,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  // Always consume both pipes. First-launch package installation and Harness
  // diagnostics can exceed an OS pipe buffer; leaving them unread can block
  // the packaged process before it publishes ready evidence.
  const captureDiagnostic = (source, chunk) => {
    childDiagnostics = redactPackagedDiagnostic(
      `${childDiagnostics}\n[${source}] ${String(chunk)}`,
    );
  };
  child.stdout?.on("data", (chunk) => captureDiagnostic("stdout", chunk));
  child.stderr?.on("data", (chunk) => captureDiagnostic("stderr", chunk));
  const deadline = Date.now() + timeoutMs;
  try {
    child.once("exit", (code, signal) => {
      if (childDiagnostics.trim() !== "") {
        process.stderr.write(
          `packaged application diagnostics:${childDiagnostics}\n`,
        );
      }
      if (code !== null || signal !== null)
        process.stderr.write(
          `packaged application exited before evidence (code=${code ?? "null"}, signal=${signal ?? "null"})\n`,
        );
    });
    evidence.runtime.resources = await assertResources(executable);
    const expectedMetadata = {
      runId,
      matrixLabel,
      packageKind,
      expectedArchitecture,
      artifactFilename,
      artifactSha256,
      startedAt,
      platform: process.platform,
      runnerArchitecture,
      maxDurationMs: timeoutMs,
    };
    if (scenario === "node-required") {
      const nodeRequiredEvidence = await Promise.race([
        waitForEvidence(
          resolve(appEvidencePath),
          deadline,
          runId,
          "node-required",
        ),
        new Promise((_, reject) => {
          child.once("exit", (code, signal) =>
            reject(
              new Error(
                `packaged application exited before evidence (code=${code ?? "null"}, signal=${signal ?? "null"})`,
              ),
            ),
          );
        }),
      ]);
      const identity = verifyNodeRequiredEvidence(
        nodeRequiredEvidence,
        expectedMetadata,
      );
      evidence.runtime.nodeRequiredDurationMs = identity.nodeRequiredDurationMs;
      await writeFile(
        resolve(`${appEvidencePath}.ack`),
        `${JSON.stringify({ runId, appPid: identity.appPid })}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      const exitedNaturally = await waitForPackagedExit(child);
      if (!exitedNaturally) await stopProcess(child);
      exitedCleanly = child.exitCode === 0;
      evidence.runtime.exitCode = child.exitCode;
      evidence.runtime.exitedCleanly = exitedCleanly;
      if (!exitedCleanly || child.exitCode !== 0)
        throw new Error(`packaged application exited with ${child.exitCode}`);
      assertPidDead(identity.appPid);
    } else {
      const readyEvidence = await Promise.race([
        waitForEvidence(resolve(appEvidencePath), deadline, runId, "ready"),
        new Promise((_, reject) => {
          child.once("exit", (code, signal) =>
            reject(
              new Error(
                `packaged application exited before evidence (code=${code ?? "null"}, signal=${signal ?? "null"})`,
              ),
            ),
          );
        }),
      ]);
      const identity = verifySmokeReadyEvidence(
        readyEvidence,
        expectedMetadata,
      );
      evidence.runtime.readyDurationMs = identity.readyDurationMs;
      await assertRuntimeProvenance(
        readyEvidence,
        userData,
        resolve(argument("--resources") ?? join(executable, "..", "resources")),
      );
      evidence.runtime.loopback = {
        host: "127.0.0.1",
        port: identity.port,
        status: 200,
      };
      await assertPortOwned(identity.port, identity.harnessPid);
      await writeFile(
        resolve(`${appEvidencePath}.ack`),
        `${JSON.stringify({ runId, appPid: identity.appPid })}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
      const smokeEvidence = await waitForEvidenceWithExitGrace({
        path: resolve(appEvidencePath),
        deadline,
        runId,
        phase: "final",
        child,
      });
      verifySmokeEvidence(smokeEvidence, expectedMetadata);
      const exitedNaturally = await waitForPackagedExit(child);
      if (!exitedNaturally) await stopProcess(child);
      exitedCleanly = child.exitCode === 0;
      evidence.runtime.exitCode = child.exitCode;
      evidence.runtime.exitedCleanly = exitedCleanly;
      if (!exitedCleanly || child.exitCode !== 0)
        throw new Error(`packaged application exited with ${child.exitCode}`);
      assertPidDead(identity.harnessPid);
      assertPidDead(identity.appPid);
      await assertPortClosed(identity.port);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_500));
      await assertPortClosed(identity.port);
    }
  } catch (error) {
    if (childDiagnostics.trim() !== "") {
      evidence.runtime.diagnostics = childDiagnostics;
    }
    evidence.failure ??=
      error instanceof Error ? error.message : "packaged smoke failed";
    throw error;
  } finally {
    await finalize();
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
  }
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

export {
  assertKnownRunnerArchitecture,
  inspectArchitecture,
  listenerCommand,
  parseLoopbackListeners,
  parseLinuxListeningSocketInodes,
  parseWindowsListenerOwnerPids,
  nonLoopbackIpv4Addresses,
  assertPathWithinRoot,
  assertPathNotSymlink,
  assertEvidenceRootAllowed,
  assertPortOwned,
  createInterruptHandler,
  writeEvidenceAtomically,
  verifySmokeEvidence,
  verifyNodeRequiredEvidence,
  verifySmokeReadyEvidence,
  waitForEvidence,
  waitForSmokeAcknowledgement,
  validateArtifactContract,
  parseWindowsPeMachine,
  buildPackagedSmokeLaunch,
  buildPackagedSmokeEnvironment,
  systemNodeCandidateEntries,
  discoverSystemNodeVersionCandidates,
  shouldQuarantineNodeCandidate,
  buildSystemNodeQuarantinePlan,
  waitForPackagedExit,
  waitForEvidenceWithExitGrace,
  removeSmokeUserData,
  redactPackagedDiagnostic,
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--print-node-quarantine-paths")) {
    buildSystemNodeQuarantinePlan({})
      .then((plan) => {
        for (const entry of plan) process.stdout.write(`${entry.path}\n`);
      })
      .catch(() => {
        process.stderr.write("node quarantine planning failed\n");
        process.exitCode = 1;
      });
  } else
    main().catch((error) => {
      const message =
        error instanceof Error ? error.message : "packaged smoke failed";
      void (async () => {
        try {
          await mkdir(evidenceRoot, { recursive: true });
          await assertEvidenceRootAllowed(evidenceRoot, metadataRoot);
          await assertPathWithinRoot(resolve(evidencePath), evidenceRoot);
          await writeEvidenceAtomically({
            evidencePath,
            evidenceRoot,
            content: `${JSON.stringify({ schema: 2, startedAt, finishedAt: new Date().toISOString(), failure: message }, null, 2)}\n`,
            preserveExisting: true,
          });
        } catch (evidenceError) {
          if (!(evidenceError instanceof Error)) throw evidenceError;
        }
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
      })();
    });
}
