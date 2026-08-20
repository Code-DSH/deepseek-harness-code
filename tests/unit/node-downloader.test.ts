import { describe, expect, it } from "vitest";

import {
  assertAllowedDownloadUrl,
  extractChecksumFromShasums,
  getNodeDownloadUrls,
  BUNDLED_NODE_VERSION,
} from "../../apps/desktop/src/lifecycle/node-downloader.js";

describe("getNodeDownloadUrls", () => {
  it("returns the arm64 archive and universal pkg installer for macOS arm64", () => {
    const urls = getNodeDownloadUrls("darwin", "arm64");
    expect(urls.archiveUrl).toBe(
      `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}-darwin-arm64.tar.gz`,
    );
    expect(urls.installerUrl).toBe(
      `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}.pkg`,
    );
    expect(urls.checksumUrl).toBe(
      `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/SHASUMS256.txt`,
    );
    expect(urls.archiveFilename).toBe(
      `node-v${BUNDLED_NODE_VERSION}-darwin-arm64.tar.gz`,
    );
  });

  it("returns the x64 archive and universal pkg installer for macOS x64", () => {
    const urls = getNodeDownloadUrls("darwin", "x64");
    expect(urls.archiveUrl).toContain("darwin-x64.tar.gz");
    expect(urls.installerUrl).toBe(
      `https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/node-v${BUNDLED_NODE_VERSION}.pkg`,
    );
  });

  it("returns the x64 zip and arch-specific msi for Windows x64", () => {
    const urls = getNodeDownloadUrls("win32", "x64");
    expect(urls.archiveUrl).toContain("win-x64.zip");
    expect(urls.installerUrl).toContain("x64.msi");
  });

  it("returns the arm64 zip and arch-specific msi for Windows arm64", () => {
    const urls = getNodeDownloadUrls("win32", "arm64");
    expect(urls.archiveUrl).toContain("win-arm64.zip");
    expect(urls.installerUrl).toContain("arm64.msi");
  });

  it("returns the x64 tar.xz and download page for Linux x64", () => {
    const urls = getNodeDownloadUrls("linux", "x64");
    expect(urls.archiveUrl).toContain("linux-x64.tar.xz");
    expect(urls.installerUrl).toBe("https://nodejs.org/en/download");
  });

  it("returns the arm64 tar.xz and download page for Linux arm64", () => {
    const urls = getNodeDownloadUrls("linux", "arm64");
    expect(urls.archiveUrl).toContain("linux-arm64.tar.xz");
    expect(urls.installerUrl).toBe("https://nodejs.org/en/download");
  });

  it("throws for an unsupported platform", () => {
    expect(() =>
      getNodeDownloadUrls("aix" as NodeJS.Platform, "x64"),
    ).toThrow();
  });

  it("throws for an unsupported arch", () => {
    expect(() => getNodeDownloadUrls("darwin", "ia32")).toThrow();
  });
});

describe("assertAllowedDownloadUrl", () => {
  it("accepts a valid https URL to nodejs.org", () => {
    expect(() =>
      assertAllowedDownloadUrl(
        "https://nodejs.org/dist/v22.13.0/SHASUMS256.txt",
      ),
    ).not.toThrow();
  });

  it("rejects an http URL", () => {
    expect(() =>
      assertAllowedDownloadUrl("http://nodejs.org/dist/v22.13.0/test.tar.gz"),
    ).toThrow(/https/i);
  });

  it("rejects localhost", () => {
    expect(() =>
      assertAllowedDownloadUrl("https://localhost:8080/test"),
    ).toThrow(/localhost/i);
  });

  it("rejects a loopback IPv4 address", () => {
    expect(() => assertAllowedDownloadUrl("https://127.0.0.1/test")).toThrow(
      /loopback|127/i,
    );
  });

  it("rejects a private 10.x address", () => {
    expect(() => assertAllowedDownloadUrl("https://10.0.0.1/test")).toThrow(
      /private|10\./i,
    );
  });

  it("rejects a private 192.168.x address", () => {
    expect(() => assertAllowedDownloadUrl("https://192.168.1.1/test")).toThrow(
      /private|192\.168/i,
    );
  });

  it("rejects a private 172.16.x address", () => {
    expect(() => assertAllowedDownloadUrl("https://172.16.0.1/test")).toThrow(
      /private|172\./i,
    );
  });

  it("rejects the 0.0.0.0 reserved address", () => {
    expect(() => assertAllowedDownloadUrl("https://0.0.0.0/test")).toThrow(
      /reserved|0\.0\.0\.0/i,
    );
  });

  it("rejects an IPv6 loopback address", () => {
    expect(() => assertAllowedDownloadUrl("https://[::1]/test")).toThrow(
      /loopback|::1/i,
    );
  });
});

describe("extractChecksumFromShasums", () => {
  const shasums = [
    "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08  node-v22.13.0-darwin-arm64.tar.gz",
    "a591a6d40bf0082038c5d2c72f1e2e2c2b0b822cd15d6c15b0f00a08  node-v22.13.0-darwin-x64.tar.gz",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  node-v22.13.0.pkg",
  ].join("\n");

  it("extracts the checksum for a known filename", () => {
    const checksum = extractChecksumFromShasums(
      shasums,
      "node-v22.13.0-darwin-arm64.tar.gz",
    );
    expect(checksum).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("extracts the checksum for the pkg installer", () => {
    const checksum = extractChecksumFromShasums(shasums, "node-v22.13.0.pkg");
    expect(checksum).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("returns undefined for an unknown filename", () => {
    const checksum = extractChecksumFromShasums(
      shasums,
      "node-v99.0.0-darwin-arm64.tar.gz",
    );
    expect(checksum).toBeUndefined();
  });

  it("returns undefined for empty content", () => {
    const checksum = extractChecksumFromShasums("", "node-v22.13.0.pkg");
    expect(checksum).toBeUndefined();
  });
});
