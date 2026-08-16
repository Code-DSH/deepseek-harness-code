import { describe, expect, it, vi } from "vitest";

import { registerDesktopIpc } from "../../apps/desktop/src/ipc-handlers.js";

describe("desktop IPC handlers", () => {
  it("validates preferences and registers only fixed channels", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const listeners = new Map<string, (...args: unknown[]) => unknown>();
    const handle = vi.fn(
      (channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      },
    );
    const setPreferences = vi.fn(async () => undefined);
    const paste = vi.fn();
    registerDesktopIpc(
      {
        handle,
        on: vi.fn(
          (channel: string, listener: (...args: unknown[]) => unknown) => {
            listeners.set(channel, listener);
          },
        ),
      },
      {
        getRuntimeState: () => ({ phase: "ready", restartCount: 0 }),
        restartHarness: vi.fn(async () => undefined),
        openLogs: vi.fn(async () => undefined),
        getPreferences: () => ({
          closeBehavior: "ask",
        }),
        setPreferences,
        paste,
      },
    );

    expect([...handlers.keys()].sort()).toEqual([
      "logs:open",
      "preferences:get",
      "preferences:set",
      "runtime:get",
      "runtime:restart",
    ]);
    await expect(
      handlers.get("preferences:set")!(undefined, {
        closeBehavior: "quit",
        anchoredStandard: true,
      }),
    ).rejects.toThrow();
    await handlers.get("preferences:set")!(undefined, {
      closeBehavior: "quit",
    });
    expect(setPreferences).toHaveBeenCalledWith({
      closeBehavior: "quit",
    });
    const sender = { paste: vi.fn() };
    listeners.get("clipboard:paste")!({ sender });
    expect(paste).toHaveBeenCalledWith(sender);
  });
});
