# dsh-prompt-principles

Experimental layered prompt-principles injection for DeepSeek Harness, shipped
as an official-format plugin. English | [中文](./README.zh-CN.md)

The plugin appends a well-ordered set of behavioral prompt sections to the
system prompt of **Standard-like sessions**. Minimal-shaped sessions (the
`minimal` preset, the anchored bootstrap, a router's first turn) are detected
and left untouched, so the injection reaches the modes that want it without
perturbing the ones whose trajectory depends on a Minimal-exact prompt.

A Settings toggle — **Experimental prompt injection / 实验性新型提示词注入**,
ON by default — is available in two places in the official Web UI:

- The plugin's **dedicated page inside the Plugins settings section**
  (`settings.plugins.tab`, id `prompt-principles`, registered right after the
  official plugin inventory tab): a visible explanation of what the injection
  does, a behavior note, and the enable toggle.
- The **General settings** row (via the `settings.general.item` slot), where
  hovering the label shows the detailed explanation.

Both surfaces read and write the same `prompt-principles` settings namespace
through the official settings wire, and the host half reads the resolved value
at every assembly, so a change applies to new requests immediately.

## How the injection works

The runtime owns prompt assembly through two waterfalls. This plugin hooks
`system-prompt/assemble` as the outermost-safe transform: it first delegates
(`await next()`), then appends its sections to whatever the rest of the
composition produced. It never injects tool schemas (the runtime's
`assembled.tools` already carries them) and never rewrites existing sections.

Participation requires all of:

1. `enabled` — the settings namespace resolved value (schema default `true`).
2. Not Minimal-shaped — a persona section with the canonical Minimal sentence
   inside a small section list (a `complete` persona suppresses the identity /
   tool-guidance / runtime-context stack, which is what makes an assembly
   Minimal-exact).
3. Promoted — the session has a durable `tool/call` or `assistant/message`
   event, protecting every bootstrap-style preset's first-request anchor.

Any failure inside the plugin's own logic returns the upstream assembly
untouched (a principles bug must never break a request).

## Layer mapping (consumer-chat teardown → this plugin)

| Source layer                        | Disposition                                                                                                               | Section (`order`)        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| L0 head patch (raw tool-markup ban) | ported                                                                                                                    | `pp-head-patch` (10)     |
| L1 behavioral core                  | ported; the original's permissive security stance rewritten to a neutral professional boundary                            | `pp-core` (100)          |
| L2 runtime state                    | parameterized `{{MEMORY_STATE}}`                                                                                          | `pp-runtime-state` (120) |
| L3 artifact storage API             | deleted — no `window.storage` in Harness                                                                                  | —                        |
| L4 MCP app policy                   | rewritten to a real-tools policy + dynamic availability note                                                              | `pp-tool-policy` (140)   |
| L5 skills-first                     | mapped to the Harness skills system                                                                                       | `pp-skills-policy` (160) |
| L5b/L6/L12 environment + file rules | rewritten to Harness workspace rules; `{{WORKSPACE_DIR}}`, `{{READONLY_DIRS}}`                                            | `pp-environment` (180)   |
| L7 search policy                    | ported minus image search and the consumer deep-research feature                                                          | `pp-search-policy` (200) |
| L8 tool schema                      | native — the runtime assembles `assembled.tools`; the plugin only derives `composeToolPolicyNote()` from the real catalog | —                        |
| L9 tail identity                    | re-identified for DeepSeek; `{{CURRENT_DATE}}`, `{{MODEL_STRING}}`                                                        | `pp-identity-tail` (900) |
| L10 artifact bootstrapping          | deleted                                                                                                                   | —                        |
| L11 static skills index             | not injected — Standard's skill catalog / on-demand skill tools already enumerate skills                                  | —                        |

The tail identity deliberately keeps the original's trick of occupying the
high-weight end of the prompt.

## Package layout and function design

```
src/content.ts        static layer texts + {{TOKEN}} declarations (the "non-assembled" half)
src/assemble.ts       pure assembly logic — the "assembled by functions" half:
                        resolveEntry()            normalize composition entry → config
                        isMinimalLike()           Minimal-shape detection
                        isPromoted()              durable promotion-signal detection
                        shouldParticipate()       the full participation decision
                        resolvePlaceholders()     live {{TOKEN}} resolution (date, model, cwd, …)
                        applyTemplate()           token substitution
                        composeToolPolicyNote()   dynamic tool-availability paragraph
                        buildSections()           ordered section list for one assembly
src/index.ts          host half: settings namespace + the system-prompt/assemble hook
src/client-runtime.js client half: General-settings row (tooltip, switch) and
                        the dedicated Plugins-section settings page
scripts/build-client.mjs  esbuild → client.js (window.__ModuleLoader__ wrapper)
```

## Configuration

The composition entry (`cordis.patch.yml` row `config`) and the settings
namespace share one schema: `enabled`, `knowledgeCutoff`, `memoryState`,
`readonlyDirs`, `skipMinimalLike`, `requirePromotion`. The composition entry
acts as the settings `base` layer, so a deployment can pin defaults while the
user toggle only writes the user layer.

## Build and test

```
pnpm --dir packages/prompt-principles-plugin run build
```

Unit tests live in `test/` and run under the repository root `pnpm test:unit`.
