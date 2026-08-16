import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  findRunningStatus,
  installThinkingStatus,
} from "../src/thinking-status.js";

function fixture() {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div role="status" aria-live="polite" id="outside">外部状态</div>
      <div data-chat-flow>
        <section><div role="status" aria-live="polite" id="nested">嵌套状态</div></section>
        <div role="status" aria-live="polite" id="running">Deep diving...</div>
      </div>
      <aside id="unrelated"></aside>
    </body></html>`,
    { url: "https://harness.test/session" },
  );
  return {
    dom,
    window: dom.window,
    flow: dom.window.document.querySelector("[data-chat-flow]")!,
    running: dom.window.document.querySelector("#running") as HTMLElement,
  };
}

async function flushMutations() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("inline thinking status lifecycle", () => {
  it("finds only the final direct chat-flow live status without relying on copy", () => {
    const { window, flow, running } = fixture();
    const later = window.document.createElement("div");
    later.id = "later";
    later.role = "status";
    later.ariaLive = "polite";
    later.textContent = "任意本地化文案";
    flow.append(later);

    expect(findRunningStatus(window.document)).toBe(later);
    later.remove();
    running.textContent = "Localized running state";
    expect(findRunningStatus(window.document)).toBe(running);
  });

  it("publishes anchor replacement without rescanning while the current row is connected", async () => {
    const { window, running } = fixture();
    const snapshots: Array<HTMLElement | null> = [];
    const queryAll = vi.spyOn(window.document, "querySelectorAll");
    const dispose = installThinkingStatus(
      window.document,
      window as unknown as Window,
      (anchor) => snapshots.push(anchor),
    );

    expect(snapshots).toEqual([running]);
    queryAll.mockClear();
    window.document
      .querySelector("#unrelated")
      ?.append(window.document.createElement("span"));
    await flushMutations();
    expect(queryAll).not.toHaveBeenCalled();
    expect(snapshots).toEqual([running]);

    const replacement = window.document.createElement("div");
    replacement.role = "status";
    replacement.ariaLive = "polite";
    running.replaceWith(replacement);
    await flushMutations();
    expect(snapshots.at(-1)).toBe(replacement);

    replacement.remove();
    await flushMutations();
    expect(snapshots.at(-1)).toBeNull();
    dispose();
  });

  it("disconnects idempotently and never republishes after disposal", async () => {
    const { window, flow, running } = fixture();
    const snapshots: Array<HTMLElement | null> = [];
    const dispose = installThinkingStatus(
      window.document,
      window as unknown as Window,
      (anchor) => snapshots.push(anchor),
    );

    expect(snapshots).toEqual([running]);
    dispose();
    dispose();
    const replacement = window.document.createElement("div");
    replacement.role = "status";
    replacement.ariaLive = "polite";
    flow.append(replacement);
    await flushMutations();
    expect(snapshots).toEqual([running, null]);
  });
});
