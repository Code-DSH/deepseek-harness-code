import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createDependencyInstallPagePath,
  createDependencyInstallWindowOptions,
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
      dshHome: resolve("/Users/test/.official-dsh"),
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
    expect(createSecureWebPreferences()).toEqual({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    });
  });

  it("launches the official dsh web entry through the system Node runtime on loopback", () => {
    expect(
      createHarnessLaunchSpec({
        nodeExecutable: "/opt/homebrew/bin/node",
        dshEntry:
          "/Users/test/Library/Application Support/deepseek-harness-desktop/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        dshHome:
          "/Users/test/Library/Application Support/DeepSeek Harness/harness",
        port: 41234,
      }),
    ).toEqual({
      command: "/opt/homebrew/bin/node",
      args: [
        "--expose-internals",
        "/Users/test/Library/Application Support/deepseek-harness-desktop/node-runtime/packages/node_modules/@deepseek-ai/dsh/lib/bin.js",
        "web",
        "--host",
        "127.0.0.1",
        "--port",
        "41234",
      ],
      env: {
        DSH_HOME:
          "/Users/test/Library/Application Support/DeepSeek Harness/harness",
      },
    });
  });

  it("uses the packaged fixed startup page next to the desktop source", () => {
    expect(createStartupPagePath("/app")).toBe(
      join("/app", "apps", "desktop", "src", "startup.html"),
    );
  });

  it("uses a fixed modal page for first-launch dependency installation", () => {
    expect(createDependencyInstallPagePath("/app")).toBe(
      join("/app", "apps", "desktop", "src", "dependency-install.html"),
    );
    expect(createDependencyInstallWindowOptions()).toEqual({
      title: "DeepSeek Harness Code",
      width: 420,
      height: 180,
      show: false,
      modal: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      closable: false,
      autoHideMenuBar: true,
    });
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
