import { describe, expect, it, vi } from "vitest";

import {
  createDesktopBridge,
  installPasteShortcut,
} from "../../apps/desktop/src/preload-api.js";

describe("preload bridge", () => {
  it("exposes only approved capability APIs and uses fixed IPC channels", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === "runtime:get") return { phase: "ready", restartCount: 0 };
      if (channel === "lan-access:get" || channel === "lan-access:set") {
        return {
          enabled: true,
          port: 43210,
          addresses: ["192.168.1.12"],
        };
      }
      if (channel === "lan-access:copy-url") {
        return "http://192.168.1.12:43210/?lanToken=must-not-escape";
      }
      return undefined;
    });
    const removeListener = vi.fn();
    const on = vi.fn(() => undefined);
    const bridge = createDesktopBridge({ invoke, on, removeListener });

    expect(Object.keys(bridge).sort()).toEqual([
      "bundledPlugins",
      "lanAccess",
      "preferences",
      "runtime",
      "updater",
    ]);
    expect(Object.keys(bridge.preferences).sort()).toEqual(["get", "set"]);
    expect(Object.keys(bridge.runtime).sort()).toEqual([
      "getState",
      "openLogs",
      "restartHarness",
      "subscribe",
    ]);
    expect(Object.keys(bridge.lanAccess).sort()).toEqual([
      "copyUrl",
      "get",
      "set",
    ]);
    await bridge.runtime.getState();
    await expect(bridge.lanAccess.get()).resolves.toEqual({
      enabled: true,
      port: 43210,
      addresses: ["192.168.1.12"],
    });
    await bridge.lanAccess.set({ enabled: false });
    await expect(bridge.lanAccess.copyUrl()).resolves.toBeUndefined();
    await bridge.preferences.set({
      closeBehavior: "minimize",
    });
    expect(invoke).toHaveBeenCalledWith("runtime:get");
    expect(invoke).toHaveBeenCalledWith("lan-access:get");
    expect(invoke).toHaveBeenCalledWith("lan-access:set", {
      enabled: false,
    });
    expect(invoke).toHaveBeenCalledWith("lan-access:copy-url");
    expect(invoke).toHaveBeenCalledWith("preferences:set", {
      closeBehavior: "minimize",
    });
  });

  it("rejects secret-bearing LAN state returned by main", async () => {
    const bridge = createDesktopBridge({
      invoke: vi.fn(async () => ({
        enabled: true,
        port: 43210,
        addresses: ["192.168.1.12"],
        lanToken: "secret",
      })),
      on: vi.fn(),
      removeListener: vi.fn(),
    });

    await expect(bridge.lanAccess.get()).rejects.toThrow();
  });

  it("forwards only macOS Control+V through a fixed internal paste channel", () => {
    let keydown: ((event: any) => void) | undefined;
    const target = {
      addEventListener: vi.fn((_type: string, listener: any) => {
        keydown = listener;
      }),
      removeEventListener: vi.fn(),
    };
    const sendPaste = vi.fn();
    const dispose = installPasteShortcut("darwin", target, sendPaste);
    const preventDefault = vi.fn();

    keydown?.({
      type: "keydown",
      key: "v",
      ctrlKey: true,
      metaKey: false,
      isTrusted: true,
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(sendPaste).toHaveBeenCalledOnce();

    keydown?.({
      type: "keydown",
      key: "v",
      ctrlKey: false,
      metaKey: true,
      isTrusted: true,
      preventDefault,
    });
    expect(sendPaste).toHaveBeenCalledOnce();

    keydown?.({
      type: "keydown",
      key: "v",
      ctrlKey: true,
      metaKey: false,
      isTrusted: false,
      preventDefault,
    });
    expect(sendPaste).toHaveBeenCalledOnce();
    dispose();
    expect(target.removeEventListener).toHaveBeenCalledOnce();
  });
});
