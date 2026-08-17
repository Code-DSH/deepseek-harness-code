import z from '@deepseek-ai/schemastery';

/**
 * Pure assembly logic for the prompt-principles plugin.
 *
 * Everything in this module is a pure function over plain data so the unit
 * tests can drive the guards, ordering, placeholder resolution, and dynamic
 * tool-note composition without a live Harness.
 */

/** The subset of the assembled system prompt this plugin reads. */
interface AssembledPrompt {
    sections?: unknown;
    contexts?: unknown;
    tools?: unknown;
}
interface AssemblyContext {
    agent?: unknown;
}

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

/** Cordis plugin name used by loader diagnostics. */
declare const name = "dsh-prompt-principles";
/** The system-prompt assembly service must exist before we can hook it. */
declare const inject: string[];
/** The settings namespace this plugin owns (lowercase kebab-case, as required). */
declare const SETTINGS_NAMESPACE = "prompt-principles";
/** Composition + settings schema; the schema default is what makes the
 *  feature ON before the user ever touches it. */
declare const Config: z<Schemastery.ObjectS<{
    enabled: z<boolean, boolean>;
    knowledgeCutoff: z<string, string>;
    memoryState: z<string, string>;
    readonlyDirs: z<string[], string[]>;
    skipMinimalLike: z<boolean, boolean>;
    requirePromotion: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
    enabled: z<boolean, boolean>;
    knowledgeCutoff: z<string, string>;
    memoryState: z<string, string>;
    readonlyDirs: z<string[], string[]>;
    skipMinimalLike: z<boolean, boolean>;
    requirePromotion: z<boolean, boolean>;
}>>;
/**
 * Structural typing for the cordis context: the plugin deliberately avoids a
 * compile-time cordis dependency (mirroring the desktop plugin), so only the
 * members actually touched are declared.
 */
interface PromptPrinciplesContext {
    on(event: "system-prompt/assemble", handler: Plugin): void;
    inject(deps: readonly string[], callback: (scope: unknown) => void): void;
    logger?: {
        warn(message: string): void;
    };
}
type Plugin = (assembly: AssembledPrompt, context: AssemblyContext, next: () => Promise<AssembledPrompt>) => Promise<AssembledPrompt>;
/**
 * Mount the plugin: optional settings registration plus the assembly hook.
 *
 * Robustness contract (matching the repo's other prompt plugins): a failure
 * inside this plugin's own logic must never change the request — the hook
 * degrades to returning the upstream assembly untouched.
 */
declare function apply(ctx: PromptPrinciplesContext, config?: unknown): void;

export { Config, type PromptPrinciplesContext, SETTINGS_NAMESPACE, apply, inject, name };
