import { describe, expect, it, vi } from "vitest";

import {
  createWin32Replace,
  resolveWindowsInstallDir,
} from "../../../apps/desktop/src/updater/replace/win32.js";

const asset = {
  url: "https://github.com/Code-DSH/deepseek-harness-code/releases/download/v1/app.exe",
  size: 1,
  sha256: "a".repeat(64),
  format: "nsis" as const,
};

describe("updater/replace/win32", () => {
  it("derives the install directory from the running executable", () => {
    expect(
      resolveWindowsInstallDir(
        "C:\\Users\\person\\AppData\\Local\\DHC\\DeepSeek Harness Code.exe",
      ),
    ).toBe("C:\\Users\\person\\AppData\\Local\\DHC");
  });

  it("passes the current custom install directory to NSIS", async () => {
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    const exit = vi.fn();
    const downloadedPath = "C:\\Users\\person\\Downloads\\update.exe";

    await createWin32Replace({
      execPath: "C:\\Tools\\DeepSeek Harness Code\\DeepSeek Harness Code.exe",
      spawn: spawn as never,
      exit,
    })(asset, downloadedPath);

    expect(spawn).toHaveBeenCalledWith(
      downloadedPath,
      ["/S", "--force-close", "/D=C:\\Tools\\DeepSeek Harness Code"],
      { detached: true, stdio: "ignore", shell: false },
    );
    expect(unref).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });
});
