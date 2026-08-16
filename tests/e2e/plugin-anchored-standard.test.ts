import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = join(process.cwd(), "packages", "anchored-standard-plugin");
const bootstrapEntry = join(packageRoot, "preset", "tool-bootstrap.mjs");

type Listener = (...args: any[]) => Promise<any> | any;

async function registerBootstrap() {
  expect(existsSync(bootstrapEntry)).toBe(true);
  if (!existsSync(bootstrapEntry)) {
    throw new Error(
      `Anchored Standard bootstrap is missing: ${bootstrapEntry}`,
    );
  }
  const plugin = (await import(pathToFileURL(bootstrapEntry).href)) as {
    apply(ctx: unknown, config: unknown): void;
  };
  const listeners: Record<string, Listener> = {};
  plugin.apply(
    {
      on(event: string, listener: Listener) {
        listeners[event] = listener;
      },
      logger: { warn() {} },
    },
    {
      bootstrapTools: ["bash", "str_replace_editor"],
      promoteOn: "either",
      suppressedContextSources: ["agent-instructions", "skill-catalog"],
      compactionTools: [
        "read",
        "write",
        "edit",
        "glob",
        "grep",
        "todo_write",
        "ask_user_question",
      ],
    },
  );
  return listeners;
}

function listenerOf(
  listeners: Readonly<Record<string, Listener>>,
  event: string,
): Listener {
  const listener = listeners[event];
  if (listener === undefined) {
    throw new Error(`Anchored Standard did not register ${event}`);
  }
  return listener;
}

function agent(
  events: readonly unknown[],
  id: string,
  header: Record<string, unknown> = {},
) {
  return { session: { id, events, header } };
}

async function assemble(
  listener: Listener,
  events: readonly unknown[],
  tools: readonly { name: string }[],
  id: string,
  header?: Record<string, unknown>,
) {
  return listener(
    undefined,
    { agent: agent(events, id, header) },
    async () => ({
      system: "minimal persona",
      tools,
    }),
  );
}

const fullCatalog = [
  { name: "bash" },
  { name: "str_replace_editor" },
  { name: "dev_tool_search" },
  { name: "skill_search" },
  { name: "skill_load" },
  { name: "read" },
  { name: "write" },
  { name: "edit" },
  { name: "glob" },
  { name: "grep" },
  { name: "todo_write" },
  { name: "ask_user_question" },
  { name: "web_search" },
  { name: "subagent" },
];

describe("Anchored Standard progressive agent preset", () => {
  it("exposes exactly the official Minimal pair on a fresh top-level session", async () => {
    const listeners = await registerBootstrap();

    const result = await assemble(
      listenerOf(listeners, "system-prompt/assemble"),
      [],
      fullCatalog,
      "fresh",
    );

    expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "bash",
      "str_replace_editor",
    ]);
  });

  it("promotes after either durable signal and restores automatic context", async () => {
    const listeners = await registerBootstrap();
    const assembleListener = listenerOf(listeners, "system-prompt/assemble");
    const preStepListener = listenerOf(listeners, "agent/pre-step");

    for (const [id, event] of [
      ["tool-promotion", { type: "tool/call", seq: 1, data: { name: "bash" } }],
      ["reply-promotion", { type: "assistant/message", seq: 1, data: {} }],
    ] as const) {
      const result = await assemble(assembleListener, [event], fullCatalog, id);
      expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "bash",
        "str_replace_editor",
        "dev_tool_search",
        "skill_search",
        "skill_load",
      ]);
    }

    const messages = [
      { id: "user", source: { kind: "user" } },
      { id: "instructions", source: { kind: "agent-instructions" } },
      { id: "skills", source: { kind: "skill-catalog" } },
    ];
    const stripped = await preStepListener(
      { agent: agent([], "context-fresh") },
      async () => ({ kind: "enter", messages }),
    );
    expect(
      stripped.messages.map((message: { id: string }) => message.id),
    ).toEqual(["user"]);
    const restored = await preStepListener(
      {
        agent: agent(
          [{ type: "assistant/message", seq: 1, data: {} }],
          "context-promoted",
        ),
      },
      async () => ({ kind: "enter", messages }),
    );
    expect(restored.messages).toBe(messages);
  });

  it("restores explicit unlocks from durable events without dumping the full catalog", async () => {
    const listeners = await registerBootstrap();
    const events = [
      { type: "assistant/message", seq: 1, data: {} },
      {
        type: "tool/call",
        seq: 2,
        data: {
          name: "dev_tool_search",
          arguments: JSON.stringify({ toolNames: ["web_search"] }),
        },
      },
    ];

    const result = await assemble(
      listenerOf(listeners, "system-prompt/assemble"),
      events,
      fullCatalog,
      "resume",
    );

    expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "bash",
      "str_replace_editor",
      "dev_tool_search",
      "skill_search",
      "skill_load",
      "web_search",
    ]);
    expect(result.tools).not.toContainEqual({ name: "subagent" });
  });

  it("uses the controlled compaction set and starts subagents resident", async () => {
    const listeners = await registerBootstrap();
    const assembleListener = listenerOf(listeners, "system-prompt/assemble");
    const compacted = await assemble(
      assembleListener,
      [
        { type: "assistant/message", seq: 1, data: {} },
        { type: "compaction/end", seq: 2, data: {} },
      ],
      fullCatalog,
      "compacted",
    );
    expect(compacted.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "bash",
      "str_replace_editor",
      "read",
      "write",
      "edit",
      "glob",
      "grep",
      "todo_write",
      "ask_user_question",
    ]);

    const delegated = await assemble(
      assembleListener,
      [],
      fullCatalog,
      "delegated",
      { delegationDepth: 1 },
    );
    expect(delegated.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "bash",
      "str_replace_editor",
      "dev_tool_search",
      "skill_search",
      "skill_load",
    ]);
  });

  it("rejects assembly when a required phase tool is missing", async () => {
    const listeners = await registerBootstrap();

    await expect(
      assemble(
        listenerOf(listeners, "system-prompt/assemble"),
        [],
        [{ name: "bash" }, { name: "read" }],
        "missing-tool",
      ),
    ).rejects.toThrow(/missing.*str_replace_editor/i);
  });

  it("rejects a promoted request when a resident discovery tool is missing", async () => {
    const listeners = await registerBootstrap();

    await expect(
      assemble(
        listenerOf(listeners, "system-prompt/assemble"),
        [{ type: "assistant/message", seq: 1, data: {} }],
        fullCatalog.filter((tool) => tool.name !== "skill_load"),
        "missing-resident-tool",
      ),
    ).rejects.toThrow(/missing.*skill_load/i);
  });
});
