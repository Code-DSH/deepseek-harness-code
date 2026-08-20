import { describe, expect, it, vi } from "vitest";

import {
  createDesktopBridge,
  installPasteShortcut,
} from "../../apps/desktop/src/preload-api.js";

describe("preload bridge", () => {
  it("exposes only the two approved capability APIs and uses fixed IPC channels", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === "runtime:get") return { phase: "ready", restartCount: 0 };
      if (channel === "close:get") return "ask";
      return undefined;
    });
    const removeListener = vi.fn();
    const on = vi.fn(() => undefined);
    const bridge = createDesktopBridge({ invoke, on, removeListener });

    expect(Object.keys(bridge).sort()).toEqual([
      "bundledPlugins",
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
    await bridge.runtime.getState();
    await bridge.preferences.set({
      closeBehavior: "minimize",
    });
    expect(invoke).toHaveBeenCalledWith("runtime:get");
    expect(invoke).toHaveBeenCalledWith("preferences:set", {
      closeBehavior: "minimize",
    });
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
