import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createHarnessLaunchSpec,
  resolveHarnessDataPaths,
  createStartupPagePath,
  createSecureWebPreferences,
  createTrayIconPath,
  createWindowChromeOptions,
} from "../../apps/desktop/src/host-config.js";

describe("Electron host configuration", () => {
  it("uses the official Harness Home and keeps the previous app Home only as a migration source", () => {
    expect(
      resolveHarnessDataPaths(
        "/Users/test/Library/Application Support/deepseek-harness-desktop",
        {
          DSH_HOME: "/Users/test/.official-dsh",
        },
      ),
    ).toEqual({
      dshHome: "/Users/test/.official-dsh",
      legacyHome: join(
        "/Users/test/Library/Application Support/deepseek-harness-desktop",
        "dsh-home",
      ),
    });
  });

  it("creates a sandboxed, isolated renderer with no Node integration", () => {
    expect(createSecureWebPreferences("/app/preload.cjs")).toEqual({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: "/app/preload.cjs",
    });
  });

  it("launches the official dsh web entry through Electron Node mode on loopback", () => {
    expect(
      createHarnessLaunchSpec({
        electronExecutable:
          "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
        dshEntry: "/app/node_modules/@deepseek-ai/dsh/lib/bin.js",
        dshHome:
          "/Users/test/Library/Application Support/DeepSeek Harness/harness",
        port: 41234,
      }),
    ).toEqual({
      command:
        "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness",
      args: [
        "--expose-internals",
        "/app/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "web",
        "--host",
        "127.0.0.1",
        "--port",
        "41234",
      ],
      env: {
        DSH_HOME:
          "/Users/test/Library/Application Support/DeepSeek Harness/harness",
        ELECTRON_RUN_AS_NODE: "1",
      },
    });
  });

  it("uses the packaged fixed startup page next to the desktop source", () => {
    expect(createStartupPagePath("/app")).toBe(
      join("/app", "apps", "desktop", "src", "startup.html"),
    );
  });

  it("uses the packaged branded tray resource and the generated development asset", () => {
    expect(createTrayIconPath("/app", "/resources", true, "darwin")).toBe(
      join("/resources", "deepseek-harness-code-tray.png"),
    );
    expect(createTrayIconPath("/app", "/resources", false, "darwin")).toBe(
      join("/app", "build", "deepseek-harness-code-tray.png"),
    );
    expect(createTrayIconPath("/app", "/resources", true, "win32")).toBe(
      join("/resources", "deepseek-harness-code.png"),
    );
    expect(createTrayIconPath("/app", "/resources", false, "linux")).toBe(
      join("/app", "build", "deepseek-harness-code.png"),
    );
  });

  it("equally insets native macOS traffic lights without adding a Web title bar", () => {
    const macChrome = createWindowChromeOptions("darwin");
    expect(macChrome).toMatchObject({
      title: "",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    });
    expect(macChrome.trafficLightPosition?.x).toBe(
      macChrome.trafficLightPosition?.y,
    );
    expect(createWindowChromeOptions("win32")).toMatchObject({
      title: "DeepSeek Harness Code",
      titleBarStyle: "default",
    });
    expect(createWindowChromeOptions("linux")).toMatchObject({
      title: "DeepSeek Harness Code",
      titleBarStyle: "default",
    });
  });
});
