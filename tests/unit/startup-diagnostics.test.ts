import { describe, expect, it } from "vitest";

import {
  startupFailureFromDiagnostics,
  redactStartupDiagnostic,
} from "../../apps/desktop/src/lifecycle/startup-diagnostics.js";

describe("Harness startup diagnostics", () => {
  it("keeps bounded launch evidence while redacting credentials", () => {
    const result = redactStartupDiagnostic(
      "error Authorization: Bearer secret-value api_key=another-secret still-visible",
    );

    expect(result).toContain("error");
    expect(result).toContain("Authorization: [REDACTED]");
    expect(result).toContain("api_key=[REDACTED]");
    expect(result).not.toContain("secret-value");
    expect(result).not.toContain("another-secret");
  });

  it("redacts cookie, password, and generic secret assignments from startup output", () => {
    const result = redactStartupDiagnostic(
      "cookie=session-value password=hunter2 secret=hidden",
    );

    expect(result).toBe(
      "cookie=[REDACTED] password=[REDACTED] secret=[REDACTED]",
    );
  });

  it("redacts JSON fields, CLI arguments, request bodies, and credential paths", () => {
    const result = redactStartupDiagnostic(
      '{"apiKey":"one","Authorization":"two","Cookie":"three","body":"four"} --api-key five /credentials/six',
    );

    expect(result).not.toContain("one");
    expect(result).not.toContain("two");
    expect(result).not.toContain("three");
    expect(result).not.toContain("four");
    expect(result).not.toContain("five");
    expect(result).not.toContain("six");
  });

  it.each(["https", "git+https"])(
    "redacts the complete %s Basic Auth URL from startup output",
    (protocol) => {
      const result = redactStartupDiagnostic(
        `pnpm fetch ${protocol}://user:synthetic-credential@host.example/plugin.git`,
      );

      expect(result).toContain("pnpm fetch [REDACTED]");
      expect(result).not.toContain("user");
      expect(result).not.toContain("synthetic-credential");
      expect(result).not.toContain("host.example");
    },
  );

  it("redacts URL userinfo before applying the 2,000-character diagnostic bound", () => {
    const result = redactStartupDiagnostic(
      `${"x".repeat(1_970)} git+https://user:synthetic-credential@host.example/plugin.git`,
    );

    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("user");
    expect(result).not.toContain("synthetic");
    expect(result.length).toBeLessThanOrEqual(2_000);
  });

  it("marks a bind race retryable only when captured diagnostics explicitly say EADDRINUSE", () => {
    expect(
      startupFailureFromDiagnostics(
        "listen EADDRINUSE: address already in use",
      ),
    ).toMatchObject({
      code: "EADDRINUSE",
    });
    expect(
      startupFailureFromDiagnostics("Harness exited during startup"),
    ).not.toMatchObject({
      code: "EADDRINUSE",
    });
  });
});
