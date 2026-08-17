import { describe, expect, it } from "vitest";

import {
  CORE,
  ENVIRONMENT,
  HEAD_PATCH,
  IDENTITY_TAIL,
  PLACEHOLDER_KEYS,
  RUNTIME_STATE,
  SEARCH_POLICY,
  SKILLS_POLICY,
  TOOL_POLICY,
} from "../src/content.js";

const STATIC_TEXTS = {
  CORE,
  ENVIRONMENT,
  HEAD_PATCH,
  IDENTITY_TAIL,
  RUNTIME_STATE,
  SEARCH_POLICY,
  SKILLS_POLICY,
  TOOL_POLICY,
} as const;

describe("static layer texts", () => {
  it("use only declared placeholder tokens", () => {
    const declared = new Set<string>(PLACEHOLDER_KEYS);
    for (const [name, text] of Object.entries(STATIC_TEXTS)) {
      const tokens = [...text.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(
        (match) => match[1] ?? "",
      );
      for (const token of tokens) {
        expect(
          declared.has(token),
          `${name} uses undeclared token ${token}`,
        ).toBe(true);
      }
    }
  });

  it("carry the migrated policy decisions", () => {
    // Head patch forbids raw tool-invocation markup (layer 0).
    expect(HEAD_PATCH).toContain("tool-invocation markup");
    // The permissive consumer stance was rewritten, not copied.
    expect(CORE).toContain("within the platform's usage policies");
    expect(CORE).not.toContain("never acts as a moral police");
    // Consumer-only capabilities must not survive the migration.
    const all = Object.values(STATIC_TEXTS).join("\n");
    expect(all).not.toContain("window.storage");
    expect(all).not.toContain("localStorage");
    expect(all).not.toContain("image search");
    expect(all).not.toContain("search_mcp_registry");
    expect(all).not.toContain("/mnt/user-data");
    expect(all).not.toContain("present_files");
    // Identity is re-targeted at DeepSeek (layer 9).
    expect(IDENTITY_TAIL).toContain("DeepSeek");
    expect(IDENTITY_TAIL).not.toContain("Codex");
    expect(IDENTITY_TAIL).not.toContain("OpenAI");
  });
});
