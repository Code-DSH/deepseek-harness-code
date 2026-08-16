import { describe, expect, it } from "vitest";

import { redactLogValue } from "../src/redaction.js";

describe("log redaction", () => {
  it("removes authorization, API keys, cookies, bodies, and credential paths", () => {
    const input = {
      Authorization: "Bearer secret",
      apiKey: "sk-secret",
      Cookie: "sid=secret",
      requestBody: { prompt: "private prompt" },
      credentialPath: "/Users/me/.secrets/key",
      phase: "ready",
    };
    expect(redactLogValue(input)).toEqual({
      Authorization: "[REDACTED]",
      apiKey: "[REDACTED]",
      Cookie: "[REDACTED]",
      requestBody: "[REDACTED]",
      credentialPath: "[REDACTED]",
      phase: "ready",
    });
  });
});
