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
    response.end("<!doctype html><html><head></head><body></body></html>");
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

test("animates only appended assistant prose and preserves canonical layout", async ({
  page,
}) => {
  await page.goto(origin);
  await page.evaluate(() => {
    const createElement = (
      type: unknown,
      props: Record<string, unknown>,
      ...children: unknown[]
    ) => ({ type, props, children });
    Object.assign(window, {
      __ModuleLoader__: {
        load(definition: {
          factory: (require: (id: string) => unknown) => unknown;
        }) {
          Object.assign(window, {
            desktopPlugin: definition.factory((id) => {
              if (id === "react") {
                return {
                  createElement,
                  useEffect: () => undefined,
                  useState: (factory: () => unknown) => [
                    factory(),
                    () => undefined,
                  ],
                };
              }
              if (id === "react/jsx-runtime") {
                return { jsx: createElement, jsxs: createElement };
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
    });
  });
  await page.addScriptTag({ path: pluginClient });
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div data-chat-flow>
        <div data-chat-flow-kind="assistant-step">
          <div data-streaming style="width: 420px">
            <p id="answer" style="color: rgb(20, 30, 40); font: 16px/28px sans-serif">Answer <a href="#details">link</a></p>
            <div data-variant="think"><span id="reasoning" style="color: rgb(120, 120, 120); font: 14px/24px sans-serif">Reason</span></div>
            <code id="code">const x = 1</code>
          </div>
        </div>
        <div data-chat-flow-kind="user"><p id="user">Question</p></div>
      </div>`;
    const target = window as typeof window & {
      desktopPlugin: {
        installStreamOutputEffects(
          document: Document,
          window: Window,
        ): () => void;
      };
      streamDispose?: () => void;
    };
    target.streamDispose = target.desktopPlugin.installStreamOutputEffects(
      document,
      window,
    );
  });

  const before = await page.locator("#answer").boundingBox();
  await page.evaluate(() => {
    const answer = document.querySelector("#answer")?.firstChild as Text;
    const reasoning = document.querySelector("#reasoning")?.firstChild as Text;
    const code = document.querySelector("#code")?.firstChild as Text;
    const user = document.querySelector("#user")?.firstChild as Text;
    answer.data += "新";
    reasoning.data += "灰";
    code.data += "2";
    user.data += "追加";
  });

  await expect(page.locator("[data-dsh-stream-glyph]")).toHaveCount(2);
  const result = await page.evaluate(() => ({
    texts: [...document.querySelectorAll("[data-dsh-stream-glyph]")].map(
      (element) => element.childNodes[0]?.textContent,
    ),
    colors: [
      ...document.querySelectorAll<HTMLElement>("[data-dsh-stream-glyph]"),
    ].map((element) => element.style.color),
    code: document.querySelector("#code")?.textContent,
    user: document.querySelector("#user")?.textContent,
    links: document.querySelectorAll("#answer a").length,
  }));
  expect(result).toEqual({
    texts: ["新", "灰"],
    colors: ["rgb(20, 30, 40)", "rgb(120, 120, 120)"],
    code: "const x = 12",
    user: "Question追加",
    links: 1,
  });
  expect(await page.locator("#answer").boundingBox()).toEqual(before);

  await page.evaluate(() => {
    document
      .querySelector("[data-streaming]")
      ?.removeAttribute("data-streaming");
  });
  await expect(page.locator("[data-dsh-stream-glyph]")).toHaveCount(0);
  await page.evaluate(() => {
    const target = window as typeof window & { streamDispose?: () => void };
    target.streamDispose?.();
  });
  await expect(page.locator("[data-dsh-stream-overlay]")).toHaveCount(0);
});
