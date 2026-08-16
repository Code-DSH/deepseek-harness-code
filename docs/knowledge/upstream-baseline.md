---
id: knowledge.upstream-baseline
title: Upstream Baseline
summary: Version and official-contract evidence for Harness, packaging, DSH Routing Suite pins, bundled Skills, and the native-status Orb dependency.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [dependencies, harness, electron, routing-suite, skills, conversation-effects]
triggers: [upgrade, upstream, plugin, routing, skills, questions, thinking-orbs, esbuild]
read_when: [changing pinned versions or official integration behavior]
skip_when: [editing app-local styling only]
priority: must
freshness_class: rapid
last_verified: 2026-08-16T19:17:07+08:00
revalidate_after: 2026-08-17T19:17:07+08:00
owners: [project]
source_of_truth:
  - https://github.com/deepseek-ai/deepseek-harness
  - https://www.npmjs.com/package/@deepseek-ai/dsh
  - https://www.electronjs.org/docs/latest/
  - https://github.com/Jakubantalik/thinking-orbs
  - https://github.com/kasturikhanke/generative-loaders
  - https://github.com/yjh051108/dsh-routing-suite
  - https://github.com/yjh051108/dsh-super-injector
  - https://github.com/yjh051108/dsh-mode-boost
  - https://github.com/yjh051108/dsh-router-standard
  - https://github.com/obra/superpowers
related:
  prerequisites: [../project/intent.md]
  next: [../architecture/overview.md]
supersedes: []
tags: [research, versions]
---

# Upstream Baseline

## Current Conclusion

Pin `@deepseek-ai/dsh@0.1.0-rc.6`, Electron `43.4.0`, electron-builder `26.15.3`, `thinking-orbs@0.3.1`, and esbuild `0.25.12`. ReactDOM `18.3.1` is pinned only as a development dependency for real React mounting tests. Harness supplies the official user-question packages and Cordis bundle mechanism; this project composes them rather than defining replacements. The DSH Routing Suite is bundled as a pinned offline snapshot (injector `0.3.3`, mode-boost `0.1.0`, router preset `0.2.0` at `eff787e95132d6c7104214542104a84d656b497e`) with a bounded daily user-cache refresh that currently follows router-preset main. Superpowers `6.2.0` is bundled as the offline Skills collection. `generative-loaders@0.1.1` is an MIT-licensed visual reference only and is no longer part of the active client.

## Evidence

| Retrieved at | Source                                                                                                         | Version/date                                                                 | Key evidence                                                                                      | Confidence |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| 2026-08-15   | [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)                                 | inspected commit `47f943859bef60e4160492346772ded9b24f765a` plus npm release | Official packages, `dsh web`, Cordis `apply(ctx)`, bundle patches, question tool and client UI    | high       |
| 2026-08-15   | [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)                                        | 0.1.0-rc.6                                                                   | CLI package baseline                                                                              | high       |
| 2026-08-15   | [Electron releases](https://releases.electronjs.org/)                                                          | 43.4.0                                                                       | Chromium desktop runtime baseline                                                                 | high       |
| 2026-08-15   | [electron-builder](https://www.electron.build/)                                                                | 26.15.3                                                                      | macOS universal and DMG packaging baseline                                                        | high       |
| 2026-08-16   | [thinking-orbs repository](https://github.com/Jakubantalik/thinking-orbs) and npm registry metadata            | 0.3.1                                                                        | 20-pixel preset, speed multiplier, automatic theme, reduced-motion static frame, MIT license      | high       |
| 2026-08-16   | [generative-loaders repository](https://github.com/kasturikhanke/generative-loaders) and npm registry metadata | 0.1.1                                                                        | MIT-licensed dissolve visual reference; the plain-text component is not bundled                   | high       |
| 2026-08-16   | [esbuild bundle API](https://esbuild.github.io/api/) and workspace lock                                        | 0.25.12                                                                      | Recursively bundles local/third-party client code while preserving the declared Harness externals | high       |
| 2026-08-16   | Workspace manifest and lock                                                                                    | ReactDOM 18.3.1                                                              | Development-only real `createRoot` browser test runtime; not shipped as a plugin runtime external | high       |
| 2026-08-16   | [DSH Routing Suite](https://github.com/yjh051108/dsh-routing-suite)                                             | suite submodule refs; snapshot `build/routing-suite/versions.json`           | Install chain identifies injector, mode boost, and router preset components; bundled SHA-256s are recorded | high       |
| 2026-08-16   | [Super Injector](https://github.com/yjh051108/dsh-super-injector) and [Mode Boost](https://github.com/yjh051108/dsh-mode-boost) | release `0.3.3` / `0.1.0` | Release tarballs are the offline snapshot sources used by `fetch-routing-suite.mjs`                             | high       |
| 2026-08-16   | [Router Standard](https://github.com/yjh051108/dsh-router-standard)                                              | `0.2.0` at commit `eff787e95132d6c7104214542104a84d656b497e`                  | The bundled snapshot pins the commit archive; the daily refresh currently follows `main`                     | high       |
| 2026-08-16   | [Superpowers repository](https://github.com/obra/superpowers)                                                    | `6.2.0`                                                                      | MIT-licensed skill collection bundled under `packages/superpowers-skills`                                   | high       |
| 2026-08-16   | Pinned installed Harness packages                                                                              | `@deepseek-ai/dsh-llm-deepseek`, `dsh-base`, and `dsh-web-app` 0.1.0-rc.6    | V4 Pro/Flash catalog, official reasoning efforts, Skills, tools, workflows, and supporting UI     | high       |

## V4 Pro and Integrated Toolchain

- The pinned official DeepSeek adapter publishes `deepseek-v4-pro` and `deepseek-v4-flash`, a 1,000,000-token model catalog, and `off`, `high`, and `max` reasoning efforts.
- Official `high` and `max` settings activate the adapter's supported thinking mode through the public `reasoning_effort` request field. Tool-call reasoning passback is handled inside the adapter.
- The public per-request `agent/request` seam can override reasoning effort. The literal `We need` intent policy is not implemented or tested yet and must remain a roadmap claim until that work exists.
- The pinned base and Web bundles contain the Skills runtime and UI, filesystem Skill discovery, Goal, Plan, Todo, Jobs, Workflow, checkpoints, sessions, questions, approvals, subagents, feedback, shell and filesystem tools, Web tools, plugin inventory, and provider/model settings.
- The desktop profile loads the official base and Web bundles together with the desktop and Anchored Standard bundles. This supports an integrated-distribution claim, not a claim that model weights are shipped in the application.

## Official Question Contract

Retain `@deepseek-ai/dsh-tool-ask-user`, `@deepseek-ai/dsh-user-questions`, and `@deepseek-ai/dsh-client-ui-user-questions`. Required behavior includes stable IDs, single/multiple selection, custom answers, skip/cancel, plan review, and pending-question restoration. Desktop code may style and test these flows but must not alter field encoding.

## DSH Routing Suite Contract

- Bundled component versions: `@dsh-external/dsh-super-injector@0.3.3`, `@dsh-external/dsh-mode-boost@0.1.0`, and router preset `0.2.0` at commit `eff787e95132d6c7104214542104a84d656b497e`.
- Recorded SHA-256 values in `build/routing-suite/versions.json`: injector `355238fa8e51bc45c0801066af51e0e122f3b21411b193f601ee54e534391f48`, mode boost `72836d64bc465bc7c915e1bbc810d15ae0825dd4448350bcbf42c6e76efca12b`, router preset `a8f3616fe4f5ed3951118dbc508239cf61dfcd5c763ed1ec9baafea886126676`.
- Startup assembly appends the injector after the desktop bundle, links mode boost through the profile `cordis.patch.yml`, and installs `router-standard`/`router-spec` under `<DSH_HOME>/.agent-presets` as managed presets.
- The installed app refreshes a user-level cache at most once per 24 hours. The injector and mode boost use pinned release tarballs; the router preset uses `dsh-router-standard/main`, which is mutable. This is documented as a release risk until reviewed immutable pins replace that path.
- Managed presets normalize bilingual display copy before hashing, so the offline snapshot, startup install, and refreshed cache all present the same localized names/descriptions.
- Every routing failure is optional and fail-open: Standard Harness startup continues with a bounded diagnostic, and user-owned same-name presets are never overwritten.

## Applicability

Project versions are exact even if newer upstream releases appear. Revalidate before dependency upgrades, package publication, or compatibility claims.

## Pinned Runtime Findings

- `dsh web --host 127.0.0.1 --port <port>` is the verified launch form; `/api/health` and `/api/` return 404 in rc.6.
- The app-owned profile is stored under `DSH_HOME` and loads the official base/Web bundles before the desktop bundle.
- The rc.6 Agent Preset roster automatically scans `<DSH_HOME>/.agent-presets`. Preset-local `system-prompt/assemble`, `session/event`, and `agent/pre-step` hooks can implement event-derived schema phases without recompose or private transport mutation.
- The official Web boot graph in the packaged app contains 39 client entries, including `@deepseek-ai/dsh-client-ui-user-questions` and `deepseek-harness-desktop-plugin`.
- rc.6 package scanning does not discover this graph from the tested ASAR layout, so the release uses an unpacked application tree.
- The desktop client bundle inlines `thinking-orbs` and `thinking-status.js`; the dormant stream-output controllers are no longer imported by `client.js`. Its only related runtime externals are Harness-provided React, `react/jsx-runtime`, and UI primitives; preflight rejects unresolved imports.
- `thinking-orbs` renders a monochrome canvas, supports the approved 20-pixel breathing configuration, and provides its own reduced-motion static behavior. The plugin hides the Orb from accessibility because the native Harness polite status remains authoritative.
- Full MIT text for `thinking-orbs` and the adapted `generative-loaders` visual reference ships in `desktop-plugin/THIRD_PARTY_NOTICES.md`.
