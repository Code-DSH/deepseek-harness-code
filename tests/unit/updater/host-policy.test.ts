import { describe, expect, it } from "vitest";

import {
  classifyHost,
  isPrivateOrLoopbackHost,
  validateUpdateUrl,
} from "../../../apps/desktop/src/updater/host-policy.js";

describe("updater/host-policy isPrivateOrLoopbackHost", () => {
  it.each([
    ["localhost"],
    ["127.0.0.1"],
    ["10.0.0.1"],
    ["192.168.1.1"],
    ["169.254.1.1"],
    ["172.16.0.1"],
    ["::1"],
  ])("rejects %s", (host) => {
    expect(isPrivateOrLoopbackHost(host)).toBe(true);
  });

  it.each([["github.com"], ["objects.githubusercontent.com"], ["8.8.8.8"]])(
    "allows %s",
    (host) => {
      expect(isPrivateOrLoopbackHost(host)).toBe(false);
    },
  );
});

describe("updater/host-policy classifyHost", () => {
  it("allows github hosts", () => {
    expect(classifyHost("github.com").ok).toBe(true);
    expect(classifyHost("objects.githubusercontent.com").ok).toBe(true);
  });

  it("rejects non-allow-listed public hosts", () => {
    expect(classifyHost("evil.example").ok).toBe(false);
  });

  it("rejects loopback hosts", () => {
    expect(classifyHost("localhost").ok).toBe(false);
    expect(classifyHost("127.0.0.1").ok).toBe(false);
  });
});

describe("updater/host-policy validateUpdateUrl", () => {
  it("accepts an https github url", () => {
    const v = validateUpdateUrl(
      "https://github.com/Code-DSH/deepseek-harness-code",
    );
    expect(v.host).toBe("github.com");
  });

  it("rejects http", () => {
    expect(() => validateUpdateUrl("http://github.com/x")).toThrow();
  });

  it("rejects a private host", () => {
    expect(() => validateUpdateUrl("https://10.0.0.1/x")).toThrow();
  });

  it("rejects a non-allow-listed host", () => {
    expect(() => validateUpdateUrl("https://evil.example/x")).toThrow();
  });
});
