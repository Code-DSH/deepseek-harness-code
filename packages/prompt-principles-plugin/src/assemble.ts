/**
 * Pure assembly logic for the prompt-principles plugin.
 *
 * Everything in this module is a pure function over plain data so the unit
 * tests can drive the guards, ordering, placeholder resolution, and dynamic
 * tool-note composition without a live Harness.
 */

import {
  CORE,
  ENVIRONMENT,
  HEAD_PATCH,
  IDENTITY_TAIL,
  ORDER_BODY,
  ORDER_HEAD,
  ORDER_TAIL,
  RUNTIME_STATE,
  SEARCH_POLICY,
  SKILLS_POLICY,
  TOOL_POLICY,
  type PlaceholderKey,
} from "./content.js";

/** The canonical one-sentence persona shared by Minimal and every
 *  Minimal-shaped bootstrap (anchored, router first turn). */
const MINIMAL_PERSONA_SENTENCE =
  "You are a helpful software engineer assistant.";

/** A Minimal-shaped assembly carries only a handful of sections because the
 *  persona is `complete` and suppresses identity/tool-guidance/runtime
 *  context; a Standard-family assembly is much larger. */
const MINIMAL_LIKE_MAX_SECTIONS = 3;

/** Shape of one system-prompt section as the runtime assembles it. */
export interface AssemblySection {
  name?: unknown;
  text?: unknown;
  order?: unknown;
}

/** The subset of the assembled system prompt this plugin reads. */
export interface AssembledPrompt {
  sections?: unknown;
  contexts?: unknown;
  tools?: unknown;
}

/** The subset of the assembly context this plugin reads. */
export interface AssemblyAgent {
  session?: unknown;
  options?: unknown;
}

export interface AssemblyContext {
  agent?: unknown;
}

/** Plugin configuration, resolved from the composition entry. */
export interface PromptPrinciplesConfig {
  enabled: boolean;
  knowledgeCutoff: string;
  memoryState: string;
  readonlyDirs: readonly string[];
  skipMinimalLike: boolean;
  requirePromotion: boolean;
}

interface SessionLike {
  id?: unknown;
  events?: unknown;
  header?: unknown;
}

const DEFAULT_CONFIG: PromptPrinciplesConfig = {
  enabled: true,
  knowledgeCutoff: "2026-07",
  memoryState:
    "memory is not enabled in this environment, so no cross-session memories are available",
  readonlyDirs: [],
  skipMinimalLike: true,
  requirePromotion: true,
};

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stringArrayOr(
  value: unknown,
  fallback: readonly string[],
): readonly string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  return items.length > 0 ? items : fallback;
}

/** Normalize a raw composition entry into a complete config. */
export function resolveEntry(raw: unknown): PromptPrinciplesConfig {
  const source =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    enabled: booleanOr(source.enabled, DEFAULT_CONFIG.enabled),
    knowledgeCutoff: stringOr(
      source.knowledgeCutoff,
      DEFAULT_CONFIG.knowledgeCutoff,
    ),
    memoryState: stringOr(source.memoryState, DEFAULT_CONFIG.memoryState),
    readonlyDirs: stringArrayOr(
      source.readonlyDirs,
      DEFAULT_CONFIG.readonlyDirs,
    ),
    skipMinimalLike: booleanOr(
      source.skipMinimalLike,
      DEFAULT_CONFIG.skipMinimalLike,
    ),
    requirePromotion: booleanOr(
      source.requirePromotion,
      DEFAULT_CONFIG.requirePromotion,
    ),
  };
}

function sectionName(section: AssemblySection): string {
  return typeof section.name === "string" ? section.name : "";
}

function sectionText(section: AssemblySection): string {
  return typeof section.text === "string" ? section.text.trim() : "";
}

/**
 * True when the assembly looks Minimal-shaped: a persona section carrying the
 * canonical Minimal sentence inside a small section list. Standard-family
 * assemblies either use a different persona or carry the full identity /
 * tool-guidance / runtime-context stack, so they never match.
 */
export function isMinimalLike(assembled: AssembledPrompt): boolean {
  const sections = Array.isArray(assembled.sections)
    ? (assembled.sections as AssemblySection[])
    : [];
  if (sections.length > MINIMAL_LIKE_MAX_SECTIONS) return false;
  return sections.some(
    (section) =>
      /persona/i.test(sectionName(section)) &&
      sectionText(section) === MINIMAL_PERSONA_SENTENCE,
  );
}

function sessionOf(agent: unknown): SessionLike | undefined {
  if (typeof agent !== "object" || agent === null) return undefined;
  const session = (agent as { session?: unknown }).session;
  if (typeof session !== "object" || session === null) return undefined;
  return session as SessionLike;
}

/**
 * True once the session has produced a durable promotion signal (a tool call
 * or an assistant message). Until then, bootstrap-style presets keep the
 * first request Minimal-exact and this plugin must not perturb it.
 */
export function isPromoted(agent: unknown): boolean {
  const session = sessionOf(agent);
  if (session === undefined) return false;
  if (!Array.isArray(session.events)) return false;
  return (session.events as Array<{ type?: unknown }>).some(
    (event) => event.type === "tool/call" || event.type === "assistant/message",
  );
}

/** The full participation decision for one assembly. */
export function shouldParticipate(
  assembled: AssembledPrompt,
  context: AssemblyContext,
  config: PromptPrinciplesConfig,
): boolean {
  if (!config.enabled) return false;
  if (config.skipMinimalLike && isMinimalLike(assembled)) return false;
  if (config.requirePromotion && !isPromoted(context.agent)) return false;
  return true;
}

/** Inputs the placeholder resolver needs; `now` and `cwd` are injectable for
 *  deterministic tests. */
export interface PlaceholderInput {
  config: PromptPrinciplesConfig;
  context: AssemblyContext;
  now?: () => Date;
  cwd?: () => string;
}

function modelStringOf(agent: unknown): string {
  if (typeof agent !== "object" || agent === null) return "the current model";
  const options = (agent as { options?: unknown }).options;
  if (typeof options !== "object" || options === null) {
    return "the current model";
  }
  const model = (options as { model?: unknown }).model;
  return typeof model === "string" && model.length > 0
    ? `the ${model} model`
    : "the current model";
}

function workspaceDirOf(agent: unknown, fallbackCwd: string): string {
  const session = sessionOf(agent);
  if (session === undefined) return fallbackCwd;
  const header = session.header;
  if (typeof header !== "object" || header === null) return fallbackCwd;
  const cwd = (header as { cwd?: unknown }).cwd;
  return typeof cwd === "string" && cwd.length > 0 ? cwd : fallbackCwd;
}

/** Resolve every {{TOKEN}} the static texts use, from live context. */
export function resolvePlaceholders(
  input: PlaceholderInput,
): Record<PlaceholderKey, string> {
  const now = input.now ?? (() => new Date());
  const cwd = input.cwd ?? (() => process.cwd());
  const readonly =
    input.config.readonlyDirs.length > 0
      ? input.config.readonlyDirs.join(", ")
      : "none (the sandbox policy governs writes)";
  return {
    CURRENT_DATE: now().toISOString().slice(0, 10),
    KNOWLEDGE_CUTOFF: input.config.knowledgeCutoff,
    MEMORY_STATE: input.config.memoryState,
    MODEL_STRING: modelStringOf(input.context.agent),
    WORKSPACE_DIR: workspaceDirOf(input.context.agent, cwd()),
    READONLY_DIRS: readonly,
  };
}

/** Replace every {{TOKEN}} occurrence with its resolved value. */
export function applyTemplate(
  text: string,
  variables: Record<PlaceholderKey, string>,
): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    key in variables ? variables[key as PlaceholderKey] : match,
  );
}

/**
 * Compose the dynamic tool-availability note appended to TOOL_POLICY.
 *
 * This is the "tool prompts are assembled by functions" half of the design:
 * the runtime owns the real tool schemas (layer 8 of the teardown — never
 * re-injected by a plugin), and this function derives a short, truthful
 * paragraph from the actual catalog so the guidance never names a tool the
 * session cannot call.
 */
export function composeToolPolicyNote(toolNames: readonly string[]): string {
  const available = new Set(toolNames);
  const has = (...names: string[]) => names.some((name) => available.has(name));
  const lines: string[] = [];
  if (has("web_search", "web_fetch")) {
    lines.push(
      "Web search is available in this session; use it whenever currency matters instead of guessing.",
    );
  }
  if (has("skill_search", "skill_load")) {
    lines.push(
      "On-demand skill discovery is available (skill_search / skill_load): search before assuming a skill's name or contents.",
    );
  }
  if (has("ask_user_question")) {
    lines.push(
      "An ask-user tool is available; use it for the confirmation steps above and for user-owned choices.",
    );
  }
  if (has("read", "write", "edit", "str_replace_editor")) {
    lines.push(
      "File tools are available; create and edit deliverables in the workspace rather than pasting long bodies into chat.",
    );
  }
  return lines.length > 0 ? `\n\nAvailability: ${lines.join(" ")}` : "";
}

function toolNamesOf(assembled: AssembledPrompt): string[] {
  if (!Array.isArray(assembled.tools)) return [];
  return (assembled.tools as Array<{ name?: unknown }>)
    .map((tool) => (typeof tool.name === "string" ? tool.name : ""))
    .filter((name) => name.length > 0);
}

/** One assembled contribution. */
export interface PrincipleSection {
  name: string;
  order: number;
  text: string;
}

/** Inputs for the section builder. */
export interface SectionInput extends PlaceholderInput {
  assembled: AssembledPrompt;
}

/**
 * Build the full ordered section list for one assembly.
 *
 * Order bands: the head patch sits before everything we add, the body
 * sections follow in policy order, and the identity block closes at the tail
 * (the end of the system prompt carries extra weight — the original product
 * used the same trick, and we keep it deliberately).
 */
export function buildSections(input: SectionInput): PrincipleSection[] {
  const variables = resolvePlaceholders(input);
  const render = (text: string): string => applyTemplate(text, variables);
  return [
    { name: "pp-head-patch", order: ORDER_HEAD, text: HEAD_PATCH },
    { name: "pp-core", order: ORDER_BODY, text: render(CORE) },
    {
      name: "pp-runtime-state",
      order: ORDER_BODY + 20,
      text: render(RUNTIME_STATE),
    },
    {
      name: "pp-tool-policy",
      order: ORDER_BODY + 40,
      text: TOOL_POLICY + composeToolPolicyNote(toolNamesOf(input.assembled)),
    },
    { name: "pp-skills-policy", order: ORDER_BODY + 60, text: SKILLS_POLICY },
    {
      name: "pp-environment",
      order: ORDER_BODY + 80,
      text: render(ENVIRONMENT),
    },
    {
      name: "pp-search-policy",
      order: ORDER_BODY + 100,
      text: render(SEARCH_POLICY),
    },
    {
      name: "pp-identity-tail",
      order: ORDER_TAIL,
      text: render(IDENTITY_TAIL),
    },
  ];
}
