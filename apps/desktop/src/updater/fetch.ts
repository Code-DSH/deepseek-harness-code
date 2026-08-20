import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable, Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

import { validateUpdateUrl, type ValidatedUpdateUrl } from "./host-policy.js";
import { parseUpdateManifest, type UpdateManifest } from "./manifest.js";

export interface FetchDeps {
  /** Override the global fetch (tests hit a loopback server). */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Override the URL validator (tests allow loopback; prod rejects it). */
  validateUrl?: (raw: string) => ValidatedUpdateUrl;
}

const MAX_MANIFEST_BYTES = 1024 * 1024; // 1 MiB
const MAX_INSTALLER_BYTES = 512 * 1024 * 1024; // 512 MiB
const TIMEOUT_MS = 5 * 60_000;
const MAX_REDIRECTS = 5;

interface ResolvedFetchDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  validateUrl: (raw: string) => ValidatedUpdateUrl;
}

function resolveDeps(deps?: FetchDeps): ResolvedFetchDeps {
  return {
    fetch: deps?.fetch ?? ((url, init) => fetch(url, init)),
    validateUrl: deps?.validateUrl ?? validateUpdateUrl,
  };
}

/** Transform that destroys the pipeline once total bytes exceed `limit`. */
class ByteLimitTransform extends Transform {
  private total = 0;
  constructor(private readonly limit: number) {
    super();
  }
  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    this.total += chunk.length;
    if (this.total > this.limit) {
      done(new Error(`updater/fetch: download exceeded ${this.limit} bytes`));
      return;
    }
    this.push(chunk);
    done();
  }
}

async function followRedirects(
  rawUrl: string,
  deps: ResolvedFetchDeps,
): Promise<Response> {
  let url = deps.validateUrl(rawUrl).href;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetch(url, {
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location === null) {
        throw new Error("updater/fetch: redirect without a location header");
      }
      // Re-validate the redirect target host before following.
      url = deps.validateUrl(new URL(location, url).href).href;
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `updater/fetch: unexpected status ${res.status} for ${url}`,
      );
    }
    return res;
  }
  throw new Error("updater/fetch: too many redirects");
}

export async function fetchManifest(
  rawUrl: string,
  deps?: FetchDeps,
): Promise<UpdateManifest> {
  const resolved = resolveDeps(deps);
  const res = await followRedirects(rawUrl, resolved);
  const text = await res.text();
  if (text.length > MAX_MANIFEST_BYTES) {
    throw new Error(
      `updater/fetch: manifest exceeded ${MAX_MANIFEST_BYTES} bytes`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `updater/fetch: manifest is not valid JSON: ${(err as Error).message}`,
    );
  }
  return parseUpdateManifest(json);
}

export async function downloadInstaller(
  rawUrl: string,
  destPath: string,
  deps?: FetchDeps,
): Promise<void> {
  const resolved = resolveDeps(deps);
  const res = await followRedirects(rawUrl, resolved);
  const body = res.body;
  if (body === null) {
    throw new Error("updater/fetch: installer response has no body");
  }
  await mkdir(dirname(destPath), { recursive: true });
  await pipeline(
    // fetch's Response.body is the DOM ReadableStream; Readable.fromWeb
    // expects node's stream/web ReadableStream. The two are structurally
    // identical but nominally distinct types.
    Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]),
    new ByteLimitTransform(MAX_INSTALLER_BYTES),
    createWriteStream(destPath),
  );
}
