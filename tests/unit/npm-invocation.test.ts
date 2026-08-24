import { posix, win32 } from "node:path";

import { describe, expect, test } from "vitest";

import { resolveNpmInvocation } from "../../scripts/npm-invocation.mjs";

describe("npm invocation resolution", () => {
  test("uses a verified npm CLI passed by the current npm process", () => {
    const npmCli = "/toolchain/npm/bin/npm-cli.js";

    expect(
      resolveNpmInvocation({
        execPath: "/toolchain/node/bin/node",
        platform: "darwin",
        npmExecPath: npmCli,
        exists: (candidate: string) => candidate === npmCli,
        pathApi: posix,
      }),
    ).toEqual({
      command: "/toolchain/node/bin/node",
      args: [npmCli],
      shell: false,
    });
  });

  test("falls back to PATH npm for a Homebrew versioned Node layout", () => {
    expect(
      resolveNpmInvocation({
        execPath: "/opt/homebrew/Cellar/node/26.7.0/bin/node",
        platform: "darwin",
        exists: () => false,
        pathApi: posix,
      }),
    ).toEqual({ command: "npm", args: [], shell: false });
  });

  test("uses npm.cmd through the Windows shell when no CLI path is available", () => {
    expect(
      resolveNpmInvocation({
        execPath: "C:\\Program Files\\nodejs\\node.exe",
        platform: "win32",
        exists: () => false,
        pathApi: win32,
      }),
    ).toEqual({ command: "npm.cmd", args: [], shell: true });
  });
});
