/**
 * Runtime configuration for the auto-updater.
 *
 * The manifest URL points at a GitHub release asset by default
 * (https://github.com/Code-DSH/deepseek-harness-code/releases/latest/download/update-manifest.json),
 * which the host policy allows (GitHub redirects release downloads through
 * release-assets.githubusercontent.com, which is also in the allow-list).
 *
 * A dev/test escape hatch (`DSC_UPDATER_ALLOW_LOOPBACK=1`) relaxes the URL
 * policy AND injects a file-backed fetch so a local manifest + installer can
 * exercise the full download → verify → replace flow without any network,
 * http server, or TLS. The manifest/installer are served from local files
 * named by `DSC_UPDATER_LOCAL_MANIFEST` and `DSC_UPDATER_LOCAL_ZIP`. The
 * manifest's asset URLs still satisfy the strict zod schema (they are https
 * placeholder URLs; the injected fetch serves bytes by path suffix). Production
 * builds MUST NOT set any of these env vars; the security-contract check
 * rejects them in a packaged app.
 */
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

import type { FetchDeps } from "./fetch.js";
import type { ValidatedUpdateUrl } from "./host-policy.js";

export interface UpdaterConfig {
  manifestUrl: string;
  fetchDeps?: FetchDeps;
}

const DEFAULT_MANIFEST_URL =
  "https://github.com/Code-DSH/deepseek-harness-code/releases/latest/download/update-manifest.json";

/** Permissive validator used only when the loopback dev escape is enabled. */
function allowLoopbackValidateUrl(raw: string): ValidatedUpdateUrl {
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    host = raw;
  }
  return { href: raw, host };
}

/**
 * Dev-only fetch that serves the manifest + installer from local files (no
 * network, no http server). Routes by URL path suffix: `*.json` → the manifest
 * file, `*.zip`/`*.dmg` → the installer file (streamed).
 */
function makeLoopbackFileFetch(): NonNullable<FetchDeps["fetch"]> {
  const manifestPath = process.env.DSC_UPDATER_LOCAL_MANIFEST;
  const zipPath = process.env.DSC_UPDATER_LOCAL_ZIP;
  return async (url: string) => {
    const pathname = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();
    if (pathname.endsWith(".json") || pathname.includes("manifest")) {
      if (!manifestPath) {
        throw new Error(
          "updater: DSC_UPDATER_LOCAL_MANIFEST not set (loopback dev escape)",
        );
      }
      const body = await readFile(manifestPath);
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (pathname.endsWith(".zip") || pathname.endsWith(".dmg")) {
      if (!zipPath) {
        throw new Error(
          "updater: DSC_UPDATER_LOCAL_ZIP not set (loopback dev escape)",
        );
      }
      const stream = Readable.toWeb(
        createReadStream(zipPath),
      ) as unknown as ReadableStream<Uint8Array>;
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }
    return new Response("not found", { status: 404 });
  };
}

export function getUpdaterConfig(): UpdaterConfig {
  const allowLoopback = process.env.DSC_UPDATER_ALLOW_LOOPBACK === "1";
  if (allowLoopback) {
    const manifestUrl =
      process.env.DSC_UPDATER_MANIFEST_URL ??
      "https://update.local/update-manifest.json";
    process.stderr.write(
      "updater: DSC_UPDATER_ALLOW_LOOPBACK=1 — serving manifest+installer from local files (dev/test only)\n",
    );
    return {
      manifestUrl,
      fetchDeps: {
        validateUrl: allowLoopbackValidateUrl,
        fetch: makeLoopbackFileFetch(),
      },
    };
  }
  return {
    manifestUrl: process.env.DSC_UPDATER_MANIFEST_URL ?? DEFAULT_MANIFEST_URL,
  };
}
