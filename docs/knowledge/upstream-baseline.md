---
id: knowledge.upstream-baseline
title: Upstream Baseline
summary: Version and official-contract evidence for Harness, packaging, native conversation-rendering ownership, and the exact rc.6 turn-tail projection patch.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [dependencies, harness, electron, renderer]
triggers: [upgrade, upstream, plugin, questions, renderer, esbuild]
read_when: [changing pinned versions or official integration behavior]
skip_when: [editing app-local styling only]
priority: must
freshness_class: rapid
last_verified: 2026-08-16T13:56:03+08:00
revalidate_after: 2026-08-17T13:56:03+08:00
owners: [project]
source_of_truth:
  - https://github.com/deepseek-ai/deepseek-harness
  - https://www.npmjs.com/package/@deepseek-ai/dsh
  - https://www.electronjs.org/docs/latest/
  - https://esbuild.github.io/api/
related:
  prerequisites: [../project/intent.md]
  next: [../architecture/overview.md]
supersedes: []
tags: [research, versions]
---

# Upstream Baseline

## Current Conclusion

Pin `@deepseek-ai/dsh@0.1.0-rc.6`, Electron `43.4.0`, electron-builder `26.15.3`, and esbuild `0.25.12`. The peer-qualified `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.6` is reproducibly patched through pnpm to avoid an open-turn quadratic `turn-tail` scan while preserving the official canonical event path and fail-open fallback. Harness supplies the official user-question packages, Cordis bundle mechanism, and conversation UI; this project composes the official UI rather than adding a thinking/status overlay.

## Evidence

| Retrieved at | Source                                                                                                         | Version/date                                                                 | Key evidence                                                                                      | Confidence |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| 2026-08-15   | [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)                                 | inspected commit `47f943859bef60e4160492346772ded9b24f765a` plus npm release | Official packages, `dsh web`, Cordis `apply(ctx)`, bundle patches, question tool and client UI    | high       |
| 2026-08-15   | [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)                                        | 0.1.0-rc.6                                                                   | CLI package baseline                                                                              | high       |
| 2026-08-15   | [Electron releases](https://releases.electronjs.org/)                                                          | 43.4.0                                                                       | Chromium desktop runtime baseline                                                                 | high       |
| 2026-08-15   | [electron-builder](https://www.electron.build/)                                                                | 26.15.3                                                                      | macOS universal and DMG packaging baseline                                                        | high       |
| 2026-08-16   | [esbuild bundle API](https://esbuild.github.io/api/) and workspace lock                                        | 0.25.12                                                                      | Recursively bundles local/third-party client code while preserving the declared Harness externals | high       |
| 2026-08-16   | Pinned installed Harness packages                                                                              | `@deepseek-ai/dsh-llm-deepseek`, `dsh-base`, and `dsh-web-app` 0.1.0-rc.6    | V4 Pro/Flash catalog, official reasoning efforts, Skills, tools, workflows, and supporting UI     | high       |
| 2026-08-16   | Installed rc.6 conversation bundle, pnpm patch, and real-bundle regression                                     | `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.6`                         | Open-turn match inspections: 50,015,000 before, zero after; exact 10,000-delta text retained      | high       |

## V4 Pro and Integrated Toolchain

- The pinned official DeepSeek adapter publishes `deepseek-v4-pro` and `deepseek-v4-flash`, a 1,000,000-token model catalog, and `off`, `high`, and `max` reasoning efforts.
- Official `high` and `max` settings activate the adapter's supported thinking mode through the public `reasoning_effort` request field. Tool-call reasoning passback is handled inside the adapter.
- The public per-request `agent/request` seam can override reasoning effort. The literal `We need` intent policy is not implemented or tested yet and must remain a roadmap claim until that work exists.
- The pinned base and Web bundles contain the Skills runtime and UI, filesystem Skill discovery, Goal, Plan, Todo, Jobs, Workflow, checkpoints, sessions, questions, approvals, subagents, feedback, shell and filesystem tools, Web tools, plugin inventory, and provider/model settings.
- The desktop profile loads the official base and Web bundles together with the desktop and Anchored Standard bundles. This supports an integrated-distribution claim, not a claim that model weights are shipped in the application.

## Official Question Contract

Retain `@deepseek-ai/dsh-tool-ask-user`, `@deepseek-ai/dsh-user-questions`, and `@deepseek-ai/dsh-client-ui-user-questions`. Required behavior includes stable IDs, single/multiple selection, custom answers, skip/cancel, plan review, and pending-question restoration. Desktop code may style and test these flows but must not alter field encoding.

## Applicability

Project versions are exact even if newer upstream releases appear. Revalidate before dependency upgrades, package publication, or compatibility claims.

## Pinned Runtime Findings

- `dsh web --host 127.0.0.1 --port <port>` is the verified launch form; `/api/health` and `/api/` return 404 in rc.6.
- The app-owned profile is stored under `DSH_HOME` and loads the official base/Web bundles before the desktop bundle.
- The rc.6 Agent Preset roster automatically scans `<DSH_HOME>/.agent-presets`. Preset-local `system-prompt/assemble`, `session/event`, and `agent/pre-step` hooks can implement event-derived schema phases without recompose or private transport mutation.
- The official Web boot graph in the packaged app contains 39 client entries, including `@deepseek-ai/dsh-client-ui-user-questions` and `deepseek-harness-desktop-plugin`.
- rc.6 package scanning does not discover this graph from the tested ASAR layout, so the release uses an unpacked application tree.
- The desktop client does not add conversation paint. The only related runtime externals are Harness-provided React, `react/jsx-runtime`, and UI primitives; preflight rejects retired animation imports.
- The rc.6 conversation patch changes only `turn-tail.tailData()`: normal Definition state proves whether `turn/end` exists in O(1); an unexpectedly absent state executes the original match scan. Assistant chunk ingestion, ordering, RAF/immediate publication selection, final-token handling, and structural completion remain official rc.6 behavior. Rollback removes the exact `patchedDependencies` mapping and regenerates the frozen lockfile, but must not proceed unless the focused regression remains green against the replacement upstream version.
