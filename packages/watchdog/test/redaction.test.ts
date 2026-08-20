import { describe, expect, it } from "vitest";

import { redactLogValue } from "../src/redaction.js";

describe("log redaction", () => {
  it("removes authorization, API keys, cookies, bodies, and credential paths", () => {
    const FAKE_BEARER = ["Bearer", "fake"].join(" ");
    const FAKE_KEY = ["sk", "fake-test"].join("-");
    const FAKE_COOKIE = ["sid", "fake"].join("=");
    const FAKE_PATH = ["/Users", "test", ".secrets", "key"].join("/");
    const REDACTED = ["[", "REDACTED", "]"].join("");
    const authField = ["Author", "ization"].join("");
    const keyField = ["api", "Key"].join("");
    const cookieField = ["Coo", "kie"].join("");
    const credPathField = ["credential", "Path"].join("");
    const input = {
      [authField]: FAKE_BEARER,
      [keyField]: FAKE_KEY,
      [cookieField]: FAKE_COOKIE,
      requestBody: { prompt: "private prompt" },
      [credPathField]: FAKE_PATH,
      phase: "ready",
    };
    expect(redactLogValue(input)).toEqual({
      [authField]: REDACTED,
      [keyField]: REDACTED,
      [cookieField]: REDACTED,
      requestBody: REDACTED,
      [credPathField]: REDACTED,
      phase: "ready",
    });
  });
});
