import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyUpdate,
  checkForUpdate,
  type UpdaterDeps,
} from "../../../apps/desktop/src/updater/updater.js";
import { type ValidatedUpdateUrl } from "../../../apps/desktop/src/updater/host-policy.js";

function makeManifest(latestVersion: string) {
  return {
    latestVersion,
    releasedAt: "2026-08-20T00:00:00Z",
    notes: "",
    assets: {
      darwin: {
        url: "https://github.com/a/b.zip",
        size: 4,
        sha256: "a".repeat(64),
        format: "zip",
      },
      win32: {
        url: "https://github.com/a/b.exe",
        size: 4,
        sha256: "b".repeat(64),
        format: "nsis",
      },
      linux: {
        url: "https://github.com/a/b.AppImage",
        size: 4,
        sha256: "c".repeat(64),
        format: "appimage",
      },
    },
  } as const;
}

function stubManifestFetch(manifestObj: unknown) {
  return async () =>
    new Response(JSON.stringify(manifestObj), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

function permissiveValidate(raw: string): ValidatedUpdateUrl {
  const parsed = new URL(raw);
  return { href: parsed.href, host: parsed.hostname };
}

describe("updater checkForUpdate", () => {
  it("reports available when the remote version is newer", async () => {
    const deps: UpdaterDeps = {
      manifestUrl: "https://github.com/x/update-manifest.json",
      currentVersion: "0.1.0-BETA1",
      platform: "darwin",
      tempDir: "/tmp",
      replace: async () => {},
      fetchDeps: {
        fetch: stubManifestFetch(makeManifest("0.1.0-BETA2")),
        validateUrl: permissiveValidate,
      },
    };
    const r = await checkForUpdate(deps);
    expect(r.available).toBe(true);
    expect(r.asset?.format).toBe("zip");
  });

  it("reports unavailable when the remote version is not newer", async () => {
    const deps: UpdaterDeps = {
      manifestUrl: "https://github.com/x/update-manifest.json",
      currentVersion: "0.1.0-BETA2",
      platform: "darwin",
      tempDir: "/tmp",
      replace: async () => {},
      fetchDeps: {
        fetch: stubManifestFetch(makeManifest("0.1.0-BETA2")),
        validateUrl: permissiveValidate,
      },
    };
    const r = await checkForUpdate(deps);
    expect(r.available).toBe(false);
  });
});

describe("updater applyUpdate", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `updater-orch-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("downloads, verifies, and calls replace with the right path", async () => {
    const calls: string[] = [];
    const asset = makeManifest("0.1.0-BETA2").assets.darwin;
    const deps: UpdaterDeps = {
      manifestUrl: "x",
      currentVersion: "0.1.0",
      platform: "darwin",
      tempDir: dir,
      replace: async (_asset, dest) => {
        calls.push(`replace:${dest}`);
      },
      download: async (url, dest) => {
        await writeFile(dest, Buffer.from("payload"));
        calls.push(`download:${url}`);
      },
      verify: async () => {
        calls.push("verify");
        return true;
      },
    };
    await applyUpdate(deps, asset);
    expect(calls).toEqual([
      `download:${asset.url}`,
      "verify",
      `replace:${join(dir, "b.zip")}`,
    ]);
  });

  it("aborts before replace on a sha256 mismatch", async () => {
    const asset = makeManifest("0.1.0-BETA2").assets.darwin;
    let replaced = false;
    const deps: UpdaterDeps = {
      manifestUrl: "x",
      currentVersion: "0.1.0",
      platform: "darwin",
      tempDir: dir,
      replace: async () => {
        replaced = true;
      },
      download: async (_url, dest) => {
        await writeFile(dest, Buffer.from("x"));
      },
      verify: async () => false,
    };
    await expect(applyUpdate(deps, asset)).rejects.toThrow(/sha256 mismatch/);
    expect(replaced).toBe(false);
  });
});
