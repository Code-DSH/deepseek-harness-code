import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const harnessRoot = join(repositoryRoot, "deps", "deepseek-harness");
const pluginRoot = join(repositoryRoot, "packages", "desktop-plugin");
const packageName = "deepseek-harness-desktop-plugin";
const nodeRequire = createRequire(join(repositoryRoot, "package.json"));
const { JSDOM } = nodeRequire("jsdom") as {
  JSDOM: new (html?: string, options?: { url?: string }) => any;
};

type RuntimeState = {
  phase: string;
  restartCount: number;
  notice?: "anchored-preset-conflict" | "anchored-preset-unavailable";
};

type Bridge = {
  getRuntimeState(): Promise<RuntimeState>;
  restartHarness(): Promise<void>;
  openLogs(): Promise<void>;
  getCloseBehavior(): Promise<"ask" | "minimize" | "quit">;
  setCloseBehavior(value: "minimize" | "quit"): Promise<void>;
  subscribeRuntime(listener: (state: RuntimeState) => void): () => void;
};

type ModernBridge = {
  app?: {
    getInfo(): Promise<{ name: string; version: string }>;
  };
  preferences: {
    get(): Promise<{
      closeBehavior: "ask" | "minimize" | "quit";
    }>;
    set(value: { closeBehavior: "minimize" | "quit" }): Promise<void>;
  };
  runtime: {
    getState(): Promise<RuntimeState>;
    restartHarness(): Promise<void>;
    openLogs(): Promise<void>;
    subscribe(listener: (state: RuntimeState) => void): () => void;
  };
};

type ClientApply = (ctx: {
  locale?: {
    register(
      namespace: string,
      dictionaries: Record<string, Record<string, string>>,
    ): () => void;
  };
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(definition: unknown, component: unknown): unknown;
  };
}) => void;

type DesktopClientApply = (ctx: Parameters<ClientApply>[0]) => () => void;

function loadClientExports(
  windowValue: Record<string, unknown> = {},
  documentValue: Document | undefined = undefined,
  reactOverrides: Record<string, unknown> = {},
) {
  const source = readFileSync(join(pluginRoot, "client.js"), "utf8");
  let registration:
    | { id: string; factory: (require: (id: string) => unknown) => unknown }
    | undefined;
  const window = windowValue;
  Object.assign(window, {
    __ModuleLoader__: {
      load(value: typeof registration) {
        registration = value;
      },
    },
  });
  const ctx = vm.createContext({
    window,
    document: documentValue,
    setTimeout,
    clearTimeout,
  });
  new vm.Script(source).runInContext(ctx);
  expect(registration).toBeDefined();
  const react = {
    createElement: (
      type: unknown,
      props: Record<string, unknown>,
      ...children: unknown[]
    ) => ({ type, props, children }),
    useEffect: () => undefined,
    useLayoutEffect: () => undefined,
    useRef: <T>(value: T) => ({ current: value }),
    useState: <T>(value: T | (() => T)) =>
      [
        typeof value === "function" ? (value as () => T)() : value,
        () => undefined,
      ] as const,
    ...reactOverrides,
  };
  const module = registration!.factory((id) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") {
      return { jsx: react.createElement, jsxs: react.createElement };
    }
    if (id === "@deepseek-ai/dsh-client-ui-primitives") {
      return {
        Button: "HarnessButton",
        Menu: "HarnessMenu",
        IconChevronDownOutline14: "HarnessChevronDown",
      };
    }
    throw new Error(`unexpected client dependency: ${id}`);
  }) as Record<string, unknown>;
  return { module, registration: registration!, window };
}

describe("desktop plugin package contract", () => {
  it("provides read-only desktop metadata through the official Cordis service seam", async () => {
    const host = await import(pathToFileURL(join(pluginRoot, "index.js")).href);
    const provided: Array<{ name: string; value: unknown }> = [];
    const disposed: string[] = [];

    const dispose = host.apply({
      provide(name: string, value: unknown) {
        provided.push({ name, value });
        return () => disposed.push(name);
      },
    });
    expect(provided[0]).toMatchObject({
      name: "desktopRuntime",
      value: {
        desktop: true,
        platform: process.platform,
        dshHomeConfigured: expect.any(Boolean),
      },
    });
    expect(provided[1]).toMatchObject({
      name: "hmr",
      value: { desktopManaged: true, registerConfig: expect.any(Function) },
    });
    dispose();
    expect(disposed).toEqual(["hmr", "desktopRuntime"]);
  });

  it("builds a deterministic official bundle manifest and client module", () => {
    const buildScript = join(pluginRoot, "scripts", "build-client.mjs");
    const build = spawnSync(process.execPath, [buildScript], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(build.status, build.stderr).toBe(0);
    expect(build.stderr).toBe("");
    const rootBuild = readFileSync(join(pluginRoot, "client.js"), "utf8");
    const packageBuild = spawnSync(process.execPath, [buildScript], {
      cwd: pluginRoot,
      encoding: "utf8",
    });
    expect(packageBuild.status, packageBuild.stderr).toBe(0);
    expect(packageBuild.stderr).toBe("");
    expect(readFileSync(join(pluginRoot, "client.js"), "utf8")).toBe(rootBuild);

    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, "package.json"), "utf8"),
    ) as {
      dsh?: {
        bundle?: { patch?: string };
        client?: { platform?: string; inject?: string[] };
      };
      exports?: Record<string, { default?: string }>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      files?: string[];
    };
    const patch = readFileSync(join(pluginRoot, "cordis.patch.yml"), "utf8");
    const client = readFileSync(join(pluginRoot, "client.js"), "utf8");
    const { module, registration } = loadClientExports();

    expect(manifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(manifest.dsh?.client).toEqual({
      platform: "web",
      inject: [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-ui-layout",
      ],
    });
    expect(manifest.exports?.["./client"]?.default).toBe("./client.js");
    expect(manifest.exports?.["./package.json"]).toBe("./package.json");
    expect(manifest.dependencies?.["thinking-orbs"]).toBe("0.3.1");
    expect(manifest.dependencies?.["react-dom"]).toBeUndefined();
    expect(manifest.devDependencies?.esbuild).toBe("0.25.12");
    expect(manifest.files).toContain("THIRD_PARTY_NOTICES.md");
    expect(patch).toMatch(new RegExp(`name: ["']${packageName}["']`));
    expect(registration.id).toBe(packageName);
    expect(client).toContain("ThinkingOrb");
    expect(client).toContain("data-dsh-desktop-thinking-inline");
    expect(Object.keys(module).sort()).toEqual([
      "DESKTOP_LOCALES",
      "DesktopSettingsRow",
      "InlineThinkingStatus",
      "THINKING_ORB_PROPS",
      "apply",
      "createDesktopSettingsModel",
      "findRunningStatus",
      "inject",
      "installThinkingStatus",
      "installTransitions",
    ]);
    expect(module.inject).toEqual(["slots", "locale"]);
    expect(manifest.dsh?.client?.inject).toContain(
      "@deepseek-ai/dsh-client-locale",
    );
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-client-locale"]).toBe(
      "0.1.1-rc.2.code.1",
    );
    expect(
      manifest.peerDependencies?.["@deepseek-ai/dsh-client-ui-primitives"],
    ).toBe("0.1.1-rc.2.code.1");
    expect(
      manifest.peerDependencies?.["@deepseek-ai/dsh-client-ui-layout"],
    ).toBe("0.1.1-rc.2.code.1");
  });

  it("does not replace the official question protocol packages", () => {
    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const askUserSource = readFileSync(
      join(
        harnessRoot,
        "packages",
        "interaction",
        "tool-ask-user",
        "lib",
        "index.js",
      ),
      "utf8",
    );
    const questionTypes = readFileSync(
      join(
        harnessRoot,
        "packages",
        "interaction",
        "user-questions",
        "lib",
        "types",
        "types.d.ts",
      ),
      "utf8",
    );
    const questionClient = readFileSync(
      join(
        harnessRoot,
        "packages",
        "client",
        "ui-user-questions",
        "lib",
        "client.js",
      ),
      "utf8",
    );

    expect(
      [
        "@deepseek-ai/dsh-client-ui-user-questions",
        "@deepseek-ai/dsh-tool-ask-user",
        "@deepseek-ai/dsh-user-questions",
      ].every(
        (name) =>
          manifest.dependencies[name] === undefined &&
          manifest.devDependencies[name]?.startsWith(
            "link:../../deps/deepseek-harness/",
          ),
      ),
    ).toBe(true);
    expect(askUserSource).toContain("multi_select");
    expect(askUserSource).toContain("custom");
    expect(questionTypes).toContain("kind: 'plan-review'");
    expect(questionClient).toContain("action.skip");
    expect(questionClient).toContain("cancelled");
    expect(questionClient).toContain("PendingQuestion = class");
  });

  it("registers desktop settings and an inline status portal lifecycle", () => {
    const { module } = loadClientExports();
    const apply = module.apply as ClientApply;
    const injects: string[] = [];
    const ctx = {
      locale: {
        register: () => () => undefined,
      },
      slots: {
        inject(name: string, register: () => unknown) {
          injects.push(name);
          return register();
        },
        register(definition: unknown, component: unknown) {
          return { definition, component };
        },
      },
    };

    apply(ctx);
    expect(injects).toEqual([]);

    const desktop = loadClientExports({ deepseekDesktop: {} });
    (desktop.module.apply as ClientApply)(ctx);
    expect(injects).toEqual(["settings.general.item", "shell.overlay"]);
  });

  it("portals the Orb into the native row without a fixed conversation visual", () => {
    const source = readFileSync(
      join(pluginRoot, "src", "client-runtime.js"),
      "utf8",
    );

    expect(source).toContain('name: "shell.overlay"');
    expect(source).toContain("data-dsh-desktop-thinking-inline");
    expect(source).toContain('state: "working"');
    expect(source).not.toContain("position: fixed");
  });

  it("uses the official locale service for balanced Chinese and English settings copy", () => {
    const desktop = loadClientExports({
      deepseekDesktop: {
        preferences: {
          async get() {
            return { closeBehavior: "ask" };
          },
          async set() {},
        },
        runtime: {
          async getState() {
            return {
              phase: "ready",
              restartCount: 0,
              notice: "anchored-preset-conflict" as const,
            };
          },
          async restartHarness() {},
          async openLogs() {},
          subscribe() {
            return () => undefined;
          },
        },
      },
    });
    const registrations: Array<{
      namespace: string;
      dictionaries: Record<string, Record<string, string>>;
    }> = [];
    let definition: Record<string, unknown> | undefined;
    let component: ((props: { t(key: string): string }) => unknown) | undefined;
    const dispose = (desktop.module.apply as DesktopClientApply)({
      locale: {
        register(namespace, dictionaries) {
          registrations.push({ namespace, dictionaries });
          return () => undefined;
        },
      },
      slots: {
        inject(_name, register) {
          register();
          return () => undefined;
        },
        register(nextDefinition, nextComponent) {
          if (
            (nextDefinition as Record<string, unknown>).name ===
            "settings.general.item"
          ) {
            definition = nextDefinition as Record<string, unknown>;
            component = nextComponent as typeof component;
          }
          return undefined;
        },
      },
    });

    expect(registrations).toHaveLength(1);
    const registration = registrations[0];
    expect(registration).toBeDefined();
    if (!registration) throw new Error("locale registration missing");
    expect(registration.namespace).toBe("settings.desktop");
    expect(Object.keys(registration.dictionaries).sort()).toEqual(["en", "zh"]);
    expect(definition?.locale).toBe("settings.desktop");
    const zh = registration.dictionaries.zh;
    expect(zh).toBeDefined();
    if (!zh) throw new Error("Chinese desktop locale missing");
    const row = component?.({ t: (key) => zh[key] ?? key });
    const rendered = JSON.stringify(row);
    expect(rendered).toContain("桌面运行状态");
    expect(rendered).toContain("关闭窗口时");
    expect(zh["notice.anchored-preset-conflict"]).toContain(
      "同名 Anchored Standard 预设",
    );
    expect(zh["notice.anchored-preset-unavailable"]).toContain(
      "Standard 会话仍可正常使用",
    );
    expect(
      readFileSync(join(pluginRoot, "src/client-runtime.js"), "utf8"),
    ).toContain("model.state?.notice");
    expect(rendered).not.toContain("启用 Anchored Standard");
    expect(rendered).not.toContain("Desktop runtime");
    expect(rendered).toContain('"type":"HarnessMenu"');
    expect(rendered).toContain('"type":"HarnessButton"');
    expect(rendered).not.toContain('"type":"select"');
    expect(rendered).not.toContain('"type":"input"');
    dispose();
  });

  it("deduplicates desktop apply effects and releases them only after the final disposer", () => {
    const listeners = new Map<string, Set<() => void>>();
    const root = { dataset: {} as Record<string, string> };
    const head = { appendChild: () => undefined };
    const document = {
      documentElement: root,
      head,
      getElementById: () => null,
      createElement: () => ({ id: "", textContent: "" }),
    } as unknown as Document;
    const pushState = () => undefined;
    const replaceState = () => undefined;
    const desktopWindow = {
      deepseekDesktop: {},
      location: { pathname: "/settings" },
      history: { pushState, replaceState },
      matchMedia: () => ({ matches: false }),
      addEventListener(name: string, listener: () => void) {
        const values = listeners.get(name) ?? new Set<() => void>();
        values.add(listener);
        listeners.set(name, values);
      },
      removeEventListener(name: string, listener: () => void) {
        listeners.get(name)?.delete(listener);
      },
    };
    const { module } = loadClientExports(desktopWindow, document);
    const apply = module.apply as DesktopClientApply;
    let registrations = 0;
    let slotDisposals = 0;
    const ctx = {
      locale: {
        register: () => () => undefined,
      },
      slots: {
        inject(_name: string, register: () => unknown) {
          registrations += 1;
          register();
          return () => {
            slotDisposals += 1;
          };
        },
        register() {
          return undefined;
        },
      },
    };

    const first = apply(ctx);
    const wrappedPushState = desktopWindow.history.pushState;
    const second = apply(ctx);

    expect(registrations).toBe(2);
    expect(desktopWindow.history.pushState).toBe(wrappedPushState);
    expect(listeners.get("popstate")?.size).toBe(1);
    first();
    first();
    expect(desktopWindow.history.pushState).toBe(wrappedPushState);
    expect(slotDisposals).toBe(0);
    second();
    expect(desktopWindow.history.pushState).toBe(pushState);
    expect(desktopWindow.history.replaceState).toBe(replaceState);
    expect(listeners.get("popstate")?.size).toBe(0);
    expect(slotDisposals).toBe(2);
  });

  it("runs only the bridge actions and cleans up its runtime subscription", async () => {
    const { module } = loadClientExports({ deepseekDesktop: {} });
    const createModel = module.createDesktopSettingsModel as (
      bridge: Bridge,
    ) => {
      state: RuntimeState | undefined;
      closeBehavior: "minimize" | "quit" | undefined;
      start(): Promise<void>;
      stop(): void;
      restart(): Promise<void>;
      openLogs(): Promise<void>;
      setCloseBehavior(value: "minimize" | "quit"): Promise<void>;
    };
    let listener: ((state: RuntimeState) => void) | undefined;
    let unsubscribeCount = 0;
    const calls: string[] = [];
    const bridge: Bridge = {
      async getRuntimeState() {
        calls.push("runtime:get");
        return { phase: "ready", restartCount: 1 };
      },
      async restartHarness() {
        calls.push("runtime:restart");
      },
      async openLogs() {
        calls.push("logs:open");
      },
      async getCloseBehavior() {
        calls.push("close:get");
        return "minimize";
      },
      async setCloseBehavior(value) {
        calls.push(`close:set:${value}`);
      },
      subscribeRuntime(next) {
        listener = next;
        return () => {
          unsubscribeCount += 1;
        };
      },
    };
    const model = createModel(bridge);

    await model.start();
    listener?.({ phase: "recovering", restartCount: 2 });
    await model.setCloseBehavior("quit");
    await model.restart();
    await model.openLogs();
    model.stop();
    model.stop();

    expect(model.state).toEqual({ phase: "recovering", restartCount: 2 });
    expect(model.closeBehavior).toBe("quit");
    expect(calls).toEqual([
      "runtime:get",
      "close:get",
      "close:set:quit",
      "runtime:restart",
      "logs:open",
    ]);
    expect(unsubscribeCount).toBe(1);
  });

  it("uses grouped desktop preferences and runtime capabilities when available", async () => {
    const { module } = loadClientExports({ deepseekDesktop: {} });
    const createModel = module.createDesktopSettingsModel as (
      bridge: ModernBridge,
    ) => {
      state: RuntimeState | undefined;
      appInfo: { name: string; version: string } | undefined;
      closeBehavior: "ask" | "minimize" | "quit" | undefined;
      start(): Promise<void>;
      setCloseBehavior(value: "minimize" | "quit"): Promise<void>;
    };
    const calls: string[] = [];
    const bridge: ModernBridge = {
      preferences: {
        async get() {
          calls.push("preferences:get");
          return { closeBehavior: "ask" };
        },
        async set(value) {
          calls.push(`preferences:set:${value.closeBehavior}`);
        },
      },
      runtime: {
        async getState() {
          calls.push("runtime:getState");
          return { phase: "ready", restartCount: 0 };
        },
        async restartHarness() {
          calls.push("runtime:restartHarness");
        },
        async openLogs() {
          calls.push("runtime:openLogs");
        },
        subscribe() {
          calls.push("runtime:subscribe");
          return () => undefined;
        },
      },
      app: {
        async getInfo() {
          calls.push("app:info");
          return { name: "DeepSeek Harness Code", version: "0.1.0-BETA3" };
        },
      },
    };

    const model = createModel(bridge);
    await model.start();
    await model.setCloseBehavior("quit");

    expect(model.state).toEqual({ phase: "ready", restartCount: 0 });
    expect(model.appInfo).toEqual({
      name: "DeepSeek Harness Code",
      version: "0.1.0-BETA3",
    });
    expect(model.closeBehavior).toBe("quit");
    expect(calls).toEqual([
      "app:info",
      "runtime:getState",
      "preferences:get",
      "runtime:subscribe",
      "preferences:set:quit",
    ]);
  });

  it("retains the first-close ask state and contains bridge action failures", async () => {
    const { module } = loadClientExports({ deepseekDesktop: {} });
    const createModel = module.createDesktopSettingsModel as (
      bridge: Bridge,
    ) => {
      closeBehavior: "ask" | "minimize" | "quit" | undefined;
      error: string | undefined;
      start(): Promise<void>;
      restart(): Promise<void>;
      openLogs(): Promise<void>;
      setCloseBehavior(value: "minimize" | "quit"): Promise<void>;
    };
    const bridge: Bridge = {
      async getRuntimeState() {
        return { phase: "ready", restartCount: 0 };
      },
      async restartHarness() {
        throw new Error("restart unavailable");
      },
      async openLogs() {
        throw new Error("logs unavailable");
      },
      async getCloseBehavior() {
        return "ask";
      },
      async setCloseBehavior() {
        throw new Error("close preference unavailable");
      },
      subscribeRuntime() {
        return () => undefined;
      },
    };
    const model = createModel(bridge);

    await model.start();
    await model.restart();
    expect(model.closeBehavior).toBe("ask");
    expect(model.error).toBe("restart unavailable");
    await model.openLogs();
    expect(model.error).toBe("logs unavailable");
    await model.setCloseBehavior("quit");
    expect(model.error).toBe("close preference unavailable");
  });

  it("uses View Transitions when available, otherwise installs an accessible CSS fallback", () => {
    const { module } = loadClientExports();
    const installTransitions = module.installTransitions as (
      document: Document,
      window: Window,
    ) => () => void;
    const listeners = new Map<string, () => void>();
    const root = { dataset: {} as Record<string, string> };
    const head = { appendChild: () => undefined };
    let viewTransitions = 0;
    let pathname = "/settings";
    const pushState = (
      _state: unknown,
      _title: string,
      url?: string | URL | null,
    ) => {
      pathname = String(url);
    };
    const replaceState = (
      _state: unknown,
      _title: string,
      url?: string | URL | null,
    ) => {
      pathname = String(url);
    };
    const document = {
      documentElement: root,
      head,
      getElementById: () => null,
      createElement: () => ({ id: "", textContent: "" }),
      startViewTransition: (update: () => void) => {
        viewTransitions += 1;
        update();
      },
    } as unknown as Document;
    const window = {
      location: {
        get pathname() {
          return pathname;
        },
      },
      history: { pushState, replaceState },
      matchMedia: () => ({ matches: false }),
      addEventListener: (name: string, listener: () => void) => {
        listeners.set(name, listener);
      },
      removeEventListener: (name: string) => {
        listeners.delete(name);
      },
    } as unknown as Window;

    const dispose = installTransitions(document, window);
    listeners.get("popstate")?.();

    window.history.pushState({}, "", "/workspace");
    window.history.replaceState({}, "", "/subagent");

    expect(root.dataset.dshDesktopTransition).toBe("view");
    expect(root.dataset.dshDesktopPage).toBe("subagent");
    expect(viewTransitions).toBe(4);
    dispose();

    expect(listeners.size).toBe(0);
    expect(window.history.pushState).toBe(pushState);
    expect(window.history.replaceState).toBe(replaceState);

    const fallback = loadClientExports().module.installTransitions as (
      document: Document,
      window: Window,
    ) => () => void;
    const fallbackDocument = {
      ...document,
      startViewTransition: undefined,
    } as unknown as Document;
    fallback(fallbackDocument, window);
    expect(root.dataset.dshDesktopTransition).toBe("css");
  });

  it("installs desktop chrome and inline status styles without a fixed overlay", () => {
    const dom = new JSDOM(
      "<!doctype html><html><head></head><body></body></html>",
      {
        url: "https://harness.test/session",
      },
    );
    const { module } = loadClientExports(
      dom.window as unknown as Record<string, unknown>,
      dom.window.document,
    );
    const installTransitions = module.installTransitions as (
      document: Document,
      window: Window,
    ) => () => void;

    const dispose = installTransitions(
      dom.window.document,
      dom.window as unknown as Window,
    );
    const style = dom.window.document.querySelector(
      "#deepseek-harness-desktop-transitions",
    );

    expect(style?.textContent).not.toContain("[data-dsh-stream-overlay]");
    expect(style?.textContent).toContain("[data-dsh-desktop-thinking-inline]");
    expect(style?.textContent).not.toMatch(
      /\[data-dsh-desktop-thinking-inline\][^{]*\{[^}]*position:\s*fixed/s,
    );
    dispose();
  });

  it("extends macOS surfaces to the top and offsets only sidebar inner content", () => {
    const dom = new JSDOM(
      "<!doctype html><html><head></head><body><main></main></body></html>",
      {
        url: "https://harness.test/session",
      },
    );
    const { module } = loadClientExports(
      dom.window as unknown as Record<string, unknown>,
      dom.window.document,
    );
    const installTransitions = module.installTransitions as (
      document: Document,
      window: Window,
    ) => () => void;

    const dispose = installTransitions(
      dom.window.document,
      dom.window as unknown as Window,
    );
    expect(
      dom.window.getComputedStyle(dom.window.document.body).paddingTop,
    ).toBe("");

    const sidebarClient = join(
      harnessRoot,
      "packages",
      "client",
      "ui-sidebar",
      "lib",
      "client.js",
    );
    const sidebarSource = readFileSync(sidebarClient, "utf8");
    const expandedRule = sidebarSource.match(
      /:root\[data-dsh-desktop-platform=macos\] \.([\w-]+)\{padding-top:46px\}/,
    );
    const collapsedRule = sidebarSource.match(
      /:root\[data-dsh-desktop-platform=macos\] \.([\w-]+)\.([\w-]+)\{padding-top:58px\}/,
    );
    expect(expandedRule).not.toBeNull();
    expect(collapsedRule).not.toBeNull();
    if (expandedRule === null || collapsedRule === null) {
      throw new Error("maintained Sidebar macOS inset rules were not built");
    }
    let sidebarRegistration:
      | { factory(require: (id: string) => unknown): unknown }
      | undefined;
    Object.assign(dom.window, {
      __ModuleLoader__: {
        load(value: typeof sidebarRegistration) {
          sidebarRegistration = value;
        },
      },
    });
    const ctx = vm.createContext({
      document: dom.window.document,
      window: dom.window,
    });
    new vm.Script(sidebarSource).runInContext(ctx);
    const noop = () => undefined;
    sidebarRegistration?.factory((id) => {
      if (id === "react") return new Proxy({}, { get: () => noop });
      if (id === "react/jsx-runtime") return { jsx: noop, jsxs: noop };
      return new Proxy({}, { get: () => noop });
    });
    const sidebar = dom.window.document.createElement("div");
    sidebar.className = expandedRule[1]!;
    dom.window.document.body.append(sidebar);
    expect(dom.window.getComputedStyle(sidebar).paddingTop).toBe("");
    dom.window.document.documentElement.dataset.dshDesktopPlatform = "macos";
    expect(dom.window.getComputedStyle(sidebar).paddingTop).toBe("46px");
    sidebar.classList.add(collapsedRule[2]!);
    expect(dom.window.getComputedStyle(sidebar).paddingTop).toBe("58px");
    dispose();
  });

  it("does not reanimate the page for ordinary DOM changes after SPA navigation", async () => {
    const dom = new JSDOM('<!doctype html><main id="page"></main>', {
      url: "https://harness.test/settings",
    });
    const document = dom.window.document;
    const page = document.querySelector("main")!;
    const desktopWindow = dom.window as unknown as Record<string, unknown>;
    desktopWindow.deepseekDesktop = {};
    const { module } = loadClientExports(desktopWindow, document);
    const apply = module.apply as DesktopClientApply;
    const dispose = apply({
      locale: {
        register: () => () => undefined,
      },
      slots: {
        inject(_name, register) {
          register();
          return () => undefined;
        },
        register() {
          return undefined;
        },
      },
    });

    dom.window.history.pushState({}, "", "/workspace");
    page.append(document.createElement("section"));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(document.documentElement.dataset.dshDesktopPage).toBe("workspace");
    expect(
      document.documentElement.dataset.dshDesktopTransitionNonce,
    ).toBeUndefined();
    expect(
      document.documentElement.dataset.dshDesktopAnimation,
    ).toBeUndefined();

    dom.reconfigure({ url: "https://harness.test/session" });
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    page.append(document.createElement("article"));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(document.documentElement.dataset.dshDesktopPage).toBe("session");
    expect(
      document.documentElement.dataset.dshDesktopTransitionNonce,
    ).toBeUndefined();
    expect(
      document.documentElement.dataset.dshDesktopAnimation,
    ).toBeUndefined();
    dispose();
  });

  it("uses semantic selectors and disables animation for reduced motion", () => {
    const css = readFileSync(
      join(pluginRoot, "src", "transitions.css"),
      "utf8",
    );
    const runtime = readFileSync(
      join(pluginRoot, "src", "client-runtime.js"),
      "utf8",
    );

    expect(css).toContain("[data-dsh-desktop-page]");
    expect(css).toContain("[data-dsh-desktop-breadcrumb]");
    expect(css).toContain('[data-dsh-desktop-platform="macos"]');
    expect(css).toContain("--dsh-desktop-titlebar-safe-inset");
    expect(css).toContain("180ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("[data-dsh-desktop-settings]");
    expect(css).toContain("--dsw-alias-border-l2");
    expect(runtime).toContain("@deepseek-ai/dsh-client-ui-primitives");
    expect(css).not.toContain(".dshDesktopSettingsButton");
    expect(runtime).not.toMatch(/\.[A-Za-z0-9]{6}[_-]/);
    expect(runtime).not.toContain("offsetWidth");
  });
});
