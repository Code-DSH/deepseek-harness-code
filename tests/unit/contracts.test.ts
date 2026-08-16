import { describe, expect, it } from "vitest";

import {
  closeBehaviorSchema,
  DEFAULT_DESKTOP_PREFERENCES,
  desktopPreferencesSchema,
  runtimeStateSchema,
  setCloseBehaviorSchema,
} from "../../apps/desktop/src/shared/contracts.js";

describe("desktop bridge contracts", () => {
  it("keeps experimental anchored mode disabled for a new installation", () => {
    expect(DEFAULT_DESKTOP_PREFERENCES).toEqual({
      closeBehavior: "ask",
      anchoredStandard: false,
    });
  });

  it("accepts only supported close behavior values", () => {
    expect(closeBehaviorSchema.parse("ask")).toBe("ask");
    expect(() => closeBehaviorSchema.parse("close")).toThrow();
    expect(setCloseBehaviorSchema.parse("minimize")).toBe("minimize");
    expect(() => setCloseBehaviorSchema.parse("ask")).toThrow();
  });

  it("validates the complete persisted desktop preference contract", () => {
    expect(
      desktopPreferencesSchema.parse({
        closeBehavior: "minimize",
        anchoredStandard: true,
      }),
    ).toEqual({ closeBehavior: "minimize", anchoredStandard: true });
    expect(() =>
      desktopPreferencesSchema.parse({
        closeBehavior: "ask",
        anchoredStandard: true,
      }),
    ).toThrow();
  });

  it("rejects runtime states with unknown properties", () => {
    expect(
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        harnessPid: 42,
      }),
    ).toEqual({ phase: "ready", restartCount: 0, harnessPid: 42 });
    expect(() =>
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        command: "rm -rf",
      }),
    ).toThrow();
  });
});
