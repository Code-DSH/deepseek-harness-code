import { describe, expect, it } from "vitest";

import {
  ManifestParseError,
  parseUpdateManifest,
  platformAsset,
} from "../../../apps/desktop/src/updater/manifest.js";

const validManifest = {
  latestVersion: "0.1.0-BETA2",
  releasedAt: "2026-08-20T00:00:00Z",
  notes: "fix",
  assets: {
    darwin: {
      url: "https://github.com/a/b.zip",
      size: 10,
      sha256: "a".repeat(64),
      format: "zip",
    },
    win32: {
      url: "https://github.com/a/b.exe",
      size: 10,
      sha256: "b".repeat(64),
      format: "nsis",
    },
    linux: {
      url: "https://github.com/a/b.AppImage",
      size: 10,
      sha256: "c".repeat(64),
      format: "appimage",
    },
  },
} as const;

describe("updater/manifest parseUpdateManifest", () => {
  it("parses a valid manifest", () => {
    const m = parseUpdateManifest(validManifest);
    expect(m.latestVersion).toBe("0.1.0-BETA2");
    expect(m.assets.darwin.format).toBe("zip");
  });

  it("defaults notes to empty string when omitted", () => {
    const { notes: _notes, ...rest } = validManifest;
    void _notes;
    const m = parseUpdateManifest(rest);
    expect(m.notes).toBe("");
  });

  it("rejects a non-https url", () => {
    const bad = {
      ...validManifest,
      assets: {
        ...validManifest.assets,
        darwin: {
          ...validManifest.assets.darwin,
          url: "http://evil.example/b.zip",
        },
      },
    };
    expect(() => parseUpdateManifest(bad)).toThrow(ManifestParseError);
  });

  it("rejects a bad sha256", () => {
    const bad = {
      ...validManifest,
      assets: {
        ...validManifest.assets,
        win32: { ...validManifest.assets.win32, sha256: "short" },
      },
    };
    expect(() => parseUpdateManifest(bad)).toThrow(ManifestParseError);
  });

  it("rejects unknown top-level fields (strict)", () => {
    const bad = { ...validManifest, extra: 1 };
    expect(() => parseUpdateManifest(bad)).toThrow(ManifestParseError);
  });

  it("rejects a missing platform asset", () => {
    const { linux: _linux, ...restAssets } = validManifest.assets;
    void _linux;
    const bad = { ...validManifest, assets: restAssets };
    expect(() => parseUpdateManifest(bad)).toThrow(ManifestParseError);
  });
});

describe("updater/manifest platformAsset", () => {
  it("returns the asset for the given platform", () => {
    const m = parseUpdateManifest(validManifest);
    expect(platformAsset(m, "darwin").format).toBe("zip");
    expect(platformAsset(m, "linux").format).toBe("appimage");
  });
});
