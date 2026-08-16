import { createServer, type Server } from "node:http";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const pluginClient = join(
  process.cwd(),
  "packages",
  "desktop-plugin",
  "client.js",
);
let server: Server;
let origin: string;

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
    registrations: 1,
    slots: ["settings.general.item"],
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
