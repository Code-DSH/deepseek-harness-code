---
id: knowledge.upstream-baseline
title: Upstream Baseline
summary: Version and official-contract evidence for Harness, packaging, and bundled conversation effects.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [dependencies, harness, electron, conversation-effects]
triggers: [upgrade, upstream, plugin, questions, thinking-orbs, esbuild]
read_when: [changing pinned versions or official integration behavior]
skip_when: [editing app-local styling only]
priority: must
freshness_class: rapid
last_verified: 2026-08-16T13:37:00+08:00
revalidate_after: 2026-08-17T13:37:00+08:00
owners: [project]
source_of_truth:
  - https://github.com/deepseek-ai/deepseek-harness
  - https://www.npmjs.com/package/@deepseek-ai/dsh
  - https://www.electronjs.org/docs/latest/
  - https://github.com/Jakubantalik/thinking-orbs
  - https://github.com/kasturikhanke/generative-loaders
  - https://esbuild.github.io/api/
related:
  prerequisites: [../project/intent.md]
  next: [../architecture/overview.md]
supersedes: []
tags: [research, versions]
---

# Upstream Baseline

## Current Conclusion

Pin `@deepseek-ai/dsh@0.1.0-rc.6`, Electron `43.4.0`, electron-builder `26.15.3`, `thinking-orbs@0.3.1`, and esbuild `0.25.12`. ReactDOM `18.3.1` is pinned only as a development dependency for real React overlay mounting tests. Harness supplies the official user-question packages and Cordis bundle mechanism; this project composes them rather than defining replacements. `generative-loaders@0.1.1` is an MIT-licensed visual reference only and is not a runtime dependency.

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

## Official Question Contract

Retain `@deepseek-ai/dsh-tool-ask-user`, `@deepseek-ai/dsh-user-questions`, and `@deepseek-ai/dsh-client-ui-user-questions`. Required behavior includes stable IDs, single/multiple selection, custom answers, skip/cancel, plan review, and pending-question restoration. Desktop code may style and test these flows but must not alter field encoding.

## Applicability

Project versions are exact even if newer upstream releases appear. Revalidate before dependency upgrades, package publication, or compatibility claims.

## Pinned Runtime Findings

- `dsh web --host 127.0.0.1 --port <port>` is the verified launch form; `/api/health` and `/api/` return 404 in rc.6.
- The app-owned profile is stored under `DSH_HOME` and loads the official base/Web bundles before the desktop bundle.
- The official Web boot graph in the packaged app contains 39 client entries, including `@deepseek-ai/dsh-client-ui-user-questions` and `deepseek-harness-desktop-plugin`.
- rc.6 package scanning does not discover this graph from the tested ASAR layout, so the release uses an unpacked application tree.
- The desktop client bundle inlines `thinking-orbs` and local conversation controllers. Its only related runtime externals are Harness-provided React, `react/jsx-runtime`, and UI primitives; preflight rejects unresolved animation imports.
- `thinking-orbs` renders a monochrome canvas, supports the approved 20-pixel breathing configuration, and provides its own reduced-motion static behavior. The plugin hides that canvas from accessibility because the native Harness polite status remains authoritative.
- Full MIT text for `thinking-orbs` and the adapted `generative-loaders` visual reference ships in `desktop-plugin/THIRD_PARTY_NOTICES.md`.
