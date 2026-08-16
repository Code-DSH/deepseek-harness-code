import { describe, expect, it } from "vitest";

import { decideCloseAction } from "../../apps/desktop/src/lifecycle/close-policy.js";

describe("close policy", () => {
  it("asks once and persists either explicit result", () => {
    expect(decideCloseAction("ask")).toBe("ask");
    expect(decideCloseAction("minimize")).toBe("minimize");
    expect(decideCloseAction("quit")).toBe("quit");
  });
});
