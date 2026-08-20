import { describe, expect, it } from "vitest";

import { RecoveryPolicy } from "../src/recovery-policy.js";

describe("watchdog recovery policy", () => {
  it("restarts after 5 and 10 seconds, then opens the circuit immediately on the third crash", () => {
    const policy = new RecoveryPolicy({ windowMs: 300_000, limit: 3 });
    const start = 1_000_000;
    expect(policy.recordCrash(start)).toEqual({
      action: "restart",
      delayMs: 5_000,
    });
    expect(policy.recordCrash(start + 10)).toEqual({
      action: "restart",
      delayMs: 10_000,
    });
    expect(policy.recordCrash(start + 20)).toEqual({ action: "open-circuit" });
  });

  it("forgets crashes outside the five minute window", () => {
    const policy = new RecoveryPolicy({ windowMs: 300_000, limit: 3 });
    expect(policy.recordCrash(0).action).toBe("restart");
    expect(policy.recordCrash(300_001)).toEqual({
      action: "restart",
      delayMs: 5_000,
    });
  });
});
