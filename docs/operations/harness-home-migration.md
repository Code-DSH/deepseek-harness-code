---
id: operations.harness-home-migration
title: Harness Home Migration
summary: First-launch copy-only migration into DSH_HOME and public CLI reconciliation for bundled and legacy plugins.
kind: runbook
status: canonical
content_stage: implementation-backed
scope: [desktop, harness-home, plugins, skills]
triggers: [first launch, migration, plugin install, rollback]
read_when: [installing, upgrading, or diagnosing missing Harness data]
skip_when: [changing renderer-only behavior]
priority: must
freshness_class: project
last_verified: 2026-08-20T00:00:00+08:00
owners: [project]
source_of_truth:
  - ../../apps/desktop/src/lifecycle/desktop-plugin-link.ts
  - ../../apps/desktop/src/main.ts
related:
  prerequisites: [./install-unsigned.md]
  next: [./troubleshooting.md]
supersedes: []
tags: [migration, official-cli, dsh-home]
---

# Harness Home Migration

## Current Contract

DeepSeek Harness Code and standalone DeepSeek Harness share one Home. A nonblank `DSH_HOME` overrides the location; otherwise the maintained resolver selects `~/.dsh`. Electron's `userData` directory remains for desktop preferences, watchdog state, logs, the app-owned package runtime, and launcher shims.

On every launch, the sequence is:

1. Resolve DSH Home and the retired source at `<Electron userData>/dsh-home`.
2. Copy only target-absent supported data from the retired source.
3. Validate the integrated-plugin profile links and managed pnpm store. A complete profile created by an older release is adopted and receives the current reconciliation marker; only missing or incompatible state reconciles dependencies through `dsh plugin --profile web add`.
4. Synchronize app-owned Superpowers Skills and Agent Presets, plus the Global Agent Prompt.
5. Start maintained `dsh web` with the same Home and `--expose-internals`.

Repeated runs are idempotent. The public CLI retains unrelated dependencies and bundle entries.

## Data Rules

The copy allow-list is credentials, anonymous ID, settings, root patch/activity files, sessions, attachments, storages, Skills, Agent Presets, and Super Injector state. Profile manifests, lockfiles, and profile `node_modules` are not copied; their dependency declarations are read only to request equivalent public-CLI installation.

- The existing target always wins a path conflict.
- Identical files are treated as unchanged.
- Symbolic links are skipped and never followed.
- Credentials and settings are written with mode `0600`; created directories use `0700`.
- A failed copy attempt removes only files/directories created by that attempt.
- The retired source is never deleted, renamed, or modified.

## Integrated Plugins

The app installs these packages through the public `dsh plugin add` mechanism using Node 22.19+ or 24+ and bundled pnpm. The DSH family itself comes only from the Code-DSH submodule tarballs:

- `deepseek-harness-desktop-plugin`
- `dsh-ui-motion@1.1.0`
- `dsh-model2-selector@1.1.0`
- `dsh-ui-polish`
- `dsh-updater-check@1.0.0`
- `dsh-prompt-principles`
- `dsh-vision-router@1.7.1`
- `dsh-better-sidebar@0.12.3`
- `dsh-superpowers` (coding-mode gate)
- `@dsh-external/dsh-super-injector@0.3.3`
- `@dsh-external/dsh-mode-boost@0.1.0`
- `dsh-find-plugin@0.3.6`
- `deepseek-harness-composition` (local MCP everything, opt-in Context7, subagent codex/claude)
- `anchored-standard` preset (synchronized as Agent Preset, not a Web bundle)

The generated `pnpm`/`pnpm.cmd` launcher points to the pnpm runtime inside the application and is prepended to the child command's private `PATH` with the detected Node bin. It does not change the user's shell or require system pnpm. Startup never installs a global `dsh`; plugin patches retain bare package names under `--expose-internals`.

## Conflict Diagnosis

Conflict and skipped-link paths are written as bounded startup diagnostics without file contents. If startup fails while reinstalling a legacy registry plugin, confirm network/registry availability and relaunch; the migration and official reconciliation safely retry. Existing official Home data and the retired source remain available. A corrupted profile `node_modules` (e.g., self-referential symlink) is detected and rebuilt once before failing.

## Rollback

Quit the app before inspection. Do not delete either Home. The retired source remains the pre-migration reference, while the official Home contains target-wins merged data. To compare or recover a particular target-absent file, copy that individual file from the retired source only after verifying that the official target does not contain a newer user-owned version. Reinstalling the desktop app does not clear either Home or unrelated plugins.

## Validation

The prior unit suite covers absent sources, nonconflicting merges, target-wins conflicts, modes, symlink rejection, plugin-spec normalization, rerun idempotence, and injected mid-copy rollback. The prior Electron Node-mode integration test uses bundled pnpm and the public CLI to install the original four packages, then starts the pinned Harness and fetches the desktop client from its boot graph. Release `0.1.0-BETA2` extends the same coordinator to 8 plugins plus composition/superpowers/routing and checks their identities, entry/client closure, and bare-name patches both before packaging and inside the mounted DMG. The release build and mounted-image verifier both exit 0; the previously green test suite remains the package gate.

## Related Documents

- Parent: [Operations index](./index.md)
- Prerequisite: [Unsigned installation](./install-unsigned.md)
- Related: [Architecture overview](../architecture/overview.md)
- Next: [Troubleshooting](./troubleshooting.md)

## Change Log

- `2026-08-20T00:00:00+08:00` — Expanded to 8 integrated plugins + composition/superpowers; documented Global Prompt sync and bare-name + --expose-internals contract.
- `2026-08-16T20:22:00+08:00` — Added the two installed local Web plugins to the immutable installer resources and official CLI reconciliation set.
- `2026-08-16T19:00:00+08:00` — Documented the implementation-backed official single-Home migration and plugin installation contract.
