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
    const setLanAccess = vi.fn(async () => ({
      enabled: true,
      port: 43210,
      addresses: ["192.168.1.12"],
    }));
    const copyLanAccessUrl = vi.fn(async () => undefined);
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
          lanAccessEnabled: false,
        }),
        setPreferences,
        getLanAccess: () => ({
          enabled: false,
          addresses: [],
        }),
        setLanAccess,
        copyLanAccessUrl,
        paste,
        listBundledPlugins: () => [],
        checkForUpdates: vi.fn(async () => ({ available: false })),
      },
    );

    expect([...handlers.keys()].sort()).toEqual([
      "bundled-plugins:list",
      "lan-access:copy-url",
      "lan-access:get",
      "lan-access:set",
      "logs:open",
      "preferences:get",
      "preferences:set",
      "runtime:get",
      "runtime:restart",
      "updater:check",
    ]);
    expect(
      [...handlers.keys()].filter((channel) =>
        channel.startsWith("lan-access:"),
      ),
    ).toHaveLength(3);
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
    await expect(
      handlers.get("lan-access:set")!(undefined, {
        enabled: true,
        accessUrl: "http://192.168.1.12:43210/?lanToken=secret",
      }),
    ).rejects.toThrow();
    await expect(
      handlers.get("lan-access:set")!(undefined, { enabled: true }),
    ).resolves.toEqual({
      enabled: true,
      port: 43210,
      addresses: ["192.168.1.12"],
    });
    expect(setLanAccess).toHaveBeenCalledWith({ enabled: true });
    await expect(
      handlers.get("lan-access:copy-url")!(undefined, {
        address: "192.168.1.12",
      }),
    ).resolves.toBeUndefined();
    expect(copyLanAccessUrl).toHaveBeenCalledWith({
      address: "192.168.1.12",
    });
    await expect(
      handlers.get("lan-access:copy-url")!(undefined),
    ).resolves.toBeUndefined();
    expect(copyLanAccessUrl).toHaveBeenCalledWith({});
    expect(() =>
      handlers.get("lan-access:copy-url")!(undefined, {
        address: "attacker.example",
      }),
    ).toThrow();
    expect(() =>
      handlers.get("lan-access:copy-url")!(undefined, {
        address: "192.168.1.12",
        accessUrl: "http://attacker.example/?lanToken=secret",
      }),
    ).toThrow();
    expect(copyLanAccessUrl).toHaveBeenCalledTimes(2);
    const sender = { paste: vi.fn() };
    listeners.get("clipboard:paste")!({ sender });
    expect(paste).toHaveBeenCalledWith(sender);
  });

  it("rejects secret-bearing LAN states before they reach renderer", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    registerDesktopIpc(
      {
        handle: (channel, listener) => handlers.set(channel, listener),
        on: vi.fn(),
      },
      {
        getRuntimeState: () => ({ phase: "ready", restartCount: 0 }),
        restartHarness: vi.fn(async () => undefined),
        openLogs: vi.fn(async () => undefined),
        getPreferences: () => ({
          closeBehavior: "ask",
          lanAccessEnabled: false,
        }),
        setPreferences: vi.fn(async () => undefined),
        getLanAccess: () =>
          ({
            enabled: true,
            port: 43210,
            addresses: ["192.168.1.12"],
            lanToken: "secret",
          }) as never,
        setLanAccess: vi.fn(async () => ({
          enabled: false,
          addresses: [],
        })),
        copyLanAccessUrl: vi.fn(async () => undefined),
        paste: vi.fn(),
        listBundledPlugins: () => [],
        checkForUpdates: vi.fn(async () => ({ available: false })),
      },
    );

    expect(() => handlers.get("lan-access:get")!(undefined)).toThrow();
  });
});
