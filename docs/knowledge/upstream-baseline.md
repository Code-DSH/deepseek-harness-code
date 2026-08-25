---
id: knowledge.upstream-baseline
title: Upstream Baseline
summary: Upstream 0.1.1-rc.2 evidence and the pinned Code-DSH maintained 0.1.1-rc.2.code.1 family contract.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [dependencies, harness, electron, routing-suite, renderer]
triggers: [upgrade, upstream, plugin, routing, questions, renderer, esbuild]
read_when: [changing pinned versions or official integration behavior]
skip_when: [editing app-local styling only]
priority: must
freshness_class: rapid
last_verified: 2026-08-22T11:15:00+08:00
revalidate_after: 2026-08-23T11:15:00+08:00
owners: [project]
source_of_truth:
  - https://github.com/Code-DSH/deepseek-harness
  - https://github.com/deepseek-ai/deepseek-harness
  - https://www.npmjs.com/package/@deepseek-ai/dsh
  - https://www.electronjs.org/docs/latest/
  - https://esbuild.github.io/api/
  - https://orbs.jakubantalik.com/
  - https://github.com/Jakubantalik/thinking-orbs
  - https://github.com/yjh051108/dsh-routing-suite
  - https://github.com/yjh051108/dsh-super-injector
  - https://github.com/yjh051108/dsh-mode-boost
  - https://github.com/yjh051108/dsh-router-standard
related:
  prerequisites: [../project/intent.md]
  next: [../architecture/overview.md]
supersedes: []
tags: [research, versions]
---

# Upstream Baseline

## Current Conclusion

Pin the `deps/deepseek-harness` gitlink to the Code-DSH repository and consume the complete `0.1.1-rc.2.code.1` family from local tarballs. The maintained source is based on upstream commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` and carries Windows plugin argument quoting, persistent Bash prompt handling, four product preset localizations, and the macOS sidebar inset. Keep Electron `43.4.0`, electron-builder `26.15.3`, pnpm `11.19.0`, `dsh-find-plugin@0.3.6`, esbuild `0.25.12`, and `thinking-orbs@0.3.1`. `DSH_HOME`/`~/.dsh`, the public plugin CLI, question protocol, Cordis bundle mechanism, conversation tree, and status semantics remain unchanged.

## Evidence

| Retrieved at | Source                                                                                                                          | Version/date                                                                           | Key evidence                                                                                                        | Confidence |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-08-15   | [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)                                                  | inspected commit `47f943859bef60e4160492346772ded9b24f765a` plus npm release           | Official packages, `dsh web`, Cordis `apply(ctx)`, bundle patches, question tool and client UI                      | high       |
| 2026-08-15   | [npm: @deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)                                                         | 0.1.0-rc.8                                                                             | CLI package baseline                                                                                                | high       |
| 2026-08-15   | [Electron releases](https://releases.electronjs.org/)                                                                           | 43.4.0                                                                                 | Chromium desktop runtime baseline                                                                                   | high       |
| 2026-08-16   | [Electron first-app lifecycle guide](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app)                        | documentation retrieved 2026-08-16                                                     | BrowserWindows and macOS `activate` listeners that create them belong inside `app.whenReady()`                      | high       |
| 2026-08-15   | [electron-builder](https://www.electron.build/)                                                                                 | 26.15.3                                                                                | macOS universal and DMG packaging baseline                                                                          | high       |
| 2026-08-16   | [esbuild bundle API](https://esbuild.github.io/api/) and workspace lock                                                         | 0.25.12                                                                                | Recursively bundles local/third-party client code while preserving the declared Harness externals                   | high       |
| 2026-08-16   | Pinned installed Harness packages                                                                                               | `@deepseek-ai/dsh-llm-deepseek`, `dsh-base`, and `dsh-web-app` 0.1.0-rc.8              | V4 Pro/Flash catalog, official reasoning efforts, Skills, tools, workflows, and supporting UI                       | high       |
| 2026-08-16   | Installed rc.8 conversation bundle, pnpm patch, and real-bundle regression                                                      | `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.8`                                   | Open-turn match inspections: 50,015,000 before, zero after; exact 10,000-delta text retained                        | high       |
| 2026-08-16   | [Thinking Orbs site](https://orbs.jakubantalik.com/) and [official repository](https://github.com/Jakubantalik/thinking-orbs)   | npm `0.3.1`                                                                            | `working` renders rotating tilted orbits; `breathing` renders a morphing ring; MIT license                          | high       |
| 2026-08-16   | [DSH Routing Suite](https://github.com/yjh051108/dsh-routing-suite)                                                             | suite main `a09eb0ade28e6ec3b8e5eb22985a14f6bfa1fbe5`                                  | Install chain and submodule refs identify injector, mode boost, and router preset components                        | high       |
| 2026-08-16   | [Super Injector](https://github.com/yjh051108/dsh-super-injector) and [Mode Boost](https://github.com/yjh051108/dsh-mode-boost) | tags `0.3.3` / `0.1.0` at `f4ef59f` / `a9a666a`                                        | Release refs match the pinned prebuilt archives used by the offline snapshot                                        | high       |
| 2026-08-16   | [Router Standard](https://github.com/yjh051108/dsh-router-standard)                                                             | suite gitlink/tag `0.2.0` at `eff787e`; main `f9667f7`                                 | The immutable suite gitlink is used instead of mutable main; README version wording is not a pin                    | high       |
| 2026-08-20   | Installed rc.8 CLI, `@deepseek-ai/dsh-home-paths`, and real Electron integration test                                           | `dsh`/Home paths `0.1.0-rc.8`, pnpm `11.19.0`                                          | Resolver precedence, public plugin reconciliation (8 plugins), bundled pnpm launcher, and bare-name boot graph      | high       |
| 2026-08-20   | `build/routing-suite/versions.json` + `electron-builder.yml`                                                                    | injector `355238fa...391f48`, mode-boost `72836d64...ca12b`, router `a8f3616...126676` | Immutable snapshot + 8-plugin extraResources, verified by `check-runtime-closure.mjs` + `verify-macos-artifact.mjs` | high       |
| 2026-08-22   | [Harness v0.1.1-rc.2 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2) + npm metadata      | tag commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`; npm latest `0.1.1-rc.2`         | Files API image upload/reuse, model-aware resize/format conversion, exact package integrity and dependency graph    | high       |
| 2026-08-23   | [Code-DSH maintained Harness](https://github.com/Code-DSH/deepseek-harness)                                                     | commit `6f3bf64735b00754d843ff31ae645b62a32414c8`; family `0.1.1-rc.2.code.1`          | Four former desktop patches migrated to maintained source; complete family pack and provenance boundary             | high       |

## V4 Pro and Integrated Toolchain

- The pinned official DeepSeek adapter publishes `deepseek-v4-pro` and `deepseek-v4-flash`, a 1,000,000-token model catalog, and `off`, `high`, and `max` reasoning efforts.
- Official `high` and `max` settings activate the adapter's supported thinking mode through the public `reasoning_effort` request field. Tool-call reasoning passback is handled inside the adapter.
- The public per-request `agent/request` seam can override reasoning effort. The literal `We need` intent policy is not implemented or tested yet and must remain a roadmap claim until that work exists.
- The pinned base and Web bundles contain the Skills runtime and UI, filesystem Skill discovery, Goal, Plan, Todo, Jobs, Workflow, checkpoints, sessions, questions, approvals, subagents, feedback, shell and filesystem tools, Web tools, plugin inventory, and provider/model settings.
- The official Web profile loads the base and Web bundles together with public-CLI-installed desktop, injector, mode-boost, find-plugin, and the 5 additional UI/vision/sidebar/prompt/superpowers bundles. Anchored Standard and router modes remain Agent Presets rather than Web bundles. This supports an integrated-distribution claim, not a claim that model weights are shipped in the application.

## Official Question Contract

Retain `@deepseek-ai/dsh-tool-ask-user`, `@deepseek-ai/dsh-user-questions`, and `@deepseek-ai/dsh-client-ui-user-questions`. Required behavior includes stable IDs, single/multiple selection, custom answers, skip/cancel, plan review, and pending-question restoration. Desktop code may style and test these flows but must not alter field encoding.

## DSH Routing Suite Contract

- Bundled component versions: `@dsh-external/dsh-super-injector@0.3.3`, `@dsh-external/dsh-mode-boost@0.1.0`, and router preset `0.2.0` at commit `eff787e95132d6c7104214542104a84d656b497e`.
- Recorded SHA-256 values in `build/routing-suite/versions.json`: injector `355238fa8e51bc45c0801066af51e0e122f3b21411b193f601ee54e534391f48`, mode boost `72836d64bc465bc7c915e1bbc810d15ae0825dd4448350bcbf42c6e76efca12b`, router preset `a8f3616fe4f5ed3951118dbc508239cf61dfcd5c763ed1ec9baafea886126676`.
- The public plugin CLI installs the desktop bundle, injector, mode boost, find-plugin, ui-motion, model2-selector, ui-polish, updater-check, prompt-principles, vision-router, better-sidebar, superpowers, and composition packages; the desktop layer does not edit profile manifests, bundle lists, profile links, or user patch YAML.
- The installed app has no routing updater. Component bytes change only with a reviewed application release, and the build rejects archive digest drift before extraction.
- Managed presets normalize bilingual display copy before hashing, so the offline snapshot and startup install present the same localized names/descriptions.
- Every routing failure is optional and fail-open: Standard Harness startup continues with a bounded diagnostic, and user-owned same-name presets are never overwritten.

## Integrated Plugin Inventory

| Plugin             | Package                           | Version | Role                                                | Client bundle                               |
| ------------------ | --------------------------------- | ------- | --------------------------------------------------- | ------------------------------------------- |
| Desktop            | `deepseek-harness-desktop-plugin` | 0.1.0   | lifecycle, settings, transitions, ThinkingOrb       | `client.js` (esbuild, Harness externals)    |
| UI Motion          | `dsh-ui-motion`                   | 1.1.0   | route transitions + motion tokens                   | `lib/client.js`                             |
| Model2 Selector    | `dsh-model2-selector`             | 1.1.0   | two-level model/reasoning picker                    | `lib/client.js`                             |
| UI Polish          | `dsh-ui-polish`                   | 1.0.0+  | inject-style motion + sidebar + settings polish     | `lib/client.js`                             |
| Updater Check      | `dsh-updater-check`               | 1.0.0   | update-check entry in settings                      | `lib/client.js`                             |
| Prompt Principles  | `dsh-prompt-principles`           | 1.0.0+  | layered prompt injection for Standard-like sessions | `client.js` + host `system-prompt/assemble` |
| Vision Router      | `dsh-vision-router`               | 1.7.1   | vision chain + 11 pixel tools                       | host + client                               |
| Better Sidebar     | `dsh-better-sidebar`              | 0.12.3  | file/browser/terminal/git workbench + service API   | lazy chunks                                 |
| Composition        | `deepseek-harness-composition`    | 1.0.0   | Opt-in MCP everything/Context7 + subagent providers | `cordis.patch.yml` only                     |
| Superpowers        | `dsh-superpowers`                 | 1.0.0+  | coding-mode gate + prompt injection                 | `lib/*`                                     |
| Anchored Standard  | `anchored-standard-plugin`        | 0.2.0   | progressive preset (`anchored-standard`)            | preset `agent.cordis.yml`                   |
| Superpowers Skills | `superpowers`                     | 6.2.0   | offline skill collection                            | `skills/**`                                 |
| Global Prompt      | `global-agent-prompt`             | —       | `protocol.md` operating protocol                    | `AGENTS.md`                                 |

All plugins are mounted through `dsh plugin --profile web add` using the bundled pnpm runtime; no manual `package.json` edits.

## Applicability

Project versions are exact even if newer upstream releases appear. Revalidate before dependency upgrades, package publication, or compatibility claims. The Routing Suite README describes router preset `0.3.0`, but its checked submodule ref and the router repository's published tags identify `0.2.0` at `eff787e`; this release therefore records the exact commit as authoritative and does not infer an unpublished version.

## Pinned Runtime Findings

- `dsh web --host 127.0.0.1 --port <port>` is the verified launch form; `/api/health` and `/api/` return 404 in rc.8.
- Electron allows BrowserWindow creation only after readiness and documents registering the macOS `activate` listener inside the fulfilled `app.whenReady()` callback.
- `resolveDshHome(undefined, env)` chooses a nonblank `DSH_HOME` or the official default `~/.dsh`; the desktop app passes that same path to migration, installation, preset/Skill synchronization, and `dsh web`.
- `dsh plugin --profile web add <package>` initializes the Web profile, delegates package installation to literal `pnpm`, and reconciles dependency-owned `dsh.bundle.patch` metadata while preserving unrelated dependencies and bundles.
- The app-generated pnpm launcher invokes the bundled pnpm entry with the auto-detected system official Node.js. It is visible only in the child command's private `PATH` (together with the system Node's bin directory, so native-module postinstall scripts find `node` even under a minimal GUI `PATH`).
- `--expose-internals` allows rc.8's `getOrInitializeCascadedLoader` path to work under Electron, so `dsh-find-plugin`, Super Injector, and Mode Boost use bare package names exactly as their official bundle patches declare.
- The rc.8 Agent Preset roster automatically scans `<DSH_HOME>/.agent-presets`. Preset-local `system-prompt/assemble`, `session/event`, and `agent/pre-step` hooks can implement event-derived schema phases without recompose or private transport mutation.
- The official Web boot graph in the packaged app contains 39+ client entries, including `@deepseek-ai/dsh-client-ui-user-questions` and `deepseek-harness-desktop-plugin`.
- rc.8 package scanning does not discover this graph from the tested ASAR layout, so the release uses an unpacked application tree.
- The desktop client adds no fixed conversation paint. React and UI primitives remain Harness-provided externals; `thinking-orbs@0.3.1` is bundled and rendered only through a standard portal object inside the current native status row. Preflight rejects unresolved Orb/controller imports.
- The rc.6/r.c8 conversation patch has three narrow effects: normal Definition state proves whether `turn/end` exists in O(1), Harness's existing timer is always painted, and the status label is static instead of shimmer-filled. An unexpectedly absent state still executes the original match scan. Assistant chunk ingestion, ordering, RAF/immediate publication selection, final-token handling, structural completion, timer source, and formatting remain official rc.8 behavior. Rollback removes the exact `patchedDependencies` mapping and regenerates the frozen lockfile, but must not proceed unless the 10,000-delta correctness/performance and immediate-clock regressions remain green against the replacement upstream version.
- The rc.8 sidebar patch adds only macOS-scoped padding to the existing sidebar root: `46px` expanded and `58px` collapsed. Global `html`, `body`, AppFrame, sidebar-surface, and main-surface insets remain forbidden.
- Routing Suite archive SHA-256 values are injector `355238fa8e51bc45c0801066af51e0e122f3b21411b193f601ee54e534391f48`, mode boost `72836d64bc465bc7c915e1bbc810d15ae0825dd4448350bcbf42c6e76efca12b`, and router preset `a8f3616fe4f5ed3951118dbc508239cf61dfcd5c763ed1ec9baafea886126676`. A mismatch is fatal to the build before `tar`; missing packaged routing resources remain fail-open for Standard startup.
