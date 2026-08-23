import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";

type ModuleRegistration = {
  factory(require: (id: string) => unknown): Record<string, any>;
};

type ConversationDefinition = {
  kind: string;
  target?: string;
  match(event: EventValue): { id: string; role: "start" | "update" } | null;
  start(context: ContextValue, match: MatchValue, reader: unknown): unknown;
  update(context: ContextValue, match: MatchValue): unknown;
  publication?(match: MatchValue): "none" | "animation-frame" | "immediate";
  buildLocationData?(context: ContextValue, scope: "step" | "turn"): any;
  buildViewNode?(context: ContextValue): any;
};

type EventValue = {
  type: string;
  seq: number;
  time: number;
  data: Record<string, any>;
  surfaceOp?: "append";
  sourceEventSeqs?: number[];
};

type MatchValue = {
  event: EventValue;
  view: undefined;
  role: "start" | "update";
  location: any;
};

type ContextValue = {
  key: string;
  kind: string;
  id: string;
  matches: readonly MatchValue[];
  start: MatchValue | undefined;
  state: any;
  current: ReadonlyMap<string, any>;
};

type RuntimeExports = {
  ConversationNodeAssembler: new (
    events: {
      entries(): readonly ConversationDefinition[];
      fallbackEntry(): ConversationDefinition | undefined;
    },
    views: { entries(): readonly any[] },
  ) => {
    append(input: { event: EventValue; view: undefined }): string;
    replaceWindow(
      inputs: readonly { event: EventValue; view: undefined }[],
      hasMore: boolean,
    ): string;
    flush(): boolean;
    get(target: string): { nodes: ReadonlyMap<string, any> } | undefined;
  };
};

const harnessRoot = join(process.cwd(), "deps", "deepseek-harness");
const conversationRoot = join(
  harnessRoot,
  "packages",
  "client",
  "ui-conversation",
);
const runtimeRoot = join(harnessRoot, "packages", "client", "runtime");
const conversationClient = join(conversationRoot, "lib", "client.js");
const runtimeClient = join(runtimeRoot, "lib", "client.js");

let runtime: RuntimeExports;
let assistantDefinition: ConversationDefinition;
let turnTailDefinition: ConversationDefinition;

function loadRegistration(path: string): ModuleRegistration {
  let registration: ModuleRegistration | undefined;
  const window = {
    __ModuleLoader__: {
      load(value: ModuleRegistration) {
        registration = value;
      },
    },
  };
  const ctx = vm.createContext({
    console,
    queueMicrotask,
    window,
  });
  new vm.Script(readFileSync(path, "utf8")).runInContext(ctx);
  if (registration === undefined) {
    throw new Error(`Harness client bundle did not register: ${path}`);
  }
  return registration;
}

function inertModule(): any {
  const noop = () => undefined;
  return new Proxy(noop, {
    construct: () => ({}),
    get: () => noop,
  });
}

function loadRuntime(): RuntimeExports {
  const noop = () => undefined;
  const fallback = inertModule();
  return loadRegistration(runtimeClient).factory((id) => {
    if (id === "@deepseek-ai/cordis") return { Service: class {} };
    if (id === "react") return new Proxy({}, { get: () => noop });
    if (id === "immer") {
      return {
        produce(state: unknown, mutate: (draft: unknown) => void) {
          mutate(state);
          return state;
        },
      };
    }
    if (id === "zustand/vanilla") return { createStore: noop };
    if (id === "@deepseek-ai/dsh-session/surface") {
      return {
        isAppendSurfaceEvent(event: EventValue) {
          return (
            ["user/message", "assistant/message", "tool/result"].includes(
              event.type,
            ) && event.surfaceOp === "append"
          );
        },
        isReplacementSurfaceEvent(event: EventValue) {
          return (
            ["user/message", "assistant/message", "tool/result"].includes(
              event.type,
            ) &&
            event.surfaceOp !== undefined &&
            event.surfaceOp !== "append"
          );
        },
      };
    }
    return fallback;
  }) as unknown as RuntimeExports;
}

function captureConversationDefinitions(
  runtimeExports: RuntimeExports,
): ConversationDefinition[] {
  const noop = () => undefined;
  const fallback = inertModule();
  const react = new Proxy(
    { Fragment: Symbol("Fragment"), memo: <T>(value: T) => value },
    { get: (target, key) => Reflect.get(target, key) ?? noop },
  );
  const client = loadRegistration(conversationClient).factory((id) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx: noop, jsxs: noop };
    if (id === "@deepseek-ai/dsh-client-runtime/client") return runtimeExports;
    if (id === "@deepseek-ai/cordis") return { Service: class {} };
    return fallback;
  });

  const definitions: ConversationDefinition[] = [];
  const captured = Symbol("captured turn-tail");
  try {
    client.apply({
      sessions: {},
      workspaces: {},
      layout: {},
      slots: {},
      conversationEvents: {
        register(definition: ConversationDefinition) {
          definitions.push(definition);
          if (definition.kind === "turn-tail") throw captured;
        },
      },
      conversationViews: { register: noop },
      effect: noop,
      locale: {},
    });
  } catch (error) {
    if (error !== captured) throw error;
  }
  return definitions;
}

function event(
  type: string,
  seq: number,
  data: Record<string, any>,
  surface = false,
): EventValue {
  return {
    type,
    seq,
    time: 1_000 + seq,
    data,
    ...(surface
      ? { surfaceOp: "append" as const, sourceEventSeqs: [seq - 1] }
      : {}),
  };
}

function simpleLocation(turn = 0, step = 0): any {
  const stepValue = {
    turn,
    step,
    start: undefined,
    end: undefined,
    status: "open",
    data: { get: () => undefined },
  };
  const turnValue = {
    turn,
    start: undefined,
    end: undefined,
    status: "open",
    steps: [stepValue],
    data: { get: () => undefined },
  };
  return { kind: "step", turn: turnValue, step: stepValue };
}

function match(
  value: EventValue,
  role: "start" | "update",
  location = simpleLocation(),
): MatchValue {
  return { event: value, view: undefined, role, location };
}

function context(
  kind: string,
  matches: readonly MatchValue[],
  state: unknown,
): ContextValue {
  return {
    key: `${kind}:0`,
    kind,
    id: "0",
    matches,
    start: matches[0],
    state,
    current: new Map(),
  };
}

function createChatBuilder() {
  let nodes = new Map<string, any>();
  return {
    empty: { nodes },
    replace(input: { nodes: readonly any[] }) {
      nodes = new Map(input.nodes.map((node) => [node.key, node]));
      return { nodes };
    },
    apply(input: { upserts: readonly any[] }) {
      nodes = new Map(nodes);
      for (const node of input.upserts) nodes.set(node.key, node);
      return { nodes };
    },
  };
}

function createAssembler() {
  return new runtime.ConversationNodeAssembler(
    {
      entries: () => [assistantDefinition, turnTailDefinition],
      fallbackEntry: () => undefined,
    },
    {
      entries: () => [{ target: "chat", create: createChatBuilder }],
    },
  );
}

function assistantData(assembler: ReturnType<typeof createAssembler>): any {
  const snapshot = assembler.get("chat");
  return [...(snapshot?.nodes.values() ?? [])].find(
    (node) => node.kind === "assistant-step",
  )?.data;
}

beforeAll(() => {
  const conversationManifest = JSON.parse(
    readFileSync(join(conversationRoot, "package.json"), "utf8"),
  ) as { version: string };
  expect(conversationManifest.version).toBe("0.1.1-rc.2.code.1");

  runtime = loadRuntime();
  const definitions = captureConversationDefinitions(runtime);
  const assistant = definitions.find(
    (definition) => definition.kind === "assistant-step",
  );
  const turnTail = definitions.find(
    (definition) => definition.kind === "turn-tail",
  );
  if (assistant === undefined || turnTail === undefined) {
    throw new Error("maintained conversation definitions were not captured");
  }
  assistantDefinition = assistant;
  turnTailDefinition = turnTail;
});

describe("maintained Harness Web stream projection", () => {
  it("publishes reasoning, the final answer token, and structural completion synchronously", () => {
    const assembler = createAssembler();
    const inputs = [
      event("turn/start", 1, { turn: 0 }),
      event("step/start", 2, { turn: 0, step: 0 }),
      event("assistant/chunk", 3, {
        turn: 0,
        step: 0,
        chunk: { type: "reasoning-delta", index: 0, text: "reasoning-exact" },
      }),
      event("assistant/chunk", 4, {
        turn: 0,
        step: 0,
        chunk: { type: "text-delta", index: 1, text: "answer-final-token" },
      }),
      event(
        "assistant/message",
        5,
        {
          turn: 0,
          step: 0,
          message: {
            id: "assistant-0",
            role: "assistant",
            source: { kind: "model", provider: "test", model: "test" },
            content: [
              { type: "reasoning", text: "reasoning-exact" },
              { type: "text", text: "answer-final-token" },
            ],
          },
        },
        true,
      ),
      event("step/end", 6, { turn: 0, step: 0 }),
      event("tool/call", 7, {
        turn: 0,
        step: 0,
        callId: "call-0",
        name: "test",
        arguments: "{}",
      }),
      event("turn/end", 8, { turn: 0, reason: { kind: "stop" } }),
    ];

    const publications: string[] = [];
    for (const value of inputs) {
      publications.push(assembler.append({ event: value, view: undefined }));
      assembler.flush();
    }

    expect(assistantData(assembler)).toMatchObject({
      status: "settled",
      blocks: [
        { kind: "reasoning", text: "reasoning-exact" },
        { kind: "text", text: "answer-final-token" },
      ],
    });
    expect(publications[4]).toBe("immediate");
    expect(publications.at(-1)).toBe("immediate");
    const tail = [...(assembler.get("chat")?.nodes.values() ?? [])].find(
      (node) => node.kind === "turn-tail",
    )?.data;
    expect(tail.closing.blocks.at(-1).text).toBe("answer-final-token");
    expect(tail.branchUnavailable).toBe(true);
  });

  it("rebuilds exact hydration/reconnect snapshots and isolates interleaved sessions", () => {
    const sessionEvents = (text: string, reasoning: string) => [
      event("turn/start", 1, { turn: 0 }),
      event("step/start", 2, { turn: 0, step: 0 }),
      event("assistant/chunk", 3, {
        turn: 0,
        step: 0,
        chunk: { type: "reasoning-delta", index: 0, text: reasoning },
      }),
      event("assistant/chunk", 4, {
        turn: 0,
        step: 0,
        chunk: { type: "text-delta", index: 1, text },
      }),
    ];
    const a = createAssembler();
    const b = createAssembler();
    const aEvents = sessionEvents("session-a-final", "reason-a");
    const bEvents = sessionEvents("session-b-final", "reason-b");
    for (let index = 0; index < aEvents.length; index += 1) {
      a.append({ event: aEvents[index]!, view: undefined });
      b.append({ event: bEvents[index]!, view: undefined });
      a.flush();
      b.flush();
    }
    expect(assistantData(a).blocks).toEqual([
      { kind: "reasoning", text: "reason-a" },
      { kind: "text", text: "session-a-final" },
    ]);
    expect(assistantData(b).blocks).toEqual([
      { kind: "reasoning", text: "reason-b" },
      { kind: "text", text: "session-b-final" },
    ]);

    const hydration = createAssembler();
    expect(
      hydration.replaceWindow(
        aEvents.map((value) => ({ event: value, view: undefined })),
        false,
      ),
    ).toBe("immediate");
    hydration.flush();
    const reconnect = createAssembler();
    expect(
      reconnect.replaceWindow(
        aEvents.map((value) => ({ event: value, view: undefined })),
        false,
      ),
    ).toBe("immediate");
    reconnect.flush();
    expect(assistantData(reconnect).blocks).toEqual(
      assistantData(hydration).blocks,
    );
  });

  it("fails open to the official match scan when rc.7 state is unexpectedly absent", () => {
    const location = simpleLocation();
    const end = match(
      event("turn/end", 2, { turn: 0, reason: { kind: "error" } }),
      "update",
      { kind: "turn", turn: location.turn },
    );
    const matches = [
      match(event("turn/start", 1, { turn: 0 }), "start", {
        kind: "turn",
        turn: location.turn,
      }),
      end,
    ];
    const projected = turnTailDefinition.buildLocationData?.(
      context("turn-tail", matches, undefined),
      "turn",
    );
    expect(projected).toMatchObject({
      kind: "turn",
      turn: 0,
      key: "turn-tail",
      value: { turn: 0, seq: 2, closing: null },
    });
    expect(turnTailDefinition.publication?.(end)).toBe("immediate");
  });
});
