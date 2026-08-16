import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStreamOutputEffectController } from "../src/stream-output-controller.js";

type FrameWindow = Window & {
  CSS: { highlights: Map<string, Set<Range>> };
  Highlight: new () => Set<Range>;
  Event: typeof Event;
  Range: typeof Range;
};

function fixture(reducedMotion = false) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body>
    <div data-chat-flow>
      <div data-chat-flow-kind="assistant-step">
        <div data-streaming>
          <p id="answer" style="color: rgb(20, 30, 40); font-family: Inter; font-size: 16px; font-weight: 500; line-height: 28px">回答</p>
          <div data-variant="think"><span id="reasoning" style="color: rgb(120, 120, 120); font-family: Inter; font-size: 14px; line-height: 24px">思考</span></div>
          <code id="code">const x = 1</code>
        </div>
      </div>
      <div data-chat-flow-kind="user"><p id="user">问题</p></div>
    </div>
  </body>`,
    { url: "https://harness.test/session" },
  );
  const window = dom.window as unknown as FrameWindow;
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    frames.delete(id);
  }) as typeof window.cancelAnimationFrame;
  window.matchMedia = (() => ({
    matches: reducedMotion,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  })) as typeof window.matchMedia;
  window.CSS = { highlights: new Map() };
  window.Highlight = class extends Set<Range> {};
  Object.defineProperty(window.Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: Range) {
      const width = Math.max(1, this.endOffset - this.startOffset) * 8;
      return {
        x: 100 + this.startOffset * 8,
        y: 40,
        top: 40,
        right: 100 + this.endOffset * 8,
        bottom: 68,
        left: 100 + this.startOffset * 8,
        width,
        height: 28,
        toJSON: () => ({}),
      };
    },
  });
  const answer = window.document.querySelector("#answer") as HTMLElement;
  Object.defineProperty(answer, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 100,
      y: 40,
      top: 40,
      right: 260,
      bottom: 68,
      left: 100,
      width: 160,
      height: 28,
      toJSON: () => ({}),
    }),
  });
  const flush = async () => {
    await Promise.resolve();
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(window.performance.now());
    await Promise.resolve();
  };
  return { dom, window, answer, frames, flush };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("stream output effect controller", () => {
  it("masks and overlays only newly appended graphemes without changing source geometry", async () => {
    const { window, answer, flush } = fixture();
    const originalBox = answer.getBoundingClientRect().toJSON();
    const source = answer.firstChild as Text;
    const controller = createStreamOutputEffectController({
      document: window.document,
      window,
    });

    controller.start();
    source.data = "回答中🙂";
    await flush();

    const glyphs = Array.from(
      window.document.querySelectorAll<HTMLElement>("[data-dsh-stream-glyph]"),
    );
    expect(glyphs.map((glyph) => glyph.childNodes[0]?.textContent)).toEqual([
      "中",
      "🙂",
    ]);
    expect(glyphs[0]?.style.color).toBe("rgb(20, 30, 40)");
    expect(glyphs[0]?.style.fontFamily).toBe("Inter");
    expect(glyphs[0]?.style.fontSize).toBe("16px");
    expect(window.CSS.highlights.get("dsh-desktop-stream-mask")?.size).toBe(2);
    expect(answer.textContent).toBe("回答中🙂");
    expect(answer.getBoundingClientRect().toJSON()).toEqual(originalBox);

    controller.dispose();
    expect(window.CSS.highlights.has("dsh-desktop-stream-mask")).toBe(false);
    expect(
      window.document.querySelector("[data-dsh-stream-overlay]"),
    ).toBeNull();
  });

  it("ignores code and user changes and fails open without highlight support or with reduced motion", async () => {
    const supported = fixture();
    const controller = createStreamOutputEffectController({
      document: supported.window.document,
      window: supported.window,
    });
    controller.start();
    (
      supported.window.document.querySelector("#code")?.firstChild as Text
    ).data = "const x = 12";
    (
      supported.window.document.querySelector("#user")?.firstChild as Text
    ).data = "问题追加";
    await supported.flush();
    expect(
      supported.window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(0);
    controller.dispose();

    const unsupported = fixture();
    Reflect.deleteProperty(unsupported.window, "Highlight");
    const unsupportedController = createStreamOutputEffectController({
      document: unsupported.window.document,
      window: unsupported.window,
    });
    unsupportedController.start();
    expect(
      unsupported.window.document.querySelector("[data-dsh-stream-overlay]"),
    ).toBeNull();

    const reduced = fixture(true);
    const reducedController = createStreamOutputEffectController({
      document: reduced.window.document,
      window: reduced.window,
    });
    reducedController.start();
    expect(
      reduced.window.document.querySelector("[data-dsh-stream-overlay]"),
    ).toBeNull();
  });

  it("baselines a newly mounted streaming conversation before animating later appends", async () => {
    const { window, flush } = fixture();
    window.document.body.innerHTML = "";
    const controller = createStreamOutputEffectController({
      document: window.document,
      window,
    });
    controller.start();

    window.document.body.insertAdjacentHTML(
      "beforeend",
      `<div data-chat-flow>
        <div data-chat-flow-kind="assistant-step">
          <div data-streaming><p id="hydrated">hydrated answer</p></div>
        </div>
      </div>`,
    );
    await flush();
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(0);

    const hydrated = window.document.querySelector("#hydrated")
      ?.firstChild as Text;
    hydrated.data += "!";
    await flush();
    expect(
      Array.from(
        window.document.querySelectorAll<HTMLElement>(
          "[data-dsh-stream-glyph]",
        ),
      ).map((glyph) => glyph.childNodes[0]?.textContent),
    ).toEqual(["!"]);

    controller.dispose();
  });

  it("bounds live overlay nodes while leaving a large canonical append visible", async () => {
    const { window, answer, flush } = fixture();
    const controller = createStreamOutputEffectController({
      document: window.document,
      window,
    });
    controller.start();

    const source = answer.firstChild as Text;
    source.data += "a".repeat(300);
    await flush();

    expect(source.data).toBe(`回答${"a".repeat(300)}`);
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]").length,
    ).toBeLessThanOrEqual(120);
    expect(
      window.document.querySelectorAll("[data-dsh-stream-particle]").length,
    ).toBeLessThanOrEqual(72);

    controller.dispose();
    expect(
      window.document.querySelector("[data-dsh-stream-overlay]"),
    ).toBeNull();
  });

  it("reveals canonical text and clears effects on rewrite, completion, scroll, and disposal", async () => {
    vi.useFakeTimers();
    const { window, answer, flush, frames } = fixture();
    const source = answer.firstChild as Text;
    const controller = createStreamOutputEffectController({
      document: window.document,
      window,
    });
    controller.start();

    source.data = "回答一";
    await flush();
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(1);

    source.data = "重写";
    await flush();
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(0);
    expect(window.CSS.highlights.get("dsh-desktop-stream-mask")?.size).toBe(0);

    source.data = "重写二";
    await flush();
    window.dispatchEvent(new window.Event("scroll"));
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(0);

    source.data = "重写二三";
    await flush();
    answer.closest("[data-streaming]")?.removeAttribute("data-streaming");
    await flush();
    expect(
      window.document.querySelectorAll("[data-dsh-stream-glyph]"),
    ).toHaveLength(0);
    expect(
      window.document.querySelector("[data-dsh-stream-overlay]"),
    ).toBeNull();
    expect(window.CSS.highlights.has("dsh-desktop-stream-mask")).toBe(false);

    controller.dispose();
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
