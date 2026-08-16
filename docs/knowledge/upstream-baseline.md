---
id: knowledge.upstream-baseline
title: Upstream Baseline
summary: Version and official-contract evidence used for the initial implementation.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [dependencies, harness, electron]
triggers: [upgrade, upstream, plugin, questions]
read_when: [changing pinned versions or official integration behavior]
skip_when: [editing app-local styling only]
priority: must
freshness_class: rapid
last_verified: 2026-08-15T23:30:00+08:00
revalidate_after: 2026-08-16T23:30:00+08:00
owners: [project]
source_of_truth:
  - https://github.com/deepseek-ai/deepseek-harness
  - https://www.npmjs.com/package/@deepseek-ai/dsh
  - https://www.electronjs.org/docs/latest/
related:
  prerequisites: [../project/intent.md]
  next: [../architecture/overview.md]
supersedes: []
tags: [research, versions]
---

# Upstream Baseline

## Current Conclusion

Pin `@deepseek-ai/dsh@0.1.0-rc.6`, Electron `43.4.0`, and electron-builder `26.15.3`. Harness supplies the official user-question packages and Cordis bundle mechanism; this project composes them rather than defining replacements.

## Evidence

| Retrieved at | Source                                                                         | Version/date                                                                 | Key evidence                                                                                   | Confidence |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| 2026-08-15   | [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness) | inspected commit `47f943859bef60e4160492346772ded9b24f765a` plus npm release | Official packages, `dsh web`, Cordis `apply(ctx)`, bundle patches, question tool and client UI | high       |
| 2026-08-15   | [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)        | 0.1.0-rc.6                                                                   | CLI package baseline                                                                           | high       |
| 2026-08-15   | [Electron releases](https://releases.electronjs.org/)                          | 43.4.0                                                                       | Chromium desktop runtime baseline                                                              | high       |
| 2026-08-15   | [electron-builder](https://www.electron.build/)                                | 26.15.3                                                                      | macOS universal and DMG packaging baseline                                                     | high       |

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
