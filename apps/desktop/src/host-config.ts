import { join } from "node:path";

import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

export interface HarnessDataPaths {
  dshHome: string;
  legacyHome: string;
}

export function resolveHarnessDataPaths(
  appUserData: string,
  env: Record<string, string | undefined> = process.env,
): HarnessDataPaths {
  return {
    dshHome: resolveDshHome(undefined, env),
    legacyHome: join(appUserData, "dsh-home"),
  };
}

export interface SecureWebPreferences {
  contextIsolation: true;
  sandbox: true;
  nodeIntegration: false;
  preload: string;
}

export function createSecureWebPreferences(
  preload: string,
): SecureWebPreferences {
  return {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    preload,
  };
}

export function createStartupPagePath(appPath: string): string {
  return join(appPath, "apps", "desktop", "src", "startup.html");
}

export function createDependencyInstallPagePath(appPath: string): string {
  return join(appPath, "apps", "desktop", "src", "dependency-install.html");
}

export function createTrayIconPath(
  appPath: string,
  resourcesPath: string,
  isPackaged: boolean,
  platform: NodeJS.Platform,
): string {
  const fileName =
    platform === "darwin"
      ? "deepseek-harness-code-tray.png"
      : "deepseek-harness-code.png";
  return isPackaged
    ? join(resourcesPath, fileName)
    : join(appPath, "build", fileName);
}

export interface HarnessLaunchInput {
  nodeExecutable: string;
  dshEntry: string;
  dshHome: string;
  port: number;
}

export interface HarnessLaunchSpec {
  command: string;
  args: string[];
  env: Record<"DSH_HOME", string>;
}

export function createHarnessLaunchSpec(
  input: HarnessLaunchInput,
): HarnessLaunchSpec {
  return {
    command: input.nodeExecutable,
    args: [
      "--expose-internals",
      input.dshEntry,
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      String(input.port),
    ],
    env: {
      DSH_HOME: input.dshHome,
    },
  };
}
export interface WindowChromeOptions {
  title: string;
  titleBarStyle: "default" | "hiddenInset";
  trafficLightPosition?: { x: number; y: number };
}

export function createWindowChromeOptions(
  platform: NodeJS.Platform,
): WindowChromeOptions {
  if (platform === "darwin") {
    return {
      title: "",
      titleBarStyle: "hiddenInset",
      // Keep the red traffic light equally inset from the window's left and top
      // edges without adding a Web title bar or moving Harness content.
      trafficLightPosition: { x: 16, y: 16 },
    };
  }
  return {
    title: "DeepSeek Harness Code",
    titleBarStyle: "default",
  };
}
