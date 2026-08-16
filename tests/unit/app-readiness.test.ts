import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => {
  const app = Object.assign(new EventEmitter(), {
    dock: { show: vi.fn() },
    getAppPath: vi.fn(() => process.cwd()),
    getPath: vi.fn((name: string) =>
      name === "appData" ? "/tmp/deepseek-app-data" : "/tmp/deepseek-user-data",
    ),
    isPackaged: false,
    quit: vi.fn(),
    setPath: vi.fn(),
    whenReady: vi.fn(() => new Promise<void>(() => undefined)),
  });
  const BrowserWindow = Object.assign(
    vi.fn(() => {
      throw new Error("Cannot create BrowserWindow before app is ready");
    }),
    {
      getAllWindows: vi.fn(() => []),
      getFocusedWindow: vi.fn(() => undefined),
    },
  );
  return {
    app,
    BrowserWindow,
    dialog: { showErrorBox: vi.fn(), showMessageBox: vi.fn() },
    ipcMain: {},
    Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
    nativeImage: { createFromPath: vi.fn() },
    shell: {
      openExternal: vi.fn(),
      openPath: vi.fn(),
    },
    Tray: vi.fn(),
  };
});

describe("Electron readiness boundary", () => {
  it("cannot create a BrowserWindow when macOS activates before app readiness", async () => {
    const { app, BrowserWindow } = await import("electron");
    await import("../../apps/desktop/src/main.js");

    expect(() => app.emit("activate")).not.toThrow();
    expect(BrowserWindow).not.toHaveBeenCalled();
  });
});
