import { describe, expect, it } from "vitest";

import { buildUpdateManifest } from "../../scripts/generate-update-manifest.mjs";

describe("generate-update-manifest", () => {
  it("maps universal and architecture-specific release artifacts", () => {
    const manifest = buildUpdateManifest({
      version: "0.1.0-BETA2-1",
      tag: "v0.1.0-BETA2-1",
      releasedAt: "2026-08-20T00:00:00Z",
      notes: "Persistent Bash readiness fix.",
      artifacts: [
        {
          filename: "DeepSeek-Harness-Code-0.1.0-BETA2-1-mac-universal.zip",
          size: 10,
          sha256: "a".repeat(64),
        },
        {
          filename: "DeepSeek-Harness-Code-0.1.0-BETA2-1-windows-x64-setup.exe",
          size: 20,
          sha256: "b".repeat(64),
        },
        {
          filename:
            "DeepSeek-Harness-Code-0.1.0-BETA2-1-windows-arm64-setup.exe",
          size: 21,
          sha256: "c".repeat(64),
        },
        {
          filename: "DeepSeek-Harness-Code-0.1.0-BETA2-1-linux-x86_64.AppImage",
          size: 30,
          sha256: "d".repeat(64),
        },
        {
          filename: "DeepSeek-Harness-Code-0.1.0-BETA2-1-linux-arm64.AppImage",
          size: 31,
          sha256: "e".repeat(64),
        },
      ],
    });

    expect(manifest.latestVersion).toBe("0.1.0-BETA2-1");
    expect(manifest.assets.darwin.universal.format).toBe("zip");
    expect(manifest.assets.win32.arm64.size).toBe(21);
    expect(manifest.assets.linux.x64.size).toBe(30);
  });
});
