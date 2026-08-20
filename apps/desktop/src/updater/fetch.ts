import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
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
const RANGE_CHUNK_BYTES = 32 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

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
  requestInit?: RequestInit,
): Promise<Response> {
  let url = deps.validateUrl(rawUrl).href;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetch(url, {
        ...requestInit,
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
  expectedSize?: number,
): Promise<void> {
  const resolved = resolveDeps(deps);
  await mkdir(dirname(destPath), { recursive: true });

  const streamResponseToFile = async (
    response: Response,
    path: string,
    flags: "w" | "a",
  ): Promise<void> => {
    const body = response.body;
    if (body === null) {
      throw new Error("updater/fetch: installer response has no body");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      await pipeline(
        // fetch's Response.body is the DOM ReadableStream; Readable.fromWeb
        // expects node's stream/web ReadableStream. The two are structurally
        // identical but nominally distinct types.
        Readable.fromWeb(
          body as unknown as Parameters<typeof Readable.fromWeb>[0],
        ),
        new ByteLimitTransform(MAX_INSTALLER_BYTES),
        createWriteStream(path, { flags }),
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }
  };

  const firstEnd = RANGE_CHUNK_BYTES - 1;
  const firstResponse = await followRedirects(rawUrl, resolved, {
    headers: { Range: `bytes=0-${firstEnd}` },
  });

  // Keep compatibility with simple HTTP servers and any future asset host
  // that does not support ranges. GitHub release assets return 206 here.
  if (firstResponse.status === 200) {
    await streamResponseToFile(firstResponse, destPath, "w");
    if (
      expectedSize !== undefined &&
      (await stat(destPath)).size !== expectedSize
    ) {
      throw new Error("updater/fetch: installer size mismatch");
    }
    return;
  }

  const parseContentRange = (value: string | null) => {
    const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+)$/u);
    if (match === null || match === undefined) {
      throw new Error(
        "updater/fetch: ranged response has invalid content-range",
      );
    }
    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: Number(match[3]),
    };
  };

  let nextStart = 0;
  let totalSize: number | undefined;
  let response: Response | undefined = firstResponse;
  while (response !== undefined) {
    let range = parseContentRange(response.headers.get("content-range"));
    if (response.status !== 206 || range.start !== nextStart) {
      throw new Error("updater/fetch: ranged response did not match request");
    }
    totalSize ??= range.total;
    if (
      range.total !== totalSize ||
      (expectedSize !== undefined && range.total !== expectedSize)
    ) {
      throw new Error("updater/fetch: ranged response size mismatch");
    }
    const partPath = `${destPath}.part-${range.start}`;
    let downloaded = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt += 1) {
      try {
        await unlink(partPath).catch(() => undefined);
        if (attempt > 0) {
          response = await followRedirects(rawUrl, resolved, {
            headers: {
              Range: `bytes=${range.start}-${Math.min(
                range.start + RANGE_CHUNK_BYTES - 1,
                range.total - 1,
              )}`,
            },
          });
          if (response.status !== 206) {
            throw new Error("updater/fetch: retry did not return a range");
          }
          range = parseContentRange(response.headers.get("content-range"));
          if (range.start !== nextStart || range.total !== totalSize) {
            throw new Error("updater/fetch: retry range changed");
          }
        }
        await streamResponseToFile(response, partPath, "w");
        const partSize = (await stat(partPath)).size;
        if (partSize !== range.end - range.start + 1) {
          throw new Error("updater/fetch: ranged chunk size mismatch");
        }
        await pipeline(
          createReadStream(partPath),
          createWriteStream(destPath, { flags: nextStart === 0 ? "w" : "a" }),
        );
        await unlink(partPath);
        downloaded = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!downloaded) {
      throw lastError instanceof Error
        ? lastError
        : new Error("updater/fetch: ranged chunk download failed");
    }
    nextStart = range.end + 1;
    if (nextStart >= totalSize) {
      response = undefined;
    } else {
      response = await followRedirects(rawUrl, resolved, {
        headers: {
          Range: `bytes=${nextStart}-${Math.min(
            nextStart + RANGE_CHUNK_BYTES - 1,
            totalSize - 1,
          )}`,
        },
      });
    }
  }

  if (
    expectedSize !== undefined &&
    (await stat(destPath)).size !== expectedSize
  ) {
    throw new Error("updater/fetch: installer size mismatch");
  }
}
