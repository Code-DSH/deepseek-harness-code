import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { expect, test } from "@playwright/test";

const pluginClient = join(
  process.cwd(),
  "packages",
  "desktop-plugin",
  "client.js",
);
const nodeRequire = createRequire(join(process.cwd(), "package.json"));
const reactUmd = join(
  dirname(nodeRequire.resolve("react/package.json")),
  "umd",
  "react.development.js",
);
const reactDomUmd = join(
  dirname(nodeRequire.resolve("react-dom/package.json")),
  "umd",
  "react-dom.development.js",
);
let server: Server;
let origin: string;

type BrowserComponent = (props?: Record<string, unknown>) => unknown;
type BrowserReact = {
  Fragment: unknown;
  createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown;
};

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><html><head></head><body><main data-page>Harness</main></body></html>",
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("loopback test server did not expose a port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("installs desktop settings and animates route commits with cleanup", async ({
  page,
}) => {
  await page.goto(origin);
  await page.evaluate(() => {
    const fakeReact = {
      createElement: () => null,
      useEffect: () => undefined,
      useLayoutEffect: () => undefined,
      useRef: (value: unknown) => ({ current: value }),
      useState: (factory: () => unknown) => [factory(), () => undefined],
    };
    Object.assign(window, {
      __ModuleLoader__: {
        load(definition: {
          factory: (require: (id: string) => unknown) => unknown;
        }) {
          Object.assign(window, {
            desktopPlugin: definition.factory((id) => {
              if (id === "react") return fakeReact;
              if (id === "react/jsx-runtime") {
                return {
                  jsx: fakeReact.createElement,
                  jsxs: fakeReact.createElement,
                };
              }
              if (id === "@deepseek-ai/dsh-client-ui-primitives") {
                return {
                  Button: () => null,
                  Menu: () => null,
                  IconChevronDownOutline14: () => null,
                };
              }
              throw new Error(`unexpected client dependency: ${id}`);
            }),
          });
        },
      },
      deepseekDesktop: {
        getRuntimeState: async () => ({ phase: "ready", restartCount: 0 }),
        restartHarness: async () => undefined,
        openLogs: async () => undefined,
        getCloseBehavior: async () => "minimize",
        setCloseBehavior: async () => undefined,
        subscribeRuntime: () => () => undefined,
      },
    });
  });
  await page.addScriptTag({ path: pluginClient });

  const installed = await page.evaluate(() => {
    const target = window as typeof window & {
      desktopPlugin: { apply(context: unknown): () => void };
      desktopDispose?: () => void;
      slotRegistrations?: number;
      slotNames?: string[];
    };
    target.slotRegistrations = 0;
    target.slotNames = [];
    target.desktopDispose = target.desktopPlugin.apply({
      slots: {
        inject: (name: string, register: () => unknown) => {
          register();
          target.slotRegistrations! += 1;
          target.slotNames!.push(name);
          return () => {
            target.slotRegistrations! -= 1;
          };
        },
        register: () => () => undefined,
      },
      locale: {
        register: () => () => undefined,
      },
    });
    return {
      registrations: target.slotRegistrations,
      slots: target.slotNames,
      style: Boolean(
        document.querySelector("#deepseek-harness-desktop-transitions"),
      ),
    };
  });
  expect(installed).toEqual({
    registrations: 2,
    slots: ["settings.general.item", "shell.overlay"],
    style: true,
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.dshDesktopPage),
    )
    .toBe("shell");

  await page.evaluate(() => {
    history.pushState({}, "", "/settings");
    document
      .querySelector("[data-page]")
      ?.setAttribute("data-route-commit", "settings");
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.dshDesktopPage),
    )
    .toBe("settings");

  const disposed = await page.evaluate(() => {
    const target = window as typeof window & {
      desktopDispose?: () => void;
      slotRegistrations?: number;
    };
    target.desktopDispose?.();
    return target.slotRegistrations;
  });
  expect(disposed).toBe(0);
});

test("renders the rotating Orb inside the native status row and cleans up", async ({
  page,
}) => {
  await page.goto(origin);
  await page.addScriptTag({ path: reactUmd });
  await page.addScriptTag({ path: reactDomUmd });
  await page.evaluate(() => {
    const target = window as typeof window & {
      React: BrowserReact;
      desktopPlugin?: { apply(context: unknown): () => void };
      desktopSlots?: Record<string, BrowserComponent>;
      __ModuleLoader__?: unknown;
      deepseekDesktop?: unknown;
    };
    target.desktopSlots = {};
    target.__ModuleLoader__ = {
      load(definition: {
        factory: (require: (id: string) => unknown) => {
          apply(context: unknown): () => void;
        };
      }) {
        target.desktopPlugin = definition.factory((id) => {
          if (id === "react") return target.React;
          if (id === "react/jsx-runtime") {
            return {
              jsx: target.React.createElement,
              jsxs: target.React.createElement,
            };
          }
          if (id === "@deepseek-ai/dsh-client-ui-primitives") {
            return {
              Button: () => null,
              Menu: () => null,
              IconChevronDownOutline14: () => null,
            };
          }
          throw new Error(`unexpected client dependency: ${id}`);
        });
      },
    };
    target.deepseekDesktop = {
      app: {
        getInfo: async () => ({
          name: "DeepSeek Harness Code",
          version: "0.1.0-BETA3",
        }),
      },
      preferences: {
        get: async () => ({
          closeBehavior: "minimize",
          lanAccessEnabled: false,
        }),
        set: async () => undefined,
      },
      lanAccess: {
        get: async () => ({
          enabled: false,
          passwordConfigured: false,
          addresses: [],
        }),
        set: async () => ({
          enabled: false,
          passwordConfigured: false,
          addresses: [],
        }),
        copyUrl: async () => undefined,
      },
      runtime: {
        getState: async () => ({ phase: "ready", restartCount: 0 }),
        restartHarness: async () => undefined,
        openLogs: async () => undefined,
        subscribe: () => () => undefined,
      },
      updater: {
        check: async () => ({ available: false }),
        apply: async () => ({ available: false }),
        restart: async () => undefined,
        subscribe: () => () => undefined,
      },
      bundledPlugins: {
        list: async () => [],
      },
    };
  });
  await page.addScriptTag({ path: pluginClient });

  await page.evaluate(() => {
    const target = window as typeof window & {
      React: BrowserReact;
      ReactDOM: { createRoot(node: Element): { render(value: unknown): void } };
      desktopPlugin: { apply(context: unknown): () => void };
      desktopSlots: Record<string, BrowserComponent>;
      desktopDispose?: () => void;
      desktopRoot?: { render(value: unknown): void };
    };
    target.desktopDispose = target.desktopPlugin.apply({
      locale: { register: () => () => undefined },
      slots: {
        inject: (_name: string, register: () => unknown) => {
          register();
          return () => undefined;
        },
        register: (
          definition: { name: string },
          component: BrowserComponent,
        ) => {
          target.desktopSlots[definition.name] = component;
          return () => undefined;
        },
      },
    });
    const Overlay = target.desktopSlots["shell.overlay"];
    const rootNode = document.querySelector("[data-page]")!;
    target.desktopRoot = target.ReactDOM.createRoot(rootNode);
    target.desktopRoot.render(
      target.React.createElement(
        target.React.Fragment,
        null,
        target.React.createElement(
          "div",
          { "data-chat-flow": "" },
          target.React.createElement(
            "div",
            { role: "status", "aria-live": "polite" },
            "Deep diving...",
            target.React.createElement("span", null, "0s"),
          ),
        ),
        target.React.createElement(Overlay),
      ),
    );
  });

  const inline = page.locator("[data-dsh-desktop-thinking-inline]");
  await expect(inline).toBeVisible();
  await expect(inline.locator("canvas")).toHaveCount(1);
  const geometry = await inline.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      parentRole: element.parentElement?.getAttribute("role"),
      position: style.position,
      zIndex: style.zIndex,
      order: style.order,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(geometry).toEqual({
    parentRole: "status",
    position: "relative",
    zIndex: "1",
    order: "-1",
    width: 20,
    height: 20,
  });

  await page.evaluate(() => {
    const target = window as typeof window & {
      React: BrowserReact;
      desktopSlots: Record<string, BrowserComponent>;
      desktopRoot: { render(value: unknown): void };
      desktopDispose?: () => void;
    };
    const Overlay = target.desktopSlots["shell.overlay"];
    target.desktopRoot.render(target.React.createElement(Overlay));
    target.desktopDispose?.();
  });
  await expect(inline).toHaveCount(0);
});
