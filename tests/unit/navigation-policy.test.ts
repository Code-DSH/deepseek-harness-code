import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";

import { classifyNavigation } from "../../apps/desktop/src/security/navigation-policy.js";

describe("navigation policy", () => {
  it("allows only the active loopback Harness origin in the app window", () => {
    const origin = "http://127.0.0.1:43123";
    expect(classifyNavigation(`${origin}/workspace`, origin)).toBe(
      "allow-in-app",
    );
    expect(classifyNavigation("https://deepseek.com/", origin)).toBe(
      "open-external",
    );
    expect(classifyNavigation("file:///etc/passwd", origin)).toBe("deny");
    expect(classifyNavigation("javascript:alert(1)", origin)).toBe("deny");
    expect(classifyNavigation("http://localhost:43123/", origin)).toBe("deny");
  });

  it("rejects malformed, external, and portless Harness origins before comparing navigation targets", () => {
    expect(
      classifyNavigation(
        "http://example.com:43123/",
        "http://example.com:43123",
      ),
    ).toBe("deny");
    expect(classifyNavigation("http://127.0.0.1/", "http://127.0.0.1")).toBe(
      "deny",
    );
    expect(
      classifyNavigation("http://127.0.0.1:43123/", "https://127.0.0.1:43123"),
    ).toBe("deny");
  });

  it("supports only a ported IPv6 loopback origin and the exact fixed startup file", () => {
    const origin = "http://[::1]:43123";
    const startup = pathToFileURL("/app/startup.html").href;
    expect(classifyNavigation(`${origin}/workspace`, origin, startup)).toBe(
      "allow-in-app",
    );
    expect(classifyNavigation(startup, origin, startup)).toBe("allow-in-app");
    expect(
      classifyNavigation(
        pathToFileURL("/app/other.html").href,
        origin,
        startup,
      ),
    ).toBe("deny");
  });

  it("makes redirect decisions with the same policy as direct navigation", () => {
    const origin = "http://127.0.0.1:43123";
    expect(classifyNavigation("https://deepseek.com/redirect", origin)).toBe(
      "open-external",
    );
    expect(classifyNavigation("http://evil.example/redirect", origin)).toBe(
      "deny",
    );
  });
});
