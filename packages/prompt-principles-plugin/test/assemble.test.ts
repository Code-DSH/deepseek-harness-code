import { describe, expect, it } from "vitest";

import {
  applyTemplate,
  buildSections,
  composeToolPolicyNote,
  isMinimalLike,
  isPromoted,
  resolveEntry,
  resolvePlaceholders,
  shouldParticipate,
} from "../src/assemble.js";
import {
  CORE,
  ENVIRONMENT,
  HEAD_PATCH,
  IDENTITY_TAIL,
  RUNTIME_STATE,
  SEARCH_POLICY,
  SKILLS_POLICY,
  TOOL_POLICY,
} from "../src/content.js";

const MINIMAL_PERSONA = "You are a helpful software engineer assistant.";

const STANDARD_ASSEMBLY = {
  sections: [
    { name: "persona", text: "You are a coding agent…", order: 0 },
    { name: "harness-identity", text: "…", order: 10 },
    { name: "tool-guidance", text: "…", order: 20 },
    { name: "runtime-context", text: "…", order: 30 },
  ],
  contexts: [],
  tools: [{ name: "bash" }, { name: "read" }, { name: "web_search" }],
};

const MINIMAL_ASSEMBLY = {
  sections: [{ name: "persona", text: MINIMAL_PERSONA, order: 0 }],
  contexts: [],
  tools: [{ name: "bash" }, { name: "str_replace_editor" }],
};

const PROMOTED_EVENTS = [{ type: "user/message" }, { type: "tool/call" }];

const UNPROMOTED_EVENTS = [{ type: "user/message" }];

const PROMOTED_CONTEXT = {
  agent: {
    session: { id: "s1", events: PROMOTED_EVENTS, header: { cwd: "/w" } },
  },
};

const UNPROMOTED_CONTEXT = {
  agent: {
    session: { id: "s2", events: UNPROMOTED_EVENTS, header: { cwd: "/w" } },
  },
};

describe("resolveEntry", () => {
  it("fills every default for an empty composition entry", () => {
    const entry = resolveEntry(undefined);
    expect(entry.enabled).toBe(true);
    expect(entry.skipMinimalLike).toBe(true);
    expect(entry.requirePromotion).toBe(true);
    expect(entry.knowledgeCutoff).toBe("2026-07");
    expect(entry.readonlyDirs).toEqual([]);
  });

  it("keeps explicitly provided values and drops invalid ones", () => {
    const entry = resolveEntry({
      enabled: false,
      knowledgeCutoff: "2026-01",
      readonlyDirs: ["/opt/ro", "", 42],
      memoryState: "memories enabled",
    });
    expect(entry.enabled).toBe(false);
    expect(entry.knowledgeCutoff).toBe("2026-01");
    expect(entry.readonlyDirs).toEqual(["/opt/ro"]);
    expect(entry.memoryState).toBe("memories enabled");
  });
});

describe("isMinimalLike", () => {
  it("matches a one-section Minimal persona assembly", () => {
    expect(isMinimalLike(MINIMAL_ASSEMBLY)).toBe(true);
  });

  it("does not match a Standard-family assembly with the same sentence but a full section stack", () => {
    const anchoredLike = {
      ...MINIMAL_ASSEMBLY,
      sections: [
        { name: "persona", text: MINIMAL_PERSONA, order: 0 },
        { name: "plan-mode", text: "…", order: 10 },
        { name: "some-identity", text: "…", order: 20 },
        { name: "tool-guidance", text: "…", order: 30 },
      ],
    };
    expect(isMinimalLike(anchoredLike)).toBe(false);
  });

  it("does not match a Standard persona", () => {
    expect(isMinimalLike(STANDARD_ASSEMBLY)).toBe(false);
  });
});

describe("isPromoted", () => {
  it("is true after a durable tool call or assistant message", () => {
    expect(isPromoted(PROMOTED_CONTEXT.agent)).toBe(true);
    expect(
      isPromoted({
        session: { id: "s", events: [{ type: "assistant/message" }] },
      }),
    ).toBe(true);
  });

  it("is false before any durable signal and for missing sessions", () => {
    expect(isPromoted(UNPROMOTED_CONTEXT.agent)).toBe(false);
    expect(isPromoted(undefined)).toBe(false);
  });
});

describe("shouldParticipate", () => {
  it("participates in a promoted Standard assembly by default", () => {
    expect(
      shouldParticipate(STANDARD_ASSEMBLY, PROMOTED_CONTEXT, resolveEntry({})),
    ).toBe(true);
  });

  it("skips Minimal-shaped assemblies", () => {
    expect(
      shouldParticipate(MINIMAL_ASSEMBLY, PROMOTED_CONTEXT, resolveEntry({})),
    ).toBe(false);
  });

  it("skips un-promoted sessions to protect first-request anchors", () => {
    expect(
      shouldParticipate(
        STANDARD_ASSEMBLY,
        UNPROMOTED_CONTEXT,
        resolveEntry({}),
      ),
    ).toBe(false);
  });

  it("can be configured to ignore both guards", () => {
    const entry = resolveEntry({
      skipMinimalLike: false,
      requirePromotion: false,
    });
    expect(shouldParticipate(MINIMAL_ASSEMBLY, UNPROMOTED_CONTEXT, entry)).toBe(
      true,
    );
  });

  it("never participates when disabled", () => {
    expect(
      shouldParticipate(
        STANDARD_ASSEMBLY,
        PROMOTED_CONTEXT,
        resolveEntry({ enabled: false }),
      ),
    ).toBe(false);
  });
});

describe("resolvePlaceholders + applyTemplate", () => {
  it("resolves every declared key from live context", () => {
    const variables = resolvePlaceholders({
      config: resolveEntry({
        knowledgeCutoff: "2026-03",
        readonlyDirs: ["/a", "/b"],
      }),
      context: PROMOTED_CONTEXT,
      now: () => new Date("2026-08-17T12:00:00.000Z"),
      cwd: () => "/fallback",
    });
    expect(variables.CURRENT_DATE).toBe("2026-08-17");
    expect(variables.KNOWLEDGE_CUTOFF).toBe("2026-03");
    expect(variables.WORKSPACE_DIR).toBe("/w");
    expect(variables.READONLY_DIRS).toBe("/a, /b");
    expect(variables.MODEL_STRING).toBe("the current model");
    expect(variables.MEMORY_STATE).toContain("not enabled");
  });

  it("falls back to cwd for the workspace and reports read-only as governed", () => {
    const variables = resolvePlaceholders({
      config: resolveEntry({}),
      context: { agent: undefined },
      cwd: () => "/fallback",
    });
    expect(variables.WORKSPACE_DIR).toBe("/fallback");
    expect(variables.READONLY_DIRS).toContain("sandbox");
  });

  it("leaves unknown tokens untouched", () => {
    expect(
      applyTemplate("keep {{NOT_A_KEY}}", {
        CURRENT_DATE: "x",
        KNOWLEDGE_CUTOFF: "x",
        MEMORY_STATE: "x",
        MODEL_STRING: "x",
        WORKSPACE_DIR: "x",
        READONLY_DIRS: "x",
      }),
    ).toBe("keep {{NOT_A_KEY}}");
  });
});

describe("composeToolPolicyNote", () => {
  it("derives truthful availability lines from the real catalog", () => {
    const note = composeToolPolicyNote([
      "bash",
      "web_search",
      "web_fetch",
      "skill_search",
      "skill_load",
      "ask_user_question",
      "read",
      "edit",
    ]);
    expect(note).toContain("Web search is available");
    expect(note).toContain("skill_search / skill_load");
    expect(note).toContain("ask-user tool");
    expect(note).toContain("File tools are available");
  });

  it("stays empty when none of the families are present", () => {
    expect(composeToolPolicyNote(["todo_write"])).toBe("");
  });
});

describe("buildSections", () => {
  const sections = buildSections({
    assembled: STANDARD_ASSEMBLY,
    config: resolveEntry({ readonlyDirs: ["/ro"] }),
    context: PROMOTED_CONTEXT,
    now: () => new Date("2026-08-17T00:00:00.000Z"),
    cwd: () => "/fallback",
  });

  it("emits the eight layers in head-body-tail order", () => {
    expect(sections.map((section) => section.name)).toEqual([
      "pp-head-patch",
      "pp-core",
      "pp-runtime-state",
      "pp-tool-policy",
      "pp-skills-policy",
      "pp-environment",
      "pp-search-policy",
      "pp-identity-tail",
    ]);
    const orders = sections.map((section) => section.order);
    for (let index = 1; index < orders.length; index += 1) {
      expect(orders[index] ?? 0).toBeGreaterThan(orders[index - 1] ?? 0);
    }
    expect(orders.at(-1)).toBe(900);
  });

  it("resolves every placeholder in every dynamic section", () => {
    const joined = sections.map((section) => section.text).join("\n");
    expect(joined).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(joined).toContain("2026-08-17");
    expect(joined).toContain("/ro");
    expect(joined).toContain("/w");
  });

  it("carries the ported layer texts", () => {
    const byName = new Map(
      sections.map((section) => [section.name, section.text]),
    );
    /** The static head of a templated text, before the first {{TOKEN}}. */
    const beforeToken = (text: string): string =>
      (text.split("{{")[0] ?? "").trim();
    expect(byName.get("pp-head-patch")).toBe(HEAD_PATCH);
    expect(byName.get("pp-core")).toBe(CORE);
    expect(byName.get("pp-runtime-state")).toContain(
      beforeToken(RUNTIME_STATE),
    );
    expect(byName.get("pp-tool-policy")).toContain(TOOL_POLICY);
    expect(byName.get("pp-skills-policy")).toBe(SKILLS_POLICY);
    expect(byName.get("pp-environment")).toContain(beforeToken(ENVIRONMENT));
    expect(byName.get("pp-search-policy")).toContain(
      beforeToken(SEARCH_POLICY),
    );
    expect(byName.get("pp-identity-tail")).toContain(
      beforeToken(IDENTITY_TAIL),
    );
  });
});
