import { describe, expect, it, vi } from "vitest";

const checkForUpdate = vi.hoisted(() => vi.fn());
const downloadAndVerifyUpdate = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.1.0",
  },
}));
vi.mock("../../../apps/desktop/src/updater/updater-config.js", () => ({
  getUpdaterConfig: () => ({ manifestUrl: "https://updates.example.test" }),
}));
vi.mock("../../../apps/desktop/src/updater/replace/index.js", () => ({
  createPlatformReplace: () => vi.fn(),
}));
vi.mock("../../../apps/desktop/src/updater/updater.js", () => ({
  checkForUpdate,
  downloadAndVerifyUpdate,
}));

import { UpdaterHost } from "../../../apps/desktop/src/lifecycle/updater-host.js";

const asset = {
  url: "https://updates.example.test/app.zip",
  size: 12,
  sha256: "a".repeat(64),
  format: "zip" as const,
};

describe("UpdaterHost", () => {
  it("clears a stale pending asset after a later check finds no update", async () => {
    checkForUpdate
      .mockResolvedValueOnce({
        available: true,
        manifest: { latestVersion: "0.2.0", notes: "first" },
        asset,
      })
      .mockResolvedValueOnce({ available: false });
    const host = new UpdaterHost({ tempDir: "/tmp/dsh-updater-host-test" });

    await expect(host.check()).resolves.toEqual({
      available: true,
      version: "0.2.0",
    });
    await expect(host.check()).resolves.toEqual({ available: false });
    await expect(host.apply()).resolves.toEqual({ available: false });

    expect(downloadAndVerifyUpdate).not.toHaveBeenCalled();
  });
});
