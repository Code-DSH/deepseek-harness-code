import { describe, expect, it } from "vitest";

import {
  closeBehaviorSchema,
  DEFAULT_DESKTOP_PREFERENCES,
  desktopPreferencesSchema,
  lanAccessSetSchema,
  lanAccessStateSchema,
  mergeDesktopPreferences,
  parsePersistedDesktopPreferences,
  runtimeStateSchema,
  setCloseBehaviorSchema,
} from "../../apps/desktop/src/shared/contracts.js";

describe("desktop bridge contracts", () => {
  it("defaults LAN access to disabled", () => {
    expect(DEFAULT_DESKTOP_PREFERENCES).toEqual({
      closeBehavior: "ask",
      lanAccessEnabled: false,
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

  it("accepts only a boolean LAN access command", () => {
    expect(lanAccessSetSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
    expect(() =>
      lanAccessSetSchema.parse({ enabled: true, port: 8080 }),
    ).toThrow();
  });

  it("accepts only redacted LAN state without tokens or access URLs", () => {
    expect(
      lanAccessStateSchema.parse({
        enabled: true,
        port: 43210,
        addresses: ["192.168.1.12", "10.0.0.4"],
      }),
    ).toEqual({
      enabled: true,
      port: 43210,
      addresses: ["192.168.1.12", "10.0.0.4"],
    });
    expect(() =>
      lanAccessStateSchema.parse({
        enabled: true,
        port: 43210,
        addresses: ["192.168.1.12"],
        lanToken: "secret",
      }),
    ).toThrow();
    expect(() =>
      lanAccessStateSchema.parse({
        enabled: true,
        port: 43210,
        addresses: ["192.168.1.12"],
        accessUrl: "http://192.168.1.12:43210/?lanToken=secret",
      }),
    ).toThrow();
    expect(() =>
      lanAccessStateSchema.parse({
        enabled: true,
        port: 43210,
        addresses: ["not-an-ip"],
      }),
    ).toThrow();
  });

  it("reads a legacy anchored preference without exposing it", () => {
    expect(
      parsePersistedDesktopPreferences({
        closeBehavior: "quit",
        anchoredStandard: true,
      }),
    ).toEqual({ closeBehavior: "quit", lanAccessEnabled: false });
    expect(
      parsePersistedDesktopPreferences({ anchoredStandard: true }),
    ).toEqual(DEFAULT_DESKTOP_PREFERENCES);
  });

  it("preserves a valid persisted LAN preference", () => {
    expect(
      parsePersistedDesktopPreferences({
        closeBehavior: "minimize",
        lanAccessEnabled: true,
      }),
    ).toEqual({ closeBehavior: "minimize", lanAccessEnabled: true });
    expect(
      parsePersistedDesktopPreferences({
        closeBehavior: "minimize",
        lanAccessEnabled: "yes",
      }),
    ).toEqual({ closeBehavior: "minimize", lanAccessEnabled: false });
  });

  it("preserves LAN enablement when applying a close preference patch", () => {
    expect(
      mergeDesktopPreferences(
        { closeBehavior: "ask", lanAccessEnabled: true },
        { closeBehavior: "quit" },
      ),
    ).toEqual({ closeBehavior: "quit", lanAccessEnabled: true });
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
