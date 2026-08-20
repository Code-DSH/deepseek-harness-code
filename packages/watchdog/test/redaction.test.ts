import { describe, expect, it } from "vitest";

import { redactLogValue } from "../src/redaction.js";

describe("log redaction", () => {
  it("removes authorization, API keys, cookies, bodies, and credential paths", () => {
    const FAKE_BEARER = ["Bearer", "fake"].join(" ");
    const FAKE_KEY = ["sk", "fake-test"].join("-");
    const FAKE_COOKIE = ["sid", "fake"].join("=");
    const FAKE_PATH = ["/Users", "test", ".secrets", "key"].join("/");
    const input = {
      Authorization: FAKE_BEARER,
      apiKey: FAKE_KEY,
      Cookie: FAKE_COOKIE,
      requestBody: { prompt: "private prompt" },
      credentialPath: FAKE_PATH,
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
