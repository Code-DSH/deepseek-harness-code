import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const repositoryRoot = process.cwd();
const pluginSource = readFileSync(
  join(repositoryRoot, "packages", "dsh-updater-check", "lib", "client.js"),
  "utf8",
);
const pluginManifest = JSON.parse(
  readFileSync(
    join(repositoryRoot, "packages", "dsh-updater-check", "package.json"),
    "utf8",
  ),
) as {
  dsh?: { bundle?: { patch?: string }; client?: { platform?: string } };
};
const preloadSource = readFileSync(
  join(repositoryRoot, "apps", "desktop", "src", "preload.ts"),
  "utf8",
);

describe("dsh-updater-check plugin surface", () => {
  it("keeps the official Web plugin boundary", () => {
    expect(pluginManifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(pluginManifest.dsh?.client?.platform).toBe("web");
    expect(pluginSource).not.toContain("@deepseek-ai/dsh/lib");
  });

  it("owns the complete desktop and LAN update status UI", () => {
    expect(pluginSource).toContain("getStatus");
    expect(pluginSource).toContain("subscribe");
    expect(pluginSource).toContain("EventSource");
    expect(pluginSource).toContain("/__dsh/update/events");
    expect(pluginSource).toContain("downloadedBytes");
    expect(pluginSource).toContain("totalBytes");
    expect(pluginSource).toContain("ready-to-restart");
    expect(pluginSource).toContain("请在主机桌面确认更新");
  });

  it("does not leave an updater overlay in the preload host seam", () => {
    expect(preloadSource).not.toContain("installUpdaterOverlay");
    expect(preloadSource).not.toContain('"updater:changed"');
  });

  it("renders live byte progress from the desktop updater bridge", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "http://127.0.0.1:43210/",
    });
    const status = {
      phase: "downloading",
      downloadedBytes: 1,
      totalBytes: 4,
    };
    const windowValue = {
      deepseekDesktop: {
        updater: {
          getStatus: async () => status,
          check: async () => ({ available: false }),
          apply: async () => ({ available: false }),
          restart: async () => undefined,
          subscribe(listener: (value: typeof status) => void) {
            listener(status);
            return () => undefined;
          },
        },
      },
    };
    let registration:
      | { factory: (require: (id: string) => unknown) => unknown }
      | undefined;
    Object.assign(windowValue, {
      __ModuleLoader__: {
        load(value: typeof registration) {
          registration = value;
        },
      },
    });
    const context = vm.createContext({
      window: windowValue,
      document: dom.window.document,
      setTimeout,
      clearTimeout,
    });
    new vm.Script(pluginSource).runInContext(context);
    const react = {
      createElement: () => undefined,
      useState: <T>(value: T) => [value, () => undefined] as const,
    };
    const module = registration!.factory((id) => {
      if (id === "react") return react;
      throw new Error(`unexpected client dependency: ${id}`);
    }) as { apply(ctx: unknown): void };
    let row: unknown;
    module.apply({
      get(name: string) {
        if (name === "slots") {
          return {
            inject(_slot: string, register: () => unknown) {
              return register();
            },
            register(_definition: unknown, component: unknown) {
              row = component;
              return undefined;
            },
          };
        }
        return undefined;
      },
      effect(effect: () => () => void) {
        effect();
      },
    });
    await Promise.resolve();

    const panel = dom.window.document.getElementById("dsh-updater-check-panel");
    expect(panel?.textContent).toContain("25%");
    expect(panel?.textContent).toContain("1 B / 4 B");
    expect(row).toBeTypeOf("function");
  });

  it("keeps long release notes scrollable while actions stay visible", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "http://127.0.0.1:43210/",
    });
    const status = {
      phase: "available",
      version: "0.1.0-BETA5",
      notes: "Release note ".repeat(2_000),
    };
    const windowValue = {
      deepseekDesktop: {
        updater: {
          getStatus: async () => status,
          check: async () => ({ available: true, version: status.version }),
          apply: async () => ({ available: true, version: status.version }),
          restart: async () => undefined,
          subscribe(listener: (value: typeof status) => void) {
            listener(status);
            return () => undefined;
          },
        },
      },
    };
    let registration:
      | { factory: (require: (id: string) => unknown) => unknown }
      | undefined;
    Object.assign(windowValue, {
      __ModuleLoader__: {
        load(value: typeof registration) {
          registration = value;
        },
      },
    });
    const context = vm.createContext({
      window: windowValue,
      document: dom.window.document,
      setTimeout,
      clearTimeout,
    });
    new vm.Script(pluginSource).runInContext(context);
    const react = {
      createElement: () => undefined,
      useState: <T>(value: T) => [value, () => undefined] as const,
    };
    const module = registration!.factory((id) => {
      if (id === "react") return react;
      throw new Error(`unexpected client dependency: ${id}`);
    }) as { apply(ctx: unknown): void };
    module.apply({
      get(name: string) {
        if (name === "slots") {
          return {
            inject(_slot: string, register: () => unknown) {
              return register();
            },
            register() {
              return undefined;
            },
          };
        }
        return undefined;
      },
      effect(effect: () => () => void) {
        effect();
      },
    });
    await Promise.resolve();

    const panel = dom.window.document.getElementById("dsh-updater-check-panel");
    const scrollRegion = panel?.querySelector(
      '[data-dsh-update-scroll-region="true"]',
    ) as HTMLElement | null;
    const actions = panel?.querySelector(
      '[data-dsh-update-actions="true"]',
    ) as HTMLElement | null;
    const statusRegion = panel?.querySelector(
      '[data-dsh-update-status="true"]',
    ) as HTMLElement | null;

    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.style.width).toContain("520px");
    expect(panel?.style.maxHeight).toContain("100vh");
    expect(scrollRegion?.style.overflowY).toBe("auto");
    expect(scrollRegion?.style.minHeight).not.toBe("");
    expect(scrollRegion?.textContent).toContain("Release note");
    expect(statusRegion?.style.flexShrink).toBe("0");
    expect(actions?.style.flexShrink).toBe("0");
    expect(actions?.textContent).toContain("下载更新");
  });
});
