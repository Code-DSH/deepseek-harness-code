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
    } else if (url === "/range-file") {
      const payload = Buffer.from("abcdefghij");
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d+)$/u);
      if (range === undefined || range === null) {
        res.writeHead(416);
        res.end();
        return;
      }
      const start = Number(range[1]);
      const end = Math.min(Number(range[2]), payload.length - 1);
      res.writeHead(206, {
        "content-type": "application/octet-stream",
        "content-range": `bytes ${start}-${end}/${payload.length}`,
        "content-length": String(end - start + 1),
      });
      res.end(payload.subarray(start, end + 1));
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
    const progress: Array<{ downloadedBytes: number; totalBytes?: number }> =
      [];
    await downloadInstaller(
      `${base}/file`,
      dest,
      {
        validateUrl: testValidateUrl,
      },
      undefined,
      (value) => progress.push(value),
    );
    const buf = await readFile(dest);
    const expected = createHash("sha256")
      .update(Buffer.from("data"))
      .digest("hex");
    expect(createHash("sha256").update(buf).digest("hex")).toBe(expected);
    expect(progress.at(-1)).toMatchObject({ downloadedBytes: 4 });
  });

  it("downloads a GitHub-sized asset through range requests", async () => {
    const dest = join(dir, "ranged.bin");
    await downloadInstaller(
      `${base}/range-file`,
      dest,
      {
        validateUrl: testValidateUrl,
      },
      10,
    );
    await expect(readFile(dest, "utf8")).resolves.toBe("abcdefghij");
  });

  it("rejects an installer whose declared size exceeds the global limit", async () => {
    const dest = join(dir, "oversized.bin");
    await expect(
      downloadInstaller(
        `${base}/file`,
        dest,
        { validateUrl: testValidateUrl },
        512 * 1024 * 1024 + 1,
      ),
    ).rejects.toThrow(/exceeds 536870912 byte limit/);
  });

  it("rejects an oversized ranged response before writing any chunk", async () => {
    const dest = join(dir, "oversized-range.bin");
    const fetch = async () =>
      new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          "content-range": `bytes 0-0/${512 * 1024 * 1024 + 1}`,
          "content-length": "1",
        },
      });
    await expect(
      downloadInstaller("http://127.0.0.1/oversized-range", dest, {
        fetch,
        validateUrl: testValidateUrl,
      }),
    ).rejects.toThrow(/exceeds 536870912 byte limit/);
    await expect(readFile(dest)).rejects.toThrow();
  });

  it("rejects ranged bounds that extend past the declared total", async () => {
    const dest = join(dir, "invalid-range.bin");
    const fetch = async () =>
      new Response(new Uint8Array([0, 1]), {
        status: 206,
        headers: {
          "content-range": "bytes 0-1/1",
          "content-length": "2",
        },
      });
    await expect(
      downloadInstaller("http://127.0.0.1/invalid-range", dest, {
        fetch,
        validateUrl: testValidateUrl,
      }),
    ).rejects.toThrow(/invalid bounds/);
    await expect(readFile(dest)).rejects.toThrow();
  });
});
