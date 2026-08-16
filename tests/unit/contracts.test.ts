import { describe, expect, it } from "vitest";

import {
  closeBehaviorSchema,
  DEFAULT_DESKTOP_PREFERENCES,
  desktopPreferencesSchema,
  parsePersistedDesktopPreferences,
  runtimeStateSchema,
  setCloseBehaviorSchema,
} from "../../apps/desktop/src/shared/contracts.js";

describe("desktop bridge contracts", () => {
  it("keeps only the close behavior in desktop preferences", () => {
    expect(DEFAULT_DESKTOP_PREFERENCES).toEqual({
      closeBehavior: "ask",
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
      }),
    ).toEqual({ closeBehavior: "minimize" });
    expect(() =>
      desktopPreferencesSchema.parse({
        closeBehavior: "minimize",
        anchoredStandard: true,
      }),
    ).toThrow();
  });

  it("reads a legacy anchored preference without exposing it", () => {
    expect(
      parsePersistedDesktopPreferences({
        closeBehavior: "quit",
        anchoredStandard: true,
      }),
    ).toEqual({ closeBehavior: "quit" });
    expect(
      parsePersistedDesktopPreferences({ anchoredStandard: true }),
    ).toEqual(DEFAULT_DESKTOP_PREFERENCES);
  });

  it("rejects runtime states with unknown properties", () => {
    expect(
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        harnessPid: 42,
      }),
    ).toEqual({ phase: "ready", restartCount: 0, harnessPid: 42 });
    expect(
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        notice: "anchored-preset-conflict",
      }),
    ).toEqual({
      phase: "ready",
      restartCount: 0,
      notice: "anchored-preset-conflict",
    });
    expect(() =>
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        notice: "arbitrary-user-text",
      }),
    ).toThrow();
    expect(() =>
      runtimeStateSchema.parse({
        phase: "ready",
        restartCount: 0,
        command: "rm -rf",
      }),
    ).toThrow();
  });
});
