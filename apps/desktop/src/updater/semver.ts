/**
 * Minimal SemVer parse + compare for the updater.
 *
 * Supports `MAJOR.MINOR.PATCH` with an optional `-prerelease` (dot-separated
 * identifiers) and follows the SemVer 2.0 comparison rules for the subset the
 * desktop app uses (e.g. `0.1.0-BETA1`). Build metadata is ignored.
 */

export interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** null when the version has no prerelease tag. */
  readonly prerelease: readonly string[] | null;
}

const PRERELEASE_IDENTIFIER = /^[0-9A-Za-z-]+$/;

export function parseSemver(raw: string): ParsedSemver {
  const input = raw.trim();
  const match = input.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?$/);
  if (match === null) {
    throw new Error(`updater/semver: not a valid x.y.z[-pre] version: ${raw}`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const preRaw = match[4];
  let prerelease: readonly string[] | null = null;
  if (preRaw !== undefined && preRaw.length > 0) {
    const ids = preRaw.split(".");
    for (const id of ids) {
      if (!PRERELEASE_IDENTIFIER.test(id)) {
        throw new Error(`updater/semver: invalid prerelease identifier: ${id}`);
      }
    }
    prerelease = ids;
  }
  return { major, minor, patch, prerelease };
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const ai = a[i];
    const bi = b[i];
    if (ai === undefined) return -1; // shorter prerelease is lower
    if (bi === undefined) return 1;
    const aIsNum = /^[0-9]+$/.test(ai);
    const bIsNum = /^[0-9]+$/.test(bi);
    if (aIsNum && bIsNum) {
      const aNum = Number(ai);
      const bNum = Number(bi);
      if (aNum !== bNum) return aNum < bNum ? -1 : 1;
      continue;
    }
    if (aIsNum !== bIsNum) return aIsNum ? -1 : 1; // numeric < alphanumeric
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  if (pa.prerelease === null && pb.prerelease === null) return 0;
  // A version with no prerelease is greater than one with a prerelease.
  if (pa.prerelease === null) return 1;
  if (pb.prerelease === null) return -1;
  const c = comparePrerelease(pa.prerelease, pb.prerelease);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}

export function isNewerVersion(remote: string, current: string): boolean {
  return compareSemver(remote, current) === 1;
}
