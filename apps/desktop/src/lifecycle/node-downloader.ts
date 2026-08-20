import { createHash } from "node:crypto";
import { type RequestOptions } from "node:http";
import {
  type RequestOptions as HttpsRequestOptions,
  request as httpsRequest,
} from "node:https";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { URL } from "node:url";

/**
 * The Node.js version the app downloads and installs for the user when no
 * system Node is detected. This is the minimum supported version — the same
 * floor enforced by {@link system-node.ts#MINIMUM_NODE_VERSION}.
 */
export const BUNDLED_NODE_VERSION = "22.13.0";

const NODE_DIST_BASE = "https://nodejs.org/dist";
const NODE_DOWNLOAD_PAGE = "https://nodejs.org/en/download";

export interface NodeDownloadUrls {
  /** Binary archive URL (tar.gz / zip / tar.xz) for programmatic extraction. */
  archiveUrl: string;
  /** Installer package URL (.pkg / .msi) for manual fallback, or the download page. */
  installerUrl: string;
  /** SHASUMS256.txt URL for checksum verification. */
  checksumUrl: string;
  /** The archive filename, used to look up the checksum. */
  archiveFilename: string;
}

function platformDistName(platform: NodeJS.Platform): string {
  if (platform === "darwin") return "darwin";
  if (platform === "win32") return "win";
  if (platform === "linux") return "linux";
  throw new Error(`Unsupported platform: ${platform}`);
}

function archiveExtension(platform: NodeJS.Platform): string {
  if (platform === "win32") return "zip";
  if (platform === "linux") return "tar.xz";
  return "tar.gz";
}

function supportedArch(arch: string): string {
  if (arch === "arm64" || arch === "x64") return arch;
  throw new Error(`Unsupported architecture: ${arch}`);
}

/**
 * Build the download URLs for the current platform and architecture.
 * - macOS: the `.pkg` installer is universal (not arch-specific).
 * - Windows: the `.msi` installer is arch-specific.
 * - Linux: no installer package exists; the manual fallback is the download page.
 */
export function getNodeDownloadUrls(
  platform: NodeJS.Platform,
  arch: string,
  version: string = BUNDLED_NODE_VERSION,
): NodeDownloadUrls {
  const distPlatform = platformDistName(platform);
  const distArch = supportedArch(arch);
  const ext = archiveExtension(platform);
  const archiveFilename = `node-v${version}-${distPlatform}-${distArch}.${ext}`;
  const archiveUrl = `${NODE_DIST_BASE}/v${version}/${archiveFilename}`;
  const checksumUrl = `${NODE_DIST_BASE}/v${version}/SHASUMS256.txt`;

  let installerUrl: string;
  if (platform === "darwin") {
    installerUrl = `${NODE_DIST_BASE}/v${version}/node-v${version}.pkg`;
  } else if (platform === "win32") {
    installerUrl = `${NODE_DIST_BASE}/v${version}/node-v${version}-${distArch}.msi`;
  } else {
    installerUrl = NODE_DOWNLOAD_PAGE;
  }

  return { archiveUrl, installerUrl, checksumUrl, archiveFilename };
}

// ── Host validation (security constraint) ─────────────────────────────

function isPrivateIPv4(octets: number[]): boolean {
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 0.0.0.0/8 (reserved)
  if (a === 0) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  return false;
}

function expandIPv6(addr: string): number[] {
  const parts = addr.split("::");
  if (parts.length > 2) return [];

  const parseGroup = (g: string): number => {
    const n = Number.parseInt(g, 16);
    return Number.isNaN(n) ? 0 : n;
  };

  let left: number[] = [];
  let right: number[] = [];

  if (parts[0] !== undefined && parts[0] !== "") {
    left = parts[0].split(":").map(parseGroup);
  }
  if (parts.length === 2 && parts[1] !== undefined && parts[1] !== "") {
    right = parts[1].split(":").map(parseGroup);
  }

  const missing = 8 - left.length - right.length;
  if (missing < 0) return [];
  const zeros = new Array<number>(missing).fill(0);
  return [...left, ...zeros, ...right];
}

function isBlockedIPv6(addr: string): boolean {
  const groups = expandIPv6(addr);
  if (groups.length !== 8) return false;

  // ::1 (loopback)
  if (groups.every((g, i) => (i === 7 ? g === 1 : g === 0))) return true;
  // :: (unspecified / reserved)
  if (groups.every((g) => g === 0)) return true;
  // fe80::/10 (link-local)
  if ((groups[0] ?? 0) === 0xfe80) return true;
  // fc00::/7 (unique local / private)
  if (((groups[0] ?? 0) & 0xfe00) === 0xfc00) return true;

  return false;
}

/**
 * Validate that a URL is safe to request. Only `https` is allowed. The host
 * must not be `localhost`, a loopback, private, or reserved address literal.
 * DNS is not re-resolved here; the only URLs ever fetched are the hardcoded
 * `nodejs.org` dist URLs built by {@link getNodeDownloadUrls}, so host control
 * comes from that constant rather than from caller input.
 */
export function assertAllowedDownloadUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `Only https downloads are allowed, got protocol: ${parsed.protocol}`,
    );
  }

  const hostname = parsed.hostname;

  if (hostname === "localhost" || hostname === "localhost.") {
    throw new Error("Downloads from localhost are not allowed");
  }

  // IPv4 literal
  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (isPrivateIPv4(octets)) {
      throw new Error(
        `Downloads from private/reserved/loopback addresses are not allowed: ${hostname}`,
      );
    }
  }

  // IPv6 literal (hostname includes brackets in URL parsing)
  const ipv6Match = hostname.match(/^\[([0-9a-fA-F:]+)\]$/);
  if (ipv6Match) {
    if (isBlockedIPv6(ipv6Match[1] ?? "")) {
      throw new Error(
        `Downloads from private/reserved/loopback addresses are not allowed: ${hostname}`,
      );
    }
  }
}

// ── Checksum extraction ───────────────────────────────────────────────

/**
 * Extract the SHA-256 checksum for a given filename from the content of the
 * official `SHASUMS256.txt` file. Each line has the format:
 * `<64-hex-char-checksum>  <filename>`
 */
export function extractChecksumFromShasums(
  shasumsContent: string,
  filename: string,
): string | undefined {
  const lines = shasumsContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const match = trimmed.match(/^([0-9a-fA-F]{64})\s+(.+)$/);
    if (match === null) continue;
    const checksum = match[1] ?? "";
    const name = (match[2] ?? "").trim();
    if (name === filename) {
      return checksum.toLowerCase();
    }
  }
  return undefined;
}

// ── File SHA-256 ──────────────────────────────────────────────────────

export async function computeFileSha256(filePath: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// ── Download ──────────────────────────────────────────────────────────

export interface DownloadProgress {
  received: number;
  total: number;
}

/**
 * Download a file via https with progress reporting. Validates the URL with
 * {@link assertAllowedDownloadUrl} before connecting. Redirects are followed
 * (each redirect is re-validated). Returns the path to the downloaded file.
 */
export async function downloadNodeArchive(
  url: string,
  destPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  maxRedirects = 5,
): Promise<string> {
  assertAllowedDownloadUrl(url);

  await mkdir(dirname(destPath), { recursive: true });

  return new Promise<string>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions: HttpsRequestOptions | RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: { "User-Agent": "DeepSeek-Harness-Code-Desktop" },
    };

    const req = httpsRequest(requestOptions, (res) => {
      // Follow redirects
      if (
        (res.statusCode === 301 ||
          res.statusCode === 302 ||
          res.statusCode === 307 ||
          res.statusCode === 308) &&
        typeof res.headers.location === "string"
      ) {
        if (maxRedirects <= 0) {
          reject(new Error("Too many redirects"));
          return;
        }
        const redirectUrl = new URL(res.headers.location, url).href;
        downloadNodeArchive(redirectUrl, destPath, onProgress, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }

      const total = Number.parseInt(res.headers["content-length"] ?? "0", 10);
      let received = 0;

      const writeStream: WriteStream = createWriteStream(destPath);
      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (onProgress && total > 0) {
          onProgress({ received, total });
        }
      });
      res.pipe(writeStream);
      writeStream.on("finish", () => {
        writeStream.close();
        resolve(destPath);
      });
      writeStream.on("error", reject);
    });

    req.on("error", reject);
    req.setTimeout(120_000, () => {
      req.destroy(new Error("Download timed out after 120s"));
    });
    req.end();
  });
}

/**
 * Fetch the content of the SHASUMS256.txt file for checksum verification.
 */
export async function fetchShasumsContent(
  checksumUrl: string,
): Promise<string> {
  assertAllowedDownloadUrl(checksumUrl);

  return new Promise<string>((resolve, reject) => {
    const parsedUrl = new URL(checksumUrl);
    const req = httpsRequest(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: "GET",
        headers: { "User-Agent": "DeepSeek-Harness-Code-Desktop" },
      },
      (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          typeof res.headers.location === "string"
        ) {
          fetchShasumsContent(new URL(res.headers.location, checksumUrl).href)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(
            new Error(`Failed to fetch SHASUMS256.txt: HTTP ${res.statusCode}`),
          );
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error("SHASUMS256.txt fetch timed out"));
    });
    req.end();
  });
}
