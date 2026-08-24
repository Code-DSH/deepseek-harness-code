import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { expect, test } from "@playwright/test";

const pluginClient = join(
  process.cwd(),
  "packages",
  "dsh-lan-access",
  "lib",
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

test.beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><html><body><main data-page></main></body></html>",
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("loopback test server did not expose a port");
  }
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("shows every address and copies only the selected address payload", async ({
  page,
}) => {
  await page.goto(origin);
  await page.addScriptTag({ path: reactUmd });
  await page.addScriptTag({ path: reactDomUmd });
  await page.evaluate(() => {
    const target = window as typeof window & {
      React: {
        createElement(
          type: unknown,
          props?: unknown,
          ...children: unknown[]
        ): unknown;
      };
      lanPlugin?: { apply(context: unknown): void };
      lanSlots?: Record<string, BrowserComponent>;
      copiedLanSelections?: unknown[];
      __ModuleLoader__?: unknown;
      deepseekDesktop?: unknown;
    };
    target.lanSlots = {};
    target.copiedLanSelections = [];
    target.__ModuleLoader__ = {
      load(definition: {
        factory(require: (id: string) => unknown): {
          apply(context: unknown): void;
        };
      }) {
        target.lanPlugin = definition.factory((id) => {
          if (id === "react") return target.React;
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
          lanAccessEnabled: true,
        }),
        set: async () => undefined,
      },
      lanAccess: {
        get: async () => ({
          enabled: true,
          passwordConfigured: false,
          port: 43210,
          addresses: ["10.0.0.4", "192.168.1.12"],
        }),
        set: async (value: { enabled: boolean }) =>
          value.enabled
            ? {
                enabled: true,
                passwordConfigured: false,
                port: 43210,
                addresses: ["10.0.0.4", "192.168.1.12"],
              }
            : { enabled: false, passwordConfigured: false, addresses: [] },
        copyUrl: async (selection?: { address?: string }) => {
          target.copiedLanSelections!.push(selection);
        },
      },
      runtime: {
        getState: async () => ({ phase: "ready" as const, restartCount: 0 }),
        restartHarness: async () => undefined,
        openLogs: async () => undefined,
        subscribe: () => () => undefined,
      },
      updater: {
        getStatus: async () => ({ phase: "idle" as const }),
        check: async () => ({ available: false }),
        apply: async () => ({ available: false }),
        restart: async () => undefined,
        subscribe: () => () => undefined,
      },
      bundledPlugins: { list: async () => [] },
    };
  });
  await page.addScriptTag({ path: pluginClient });
  await page.evaluate(() => {
    const target = window as typeof window & {
      React: {
        createElement(
          type: unknown,
          props?: unknown,
          ...children: unknown[]
        ): unknown;
      };
      ReactDOM: { createRoot(node: Element): { render(value: unknown): void } };
      lanPlugin: { apply(context: unknown): void };
      lanSlots: Record<string, BrowserComponent>;
    };
    target.lanPlugin.apply({
      get(name: string) {
        if (name !== "slots") return undefined;
        return {
          inject: (_slot: string, register: () => unknown) => {
            register();
            return () => undefined;
          },
          register: (
            definition: { name: string },
            component: BrowserComponent,
          ) => {
            target.lanSlots[definition.name] = component;
            return () => undefined;
          },
        };
      },
      effect(effect: () => unknown) {
        effect();
      },
    });
    const Row = target.lanSlots["settings.general.item"];
    target.ReactDOM.createRoot(document.querySelector("[data-page]")!).render(
      target.React.createElement(Row),
    );
  });

  await expect(page.getByRole("button", { name: "关闭" })).toBeEnabled();
  await expect(page.locator('[data-lan-address="10.0.0.4"]')).toBeVisible();
  await expect(page.locator('[data-lan-address="192.168.1.12"]')).toBeVisible();
  await page.getByLabel("局域网地址").selectOption("192.168.1.12");
  await page.getByRole("button", { name: "复制访问链接" }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { copiedLanSelections?: unknown[] })
            .copiedLanSelections,
      ),
    )
    .toEqual([{ address: "192.168.1.12" }]);
  await expect(page.getByText(/未加密 HTTP/u)).toBeVisible();
  const exposedText = await page.locator("body").innerText();
  expect(exposedText).not.toContain("lanToken");
  expect(exposedText).not.toContain("http://");
});
