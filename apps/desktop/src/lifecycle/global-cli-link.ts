import { spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { childEnvWithNodeOnPath } from "./node-runtime.js";

export type GlobalDshCliStatus =
  | "installed"
  | "present"
  | "version-mismatch"
  | "failed";

export interface GlobalDshCliResult {
  status: GlobalDshCliStatus;
  pinnedVersion: string;
  installedVersion?: string;
  message?: string;
}

export interface NpmCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export type NpmRunner = (args: readonly string[]) => NpmCommandResult;

export interface EnsureGlobalDshCliInput {
  nodeExecutable: string;
  runtimeResourcePath: string;
  runNpm?: NpmRunner;
}

const DSH_PACKAGE = "@deepseek-ai/dsh";

/**
 * The pinned dsh version ships in the packaged node-runtime manifest, so the
 * globally installed CLI always matches the app's pinned Harness set.
 */
async function readPinnedDshVersion(
  runtimeResourcePath: string,
): Promise<string> {
  const manifest = JSON.parse(
    await readFile(join(runtimeResourcePath, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const version = manifest.dependencies?.[DSH_PACKAGE];
  if (typeof version !== "string" || version === "") {
    throw new Error(`${DSH_PACKAGE} is not pinned in the runtime manifest`);
  }
  return version;
}

/**
 * Resolve how to invoke npm on this machine: the npm-cli.js that ships inside
 * official Node installations (adjacent to the node executable) when present,
 * otherwise the `npm` command with the Node bin dir prepended to PATH so GUI
 * launches can find it. All invocations use a fixed argument list.
 */
function createDefaultNpmRunner(nodeExecutable: string): NpmRunner {
  const npmCli = join(
    dirname(nodeExecutable),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  let npmCliAvailable = false;
  try {
    accessSync(npmCli);
    npmCliAvailable = true;
  } catch {
    npmCliAvailable = false;
  }
  const env = childEnvWithNodeOnPath(nodeExecutable);
  return (args) => {
    const result = npmCliAvailable
      ? spawnSync(nodeExecutable, [npmCli, ...args], {
          encoding: "utf8",
          env,
          shell: false,
          windowsHide: true,
          timeout: 10 * 60_000,
        })
      : spawnSync("npm", [...args], {
          encoding: "utf8",
          env,
          shell: false,
          windowsHide: true,
          timeout: 10 * 60_000,
        });
    if (result.error !== undefined) {
      return {
        status: null,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        error: result.error,
      };
    }
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

function parseInstalledVersion(lsJson: string): string | undefined {
  try {
    const parsed = JSON.parse(lsJson) as {
      dependencies?: Record<string, { version?: unknown } | undefined>;
    };
    const entry = parsed.dependencies?.[DSH_PACKAGE];
    const version = entry?.version;
    return typeof version === "string" && version !== "" ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Make the official `dsh` command globally available, exactly like the
 * upstream one-liner (`npm install -g @deepseek-ai/dsh`). Runs at every
 * startup: installs the app's pinned version when the CLI is missing, leaves
 * an existing user installation untouched (noting version differences), and
 * never blocks app startup — failures degrade to a logged manual command.
 */
export async function ensureGlobalDshCli(
  input: EnsureGlobalDshCliInput,
): Promise<GlobalDshCliResult> {
  const pinnedVersion = await readPinnedDshVersion(input.runtimeResourcePath);
  const runNpm = input.runNpm ?? createDefaultNpmRunner(input.nodeExecutable);

  const listing = runNpm(["ls", "-g", DSH_PACKAGE, "--depth=0", "--json"]);
  if (listing.error !== undefined) {
    return {
      status: "failed",
      pinnedVersion,
      message: `npm is unavailable (${listing.error.message}); run "npm install -g ${DSH_PACKAGE}@${pinnedVersion}" manually for a global dsh command.`,
    };
  }
  const installedVersion = parseInstalledVersion(listing.stdout);
  if (installedVersion === pinnedVersion) {
    return { status: "present", pinnedVersion, installedVersion };
  }
  if (installedVersion !== undefined) {
    return {
      status: "version-mismatch",
      pinnedVersion,
      installedVersion,
      message: `A user-managed global dsh@${installedVersion} is installed; keeping it (the app pins ${pinnedVersion}).`,
    };
  }

  const install = runNpm(["install", "-g", `${DSH_PACKAGE}@${pinnedVersion}`]);
  if (install.error !== undefined || install.status !== 0) {
    const diagnostic =
      install.error?.message ?? String(install.stderr).slice(0, 500);
    return {
      status: "failed",
      pinnedVersion,
      message: `Global dsh install failed: ${diagnostic}. Run "npm install -g ${DSH_PACKAGE}@${pinnedVersion}" manually.`,
    };
  }
  return {
    status: "installed",
    pinnedVersion,
    installedVersion: pinnedVersion,
  };
}
