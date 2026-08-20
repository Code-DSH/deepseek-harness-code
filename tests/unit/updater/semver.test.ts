import { describe, expect, it } from "vitest";

import {
  compareSemver,
  isNewerVersion,
  parseSemver,
} from "../../../apps/desktop/src/updater/semver.js";

describe("updater/semver parseSemver", () => {
  it("parses a plain x.y.z version", () => {
    expect(parseSemver("0.1.0")).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      prerelease: null,
    });
  });

  it("parses a prerelease version like 0.1.0-BETA1", () => {
    expect(parseSemver("0.1.0-BETA1")).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      prerelease: ["BETA1"],
    });
  });

  it("parses a dot-separated prerelease", () => {
    expect(parseSemver("1.2.3-rc.4")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ["rc", "4"],
    });
  });

  it("rejects non-semver strings", () => {
    expect(() => parseSemver("latest")).toThrow();
    expect(() => parseSemver("1.2")).toThrow();
  });
});

describe("updater/semver compareSemver", () => {
  it("orders plain versions", () => {
    expect(compareSemver("0.1.0", "0.1.1")).toBe(-1);
    expect(compareSemver("0.2.0", "0.1.9")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });

  it("treats a prerelease as lower than its release", () => {
    expect(compareSemver("0.1.0-BETA1", "0.1.0")).toBe(-1);
    expect(compareSemver("0.1.0", "0.1.0-BETA1")).toBe(1);
  });

  it("orders prereleases of the same release", () => {
    expect(compareSemver("0.1.0-BETA1", "0.1.0-BETA2")).toBe(-1);
    expect(compareSemver("0.1.0-rc.1", "0.1.0-rc.2")).toBe(-1);
  });

  it("orders a hyphenated release suffix after its base preview", () => {
    expect(compareSemver("0.1.0-BETA2-1", "0.1.0-BETA2")).toBe(1);
    expect(compareSemver("0.1.0-BETA2-1", "0.1.0-BETA2-2")).toBe(-1);
  });

  it("ranks a numeric prerelease below an alphanumeric one", () => {
    expect(compareSemver("0.1.0-1", "0.1.0-alpha")).toBe(-1);
  });
});

describe("updater/semver isNewerVersion", () => {
  it("returns true only when remote is strictly newer", () => {
    expect(isNewerVersion("0.1.0-BETA2", "0.1.0-BETA1")).toBe(true);
    expect(isNewerVersion("0.1.0-BETA1", "0.1.0-BETA1")).toBe(false);
    expect(isNewerVersion("0.1.0-BETA1", "0.1.0-BETA2")).toBe(false);
  });
});
