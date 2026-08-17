/**
 * dsh-prompt-principles — host half.
 *
 * An official-format Harness plugin that appends a layered set of behavioral
 * prompt sections to the assembled system prompt of Standard-like sessions.
 *
 * Design in one paragraph: the plugin owns one settings namespace
 * (`prompt-principles`, schema `Config`, default ON) so the official Web UI
 * can toggle it through the settings wire; every model request passes the
 * `system-prompt/assemble` waterfall, where the plugin first lets the rest of
 * the composition assemble, then — only when enabled, not Minimal-shaped, and
 * past the session's first durable promotion signal — appends its ordered
 * sections (head patch, behavioral core, runtime state, tool policy, skills
 * policy, environment, search policy, tail identity). Minimal-exact sessions
 * (the `minimal` preset, the anchored bootstrap, a router's first turn) keep
 * their trajectory shape untouched.
 */

import z from "@deepseek-ai/schemastery";

import {
  buildSections,
  resolveEntry,
  shouldParticipate,
  type AssembledPrompt,
  type AssemblyContext,
  type PromptPrinciplesConfig,
} from "./assemble.js";

/** Cordis plugin name used by loader diagnostics. */
export const name = "dsh-prompt-principles";

/** The system-prompt assembly service must exist before we can hook it. */
export const inject = ["systemPrompt"];

/** The settings namespace this plugin owns (lowercase kebab-case, as required). */
export const SETTINGS_NAMESPACE = "prompt-principles";

/** Composition + settings schema; the schema default is what makes the
 *  feature ON before the user ever touches it. */
export const Config = z.object({
  enabled: z.boolean().default(true),
  knowledgeCutoff: z.string().default("2026-07"),
  memoryState: z
    .string()
    .default(
      "memory is not enabled in this environment, so no cross-session memories are available",
    ),
  readonlyDirs: z.array(z.string()).default([]),
  skipMinimalLike: z.boolean().default(true),
  requirePromotion: z.boolean().default(true),
});

/** Owner handle returned by `settings.register`. */
interface SettingsScope {
  get(): unknown;
}

/** The subset of the settings service this plugin uses. */
interface SettingsService {
  register(
    ns: string,
    schema: unknown,
    options?: { base?: unknown },
  ): SettingsScope;
}

/**
 * Structural typing for the cordis context: the plugin deliberately avoids a
 * compile-time cordis dependency (mirroring the desktop plugin), so only the
 * members actually touched are declared.
 */
export interface PromptPrinciplesContext {
  on(event: "system-prompt/assemble", handler: Plugin): void;
  inject(deps: readonly string[], callback: (scope: unknown) => void): void;
  logger?: { warn(message: string): void };
}

type Plugin = (
  assembly: AssembledPrompt,
  context: AssemblyContext,
  next: () => Promise<AssembledPrompt>,
) => Promise<AssembledPrompt>;

/**
 * Mount the plugin: optional settings registration plus the assembly hook.
 *
 * Robustness contract (matching the repo's other prompt plugins): a failure
 * inside this plugin's own logic must never change the request — the hook
 * degrades to returning the upstream assembly untouched.
 */
export function apply(ctx: PromptPrinciplesContext, config?: unknown): void {
  const entry: PromptPrinciplesConfig = resolveEntry(config);

  /** Authoritative config source; the composition entry until the settings
   *  namespace attaches, the resolved scope afterwards. */
  let readCurrent: () => PromptPrinciplesConfig = () => entry;

  // Optional settings integration: with a settings service mounted, the
  // namespace resolves schema defaults -> composition `base` -> user section,
  // which is exactly the layering the official Settings UI writes into.
  try {
    ctx.inject(["settings"], (scope) => {
      const settings = (scope as { settings?: SettingsService } | undefined)
        ?.settings;
      if (settings === undefined) return;
      const handle = settings.register(SETTINGS_NAMESPACE, Config, {
        base: entry,
      });
      readCurrent = () => resolveEntry(handle.get());
    });
  } catch {
    // No settings service on this host: keep the composition entry alone.
  }

  ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
    // Downstream errors propagate untouched; only this plugin's own logic
    // is guarded below.
    const assembled = await next();
    try {
      const current = readCurrent();
      if (!shouldParticipate(assembled, context ?? {}, current)) {
        return assembled;
      }
      const sections = buildSections({
        assembled,
        context: context ?? {},
        config: current,
      });
      const existing = Array.isArray(assembled.sections)
        ? assembled.sections
        : [];
      return { ...assembled, sections: [...existing, ...sections] };
    } catch (error) {
      try {
        ctx.logger?.warn(
          `${name}: section assembly failed; leaving the system prompt untouched`,
        );
      } catch {
        // Logger unavailable — the guard exists only to avoid throwing twice.
      }
      void error;
      return assembled;
    }
  });
}
