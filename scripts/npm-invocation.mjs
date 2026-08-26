import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const defaultPathApi = { basename, dirname, join };

export function resolveNpmInvocation({
  execPath = process.execPath,
  platform = process.platform,
  npmExecPath = process.env.npm_execpath,
  exists = existsSync,
  pathApi = defaultPathApi,
} = {}) {
  const nodeBinRoot = pathApi.dirname(execPath);
  const npmCliCandidates = [
    npmExecPath,
    platform === "win32"
      ? pathApi.join(nodeBinRoot, "node_modules", "npm", "bin", "npm-cli.js")
      : pathApi.join(
          pathApi.dirname(nodeBinRoot),
          "lib",
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js",
        ),
  ];
  const npmCli = npmCliCandidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      pathApi.basename(candidate).toLowerCase() === "npm-cli.js" &&
      exists(candidate),
  );
  if (npmCli !== undefined) {
    return { command: execPath, args: [npmCli], shell: false };
  }

  // Homebrew's Node package keeps npm under its installation prefix rather
  // than next to the versioned Node binary. Use the npm command on PATH as a
  // portable fallback instead of assuming either layout.
  return {
    command: platform === "win32" ? "npm.cmd" : "npm",
    args: [],
    shell: platform === "win32",
  };
}
