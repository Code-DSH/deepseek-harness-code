import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "vitest";

const execFileAsync = promisify(execFile);

test.skipIf(process.platform !== "win32")(
  "executes the Windows install-root and Node quarantine fixtures",
  async () => {
    const { stdout, stderr } = await execFileAsync(
      "pwsh",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        "tests/e2e/package-windows-host-helper.test.ps1",
      ],
      { cwd: process.cwd(), windowsHide: true, timeout: 30_000 },
    );

    expect(stderr).toBe("");
    expect(stdout.trim()).toBe("Windows package host helper fixtures passed");
  },
);
