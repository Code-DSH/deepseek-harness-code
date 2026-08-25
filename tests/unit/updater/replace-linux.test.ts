import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLinuxReplace,
  resolveLinuxAppImageTarget,
} from "../../../apps/desktop/src/updater/replace/linux.js";

const asset = {
  url: "https://github.com/Code-DSH/deepseek-harness-code/releases/download/v1/app.AppImage",
  size: 1,
  sha256: "a".repeat(64),
  format: "appimage" as const,
};

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("updater/replace/linux", () => {
  it("prefers the persistent APPIMAGE path over the mounted executable", () => {
    expect(
      resolveLinuxAppImageTarget("/tmp/.mount-dsh/app", {
        APPIMAGE: "/Applications/DeepSeek-Harness-Code.AppImage",
      }),
    ).toBe("/Applications/DeepSeek-Harness-Code.AppImage");
  });

  it("ignores a relative APPIMAGE override", () => {
    expect(
      resolveLinuxAppImageTarget("/tmp/.mount-dsh/app", { APPIMAGE: "app" }),
    ).toBe("/tmp/.mount-dsh/app");
  });

  it("swaps and relaunches the persistent AppImage target", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-linux-replace-"));
    tempRoots.push(root);
    const target = join(root, "installed.AppImage");
    const downloaded = join(root, "downloaded.AppImage");
    writeFileSync(target, "old");
    writeFileSync(downloaded, "new");
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    const exit = vi.fn();

    await createLinuxReplace({
      execPath: "/tmp/.mount-dsh/app",
      env: { APPIMAGE: target },
      spawn: spawn as never,
      exit,
    })(asset, downloaded);

    expect(readFileSync(target, "utf8")).toBe("new");
    expect(spawn).toHaveBeenCalledWith(target, [], {
      detached: true,
      stdio: "ignore",
    });
    expect(unref).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });
});
