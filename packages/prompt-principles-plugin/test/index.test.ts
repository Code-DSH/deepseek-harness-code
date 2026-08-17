import { describe, expect, it } from "vitest";

import {
  apply,
  Config,
  SETTINGS_NAMESPACE,
  name,
  type PromptPrinciplesContext,
} from "../src/index.js";
import {
  resolveEntry,
  type AssembledPrompt,
  type AssemblyContext,
} from "../src/assemble.js";

const MINIMAL_PERSONA = "You are a helpful software engineer assistant.";

interface RecordedAssembly {
  sections: Array<{ name: string; text: string; order: number }>;
  contexts: unknown[];
  tools: Array<{ name: string }>;
}

const STANDARD_ASSEMBLY: RecordedAssembly = {
  sections: [
    { name: "persona", text: "You are a coding agent…", order: 0 },
    { name: "harness-identity", text: "…", order: 10 },
    { name: "tool-guidance", text: "…", order: 20 },
    { name: "runtime-context", text: "…", order: 30 },
  ],
  contexts: [],
  tools: [{ name: "bash" }, { name: "web_search" }],
};

const MINIMAL_ASSEMBLY: RecordedAssembly = {
  sections: [{ name: "persona", text: MINIMAL_PERSONA, order: 0 }],
  contexts: [],
  tools: [{ name: "bash" }, { name: "str_replace_editor" }],
};

const PROMOTED = {
  agent: {
    session: {
      id: "s1",
      events: [{ type: "user/message" }, { type: "tool/call" }],
      header: { cwd: "/w" },
    },
    options: { model: "deepseek-chat" },
  },
};

const UNPROMOTED = {
  agent: {
    session: { id: "s2", events: [{ type: "user/message" }] },
  },
};

interface FakeSettingsService {
  registered: { ns: string; base: unknown }[];
  resolved: Record<string, unknown>;
  register(
    ns: string,
    _schema: unknown,
    options?: { base?: unknown },
  ): {
    get(): unknown;
  };
}

function fakeSettings(): FakeSettingsService {
  const service: FakeSettingsService = {
    registered: [],
    resolved: {},
    register(ns, _schema, options) {
      service.registered.push({ ns, base: options?.base });
      return {
        get: () => service.resolved[ns] ?? options?.base ?? {},
      };
    },
  };
  return service;
}

interface FakeContextOptions {
  settings?: FakeSettingsService;
  config?: unknown;
}

function mountPlugin(options: FakeContextOptions) {
  const warnings: string[] = [];
  const ctx: PromptPrinciplesContext = {
    on: (_event, registered) => {
      handler = registered;
    },
    inject: (deps, callback) => {
      if (deps.includes("settings") && options.settings !== undefined) {
        callback({ settings: options.settings });
      }
    },
    logger: {
      warn(message: string) {
        warnings.push(message);
      },
    },
  };
  let handler: Parameters<PromptPrinciplesContext["on"]>[1] | undefined;
  apply(ctx, options.config);
  if (handler === undefined)
    throw new Error("plugin did not register the assembly hook");
  const registered = handler;
  const run = (assembly: unknown, context: unknown) =>
    registered(
      assembly as AssembledPrompt,
      context as AssemblyContext,
      async () => assembly as AssembledPrompt,
    );
  return { run, ctx, warnings };
}

describe("plugin mount", () => {
  it("exposes the official plugin surface", () => {
    expect(name).toBe("dsh-prompt-principles");
    expect(SETTINGS_NAMESPACE).toBe("prompt-principles");
    // A schemastery schema resolves to a callable constructor.
    expect(["object", "function"]).toContain(typeof Config);
  });

  it("appends its sections to a promoted Standard assembly", async () => {
    const { run } = mountPlugin({});
    const result = (await run(STANDARD_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(result.sections.length).toBe(STANDARD_ASSEMBLY.sections.length + 8);
    const names = result.sections.map((section) => section.name);
    expect(names).toContain("pp-core");
    expect(names).toContain("pp-identity-tail");
    // Existing sections keep their position; ours append after them.
    expect(result.sections[0]?.name).toBe("persona");
    // The dynamic tool note reflects the real catalog.
    const toolPolicy = result.sections.find(
      (section) => section.name === "pp-tool-policy",
    );
    expect(toolPolicy?.text).toContain("Web search is available");
    // The identity tail carries the live model string.
    const identity = result.sections.find(
      (section) => section.name === "pp-identity-tail",
    );
    expect(identity?.text).toContain("deepseek-chat");
  });

  it("leaves Minimal-shaped and un-promoted assemblies untouched", async () => {
    const { run } = mountPlugin({});
    const minimal = (await run(MINIMAL_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(minimal.sections.length).toBe(1);
    const early = (await run(
      STANDARD_ASSEMBLY,
      UNPROMOTED,
    )) as RecordedAssembly;
    expect(early.sections.length).toBe(STANDARD_ASSEMBLY.sections.length);
  });

  it("honors the composition entry as the pre-settings fallback", async () => {
    const { run } = mountPlugin({ config: { enabled: false } });
    const result = (await run(STANDARD_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(result.sections.length).toBe(STANDARD_ASSEMBLY.sections.length);
  });

  it("registers the settings namespace with the entry as base and follows the resolved value", async () => {
    const settings = fakeSettings();
    const { run } = mountPlugin({ settings });
    expect(settings.registered).toHaveLength(1);
    expect(settings.registered[0]?.ns).toBe(SETTINGS_NAMESPACE);
    expect(resolveEntry(settings.registered[0]?.base).enabled).toBe(true);

    settings.resolved[SETTINGS_NAMESPACE] = { enabled: false };
    const off = (await run(STANDARD_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(off.sections.length).toBe(STANDARD_ASSEMBLY.sections.length);

    settings.resolved[SETTINGS_NAMESPACE] = { enabled: true };
    const on = (await run(STANDARD_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(on.sections.length).toBe(STANDARD_ASSEMBLY.sections.length + 8);
  });

  it("degrades to the untouched assembly when its own logic throws", async () => {
    const settings = fakeSettings();
    Object.defineProperty(settings.resolved, SETTINGS_NAMESPACE, {
      get() {
        throw new Error("boom");
      },
    });
    const { run, warnings } = mountPlugin({ settings });
    const result = (await run(STANDARD_ASSEMBLY, PROMOTED)) as RecordedAssembly;
    expect(result).toBe(STANDARD_ASSEMBLY);
    expect(warnings.length).toBe(1);
  });
});
