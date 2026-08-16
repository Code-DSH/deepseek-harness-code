import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  findRunningStatus,
  installThinkingStatus,
} from "../src/thinking-status.js";

type StatusSnapshot = {
  anchor: Element;
  left: number;
  top: number;
} | null;

function fixture() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div role="status" aria-live="polite" id="outside">外部状态</div>
      <div data-chat-flow>
        <section><div role="status" aria-live="polite" id="nested">嵌套状态</div></section>
        <div role="status" aria-live="polite" id="running">正在推理</div>
      </div>
    </body></html>`,
    { url: "https://harness.test/session" },
  );
  const window = dom.window;
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

  const rect = { left: 42, top: 100, width: 140, height: 26 };
  const running = window.document.querySelector("#running") as HTMLElement;
  Object.defineProperty(running, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
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

  return { dom, window, rect, running, frames, flush };
}

describe("thinking status lifecycle", () => {
  it("finds only the direct chat-flow live status without relying on its text", () => {
    const { window, running } = fixture();

    expect(findRunningStatus(window.document)).toBe(running);
    running.textContent = "任意本地化文案";
    expect(findRunningStatus(window.document)).toBe(running);
  });

  it("tracks the 20px orb position and clears it when generation stops", async () => {
    const { window, rect, running, frames, flush } = fixture();
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const snapshots: StatusSnapshot[] = [];
    const dispose = installThinkingStatus(
      window.document,
      window as unknown as Window,
      (snapshot) => snapshots.push(snapshot),
    );

    await flush();
    expect(snapshots).toEqual([{ anchor: running, left: 42, top: 103 }]);
    expect(addListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    expect(addListener).toHaveBeenCalledWith("resize", expect.any(Function));

    window.dispatchEvent(new window.Event("scroll"));
    await flush();
    expect(snapshots).toHaveLength(1);

    rect.left = 50;
    rect.top = 120;
    window.dispatchEvent(new window.Event("resize"));
    await flush();
    expect(snapshots.at(-1)).toEqual({
      anchor: running,
      left: 50,
      top: 123,
    });

    running.remove();
    await flush();
    expect(snapshots.at(-1)).toBeNull();
    expect(removeListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
      true,
    );
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));

    dispose();
    const countAfterDispose = snapshots.length;
    window.document.querySelector("[data-chat-flow]")?.append(running);
    window.dispatchEvent(new window.Event("resize"));
    await flush();
    expect(snapshots).toHaveLength(countAfterDispose);
    expect(frames.size).toBe(0);
  });

  it("cancels pending work and reveals the native status on disposal", async () => {
    const { window, frames, flush } = fixture();
    const snapshots: StatusSnapshot[] = [];
    const dispose = installThinkingStatus(
      window.document,
      window as unknown as Window,
      (snapshot) => snapshots.push(snapshot),
    );

    await flush();
    window.dispatchEvent(new window.Event("scroll"));
    expect(frames.size).toBe(1);
    dispose();

    expect(frames.size).toBe(0);
    expect(snapshots.at(-1)).toBeNull();
    expect(() => dispose()).not.toThrow();
  });
});
