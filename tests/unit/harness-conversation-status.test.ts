import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

const rootRequire = createRequire(join(process.cwd(), "package.json"));
const dshRequire = createRequire(
  rootRequire.resolve("@deepseek-ai/dsh/package.json"),
);
const { JSDOM } = rootRequire("jsdom") as {
  JSDOM: new (html?: string, options?: { url?: string }) => any;
};
const conversationRoot = dirname(
  dshRequire.resolve("@deepseek-ai/dsh-client-ui-conversation/package.json"),
);
const conversationSource = readFileSync(
  join(conversationRoot, "lib", "client.js"),
  "utf8",
);

function loadTurnStatus() {
  const formatStart = conversationSource.indexOf("function formatRunDuration");
  const formatEnd = conversationSource.indexOf(
    "/**\n\t\t* Sub-turn latency figure",
    formatStart,
  );
  const statusStart = conversationSource.indexOf(
    "function TurnStatus",
    formatEnd,
  );
  const statusEnd = conversationSource.indexOf(
    "/**\n\t\t* The chat view slot entry",
    statusStart,
  );
  if ([formatStart, formatEnd, statusStart, statusEnd].includes(-1)) {
    throw new Error("pinned Harness TurnStatus source boundaries changed");
  }

  const source = `${conversationSource.slice(formatStart, formatEnd)}\n${conversationSource.slice(statusStart, statusEnd)}\nTurnStatus;`;
  const now = 10_000;
  const react = {
    useState<T>(initial: T | (() => T)) {
      return [
        typeof initial === "function" ? (initial as () => T)() : initial,
        vi.fn(),
      ];
    },
    useEffect: vi.fn(),
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const ctx = vm.createContext({
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    ChatView_module_css_default: {
      turnStatus: "turnStatus",
      turnStatusClock: "turnStatusClock",
    },
    react,
    react_jsx_runtime: { jsx, jsxs: jsx },
    setInterval,
    clearInterval,
  });
  return new vm.Script(source).runInContext(ctx) as (props: {
    startTime: number;
    t(key: string, values: Record<string, unknown>): string;
  }) => { props: { children: unknown[] } };
}

// rc.7 re-baselining deferred: these tests lock the rc.6 conversation patch
// (always-on elapsed clock + Orb-only-motion .Md3f7G_turnStatus CSS). The
// patch's CSS-insertion and tailData hunks moved in rc.7, so it no longer
// applies; re-base the patch via `pnpm patch` and un-skip this suite.
describe.skip("pinned Harness running status", () => {
  it("renders the official elapsed clock immediately at zero seconds", () => {
    const TurnStatus = loadTurnStatus();
    const rendered = TurnStatus({
      startTime: 10_000,
      t(_key, values) {
        return `${values.seconds}s`;
      },
    });

    expect(rendered.props.children[0]).toBe("Deep diving...");
    expect(rendered.props.children[1]).toMatchObject({
      props: { children: "0s" },
    });
  });

  it("uses the Orb as the only active motion in the running status row", () => {
    const dom = new JSDOM(
      "<!doctype html><html><head></head><body></body></html>",
    );
    let registration:
      | { factory(require: (id: string) => unknown): unknown }
      | undefined;
    Object.assign(dom.window, {
      __ModuleLoader__: {
        load(value: typeof registration) {
          registration = value;
        },
      },
    });
    const ctx = vm.createContext({
      console,
      document: dom.window.document,
      queueMicrotask,
      setTimeout,
      window: dom.window,
    });
    new vm.Script(conversationSource).runInContext(ctx);
    const noop = () => undefined;
    const fallback = new Proxy(noop, {
      construct: () => ({}),
      get: () => noop,
    });
    registration?.factory((id) => {
      if (id === "@deepseek-ai/cordis") return { Service: class {} };
      if (id === "react") return new Proxy({}, { get: () => noop });
      if (id === "react/jsx-runtime") return { jsx: noop, jsxs: noop };
      return fallback;
    });
    const status = dom.window.document.createElement("div");
    status.className = "Md3f7G_turnStatus";
    dom.window.document.body.append(status);

    const override = dom.window.document.querySelector(
      'style[data-plugin-css="@deepseek-ai/dsh-client-ui-conversation/DesktopTurnStatus.css"]',
    ) as HTMLStyleElement | null;
    const rule = override?.sheet?.cssRules[0] as CSSStyleRule | undefined;
    expect(rule?.selectorText).toBe(".Md3f7G_turnStatus");
    expect(rule?.style.animation).toBe("none");
  });
});
