/**
 * Host policy for updater fetches.
 *
 * Every manifest and installer URL the updater follows must be https on a host
 * in a small allow-list, and must never resolve to localhost, loopback,
 * private, or reserved addresses. Redirects are re-validated by the fetcher.
 */

const ALLOWED_HOSTS = new Set<string>([
  "github.com",
  "objects.githubusercontent.com",
  "raw.githubusercontent.com",
  "codeload.github.com",
]);

export interface HostVerdict {
  readonly ok: boolean;
  readonly host: string;
  readonly reason?: string;
}

export function isPrivateOrLoopbackHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower === "::1" || lower === "[::1]") return true;

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;

  return false;
}

export function classifyHost(host: string): HostVerdict {
  const lower = host.toLowerCase();
  if (isPrivateOrLoopbackHost(lower)) {
    return { ok: false, host, reason: "host is loopback/private/reserved" };
  }
  if (!ALLOWED_HOSTS.has(lower)) {
    return { ok: false, host, reason: "host not in update allow-list" };
  }
  return { ok: true, host };
}

export interface ValidatedUpdateUrl {
  readonly href: string;
  readonly host: string;
}

export function validateUpdateUrl(raw: string): ValidatedUpdateUrl {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`updater/host-policy: not a valid url: ${raw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`updater/host-policy: url must be https: ${raw}`);
  }
  const verdict = classifyHost(parsed.hostname);
  if (!verdict.ok) {
    throw new Error(
      `updater/host-policy: ${verdict.reason ?? "host not allowed"}: ${parsed.hostname}`,
    );
  }
  return { href: parsed.href, host: parsed.hostname };
}
