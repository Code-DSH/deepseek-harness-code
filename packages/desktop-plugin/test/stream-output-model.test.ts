import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  STREAMING_ASSISTANT_SELECTOR,
  eligibleTextNodes,
  findAppendedGraphemes,
  isEligibleStreamTextNode,
} from "../src/stream-output-model.js";

describe("stream output model", () => {
  it("returns UTF-16 grapheme ranges only for a strict appended suffix", () => {
    expect(findAppendedGraphemes("思考", "思考中🙂")).toEqual([
      { text: "中", start: 2, end: 3, order: 0 },
      { text: "🙂", start: 3, end: 5, order: 1 },
    ]);
    expect(findAppendedGraphemes("answer", "changed")).toBeNull();
    expect(findAppendedGraphemes("long", "lo")).toBeNull();
    expect(findAppendedGraphemes("same", "same")).toEqual([]);
  });

  it("treats a leading combining mark as a rewrite instead of an append", () => {
    expect(findAppendedGraphemes("e", "e\u0301")).toBeNull();
    expect(findAppendedGraphemes("", "\u0301")).toBeNull();
  });

  it("rejects appends that extend the preceding emoji grapheme", () => {
    expect(findAppendedGraphemes("👋", "👋🏽")).toBeNull();
    expect(findAppendedGraphemes("👩", "👩‍💻")).toBeNull();
  });

  it("accepts only prose and reasoning text in a streaming assistant row", () => {
    const dom = new JSDOM(`<!doctype html><body>
      <div data-chat-flow-kind="assistant-step">
        <div data-streaming>
          <p id="prose">回答<a id="link" href="#details">链接</a><code id="inline">const x = 1</code></p>
          <div data-variant="think"><span id="reasoning">思考内容</span><button>Think</button></div>
          <pre><code>terminal output</code></pre>
          <div data-tool-call>tool result</div>
          <div data-terminal>shell result</div>
          <span aria-hidden="true">visual clone</span>
          <span role="status">status label</span>
        </div>
      </div>
      <div data-chat-flow-kind="assistant-step"><div><p>history</p></div></div>
      <div data-chat-flow-kind="user"><div data-streaming><p>user text</p></div></div>
    </body>`);
    const document = dom.window.document;
    const streaming = document.querySelector(STREAMING_ASSISTANT_SELECTOR);
    if (!streaming) throw new Error("streaming fixture missing");

    const text = eligibleTextNodes(streaming).map((node) => node.data.trim());

    expect(text).toEqual(["回答", "链接", "思考内容"]);
    expect(
      isEligibleStreamTextNode(
        document.querySelector("#reasoning")?.firstChild ?? null,
      ),
    ).toBe(true);
    expect(
      isEligibleStreamTextNode(
        document.querySelector("#inline")?.firstChild ?? null,
      ),
    ).toBe(false);
  });
});
