import { createHash } from "node:crypto";
import { type AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  downloadInstaller,
  fetchManifest,
} from "../../../apps/desktop/src/updater/fetch.js";
import {
  validateUpdateUrl,
  type ValidatedUpdateUrl,
} from "../../../apps/desktop/src/updater/host-policy.js";

// Test validator: allows the loopback http server, falls back to the strict
// policy for any non-loopback host so redirects to external hosts are rejected.
function testValidateUrl(raw: string): ValidatedUpdateUrl {
  const parsed = new URL(raw);
  const host = parsed.hostname;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("updater/fetch: url must be http(s)");
  }
  if (host === "127.0.0.1" || host === "localhost") {
    return { href: parsed.href, host };
  }
  return validateUpdateUrl(raw);
}

const validManifest = {
  latestVersion: "0.1.0-BETA2",
  releasedAt: "2026-08-20T00:00:00Z",
  notes: "fix",
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

function startServer(): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/manifest") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(validManifest));
    } else if (url === "/file") {
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(Buffer.from("data"));
    } else if (url === "/redirect-to-manifest") {
      res.writeHead(302, { location: "/manifest" });
      res.end();
    } else if (url === "/redirect-to-external") {
      res.writeHead(302, { location: "https://evil.example/x" });
      res.end();
    } else {
      res.writeHead(404);
      res.end("nope");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe("updater/fetch", () => {
  let server: Server;
  let base: string;
  let dir: string;

  beforeEach(async () => {
    const started = await startServer();
    server = started.server;
    base = started.base;
    dir = join(
      tmpdir(),
      `updater-fetch-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await rm(dir, { recursive: true, force: true });
  });

  it("fetchManifest fetches and parses the manifest", async () => {
    const m = await fetchManifest(`${base}/manifest`, {
      validateUrl: testValidateUrl,
    });
    expect(m.latestVersion).toBe("0.1.0-BETA2");
  });

  it("fetchManifest rejects on 404", async () => {
    await expect(
      fetchManifest(`${base}/missing`, { validateUrl: testValidateUrl }),
    ).rejects.toThrow();
  });

  it("follows same-origin redirects after re-validating", async () => {
    const m = await fetchManifest(`${base}/redirect-to-manifest`, {
      validateUrl: testValidateUrl,
    });
    expect(m.latestVersion).toBe("0.1.0-BETA2");
  });

  it("rejects a redirect to a non-allow-listed external host", async () => {
    await expect(
      fetchManifest(`${base}/redirect-to-external`, {
        validateUrl: testValidateUrl,
      }),
    ).rejects.toThrow();
  });

  it("downloadInstaller streams the bytes to disk", async () => {
    const dest = join(dir, "out.bin");
    await downloadInstaller(`${base}/file`, dest, {
      validateUrl: testValidateUrl,
    });
    const buf = await readFile(dest);
    const expected = createHash("sha256")
      .update(Buffer.from("data"))
      .digest("hex");
    expect(createHash("sha256").update(buf).digest("hex")).toBe(expected);
  });
});
