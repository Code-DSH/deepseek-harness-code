---
id: operations.harness-home-migration
title: Harness Home Migration
summary: First-launch copy-only migration into the official Harness Home and official CLI reconciliation for bundled and legacy plugins.
kind: runbook
status: canonical
content_stage: implementation-backed
scope: [desktop, harness-home, plugins, skills]
triggers: [first launch, migration, plugin install, rollback]
read_when: [installing, upgrading, or diagnosing missing Harness data]
skip_when: [changing renderer-only behavior]
priority: must
freshness_class: project
last_verified: 2026-08-16T20:22:00+08:00
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

DeepSeek Harness Code and standalone DeepSeek Harness share one official Home. A nonblank `DSH_HOME` overrides the location; otherwise the pinned official resolver selects `~/.dsh`. Electron's `userData` directory remains only for desktop preferences, watchdog state, logs, and the generated pnpm launcher.

On every launch, the sequence is:

1. Resolve the official Home and the retired source at `<Electron userData>/dsh-home`.
2. Copy only target-absent supported data from the retired source.
3. Reconcile missing legacy profile dependencies and all integrated plugins through `dsh plugin --profile web add`.
4. Synchronize app-owned Superpowers Skills and Agent Presets.
5. Start `dsh web` with the same official Home and `--expose-internals`.

Repeated runs are idempotent. The public CLI retains unrelated dependencies and bundle entries.

## Data Rules

The copy allow-list is credentials, anonymous ID, settings, root patch/activity files, sessions, attachments, storages, Skills, Agent Presets, and Super Injector state. Profile manifests, lockfiles, and profile `node_modules` are not copied; their dependency declarations are read only to request equivalent public-CLI installation.

- The official target always wins a path conflict.
- Identical files are treated as unchanged.
- Symbolic links are skipped and never followed.
- Credentials and settings are written with mode `0600`; created directories use `0700`.
- A failed copy attempt removes only files/directories created by that attempt.
- The retired source is never deleted, renamed, or modified.

## Integrated Plugins

The app bundles and installs these packages using the same official mechanism as `dsh plugin add`:

- `deepseek-harness-desktop-plugin`
- `dsh-ui-motion`
- `dsh-model2-selector`
- `@dsh-external/dsh-super-injector`
- `@dsh-external/dsh-mode-boost`
- `dsh-find-plugin`

The generated `pnpm`/`pnpm.cmd` launcher points to the pnpm runtime inside the application and is prepended to the child command's private `PATH`. It does not change the user's shell or require a system Node/pnpm installation. The plugin patches retain bare package names.

## Conflict Diagnosis

Conflict and skipped-link paths are written as bounded startup diagnostics without file contents. If startup fails while reinstalling a legacy registry plugin, confirm network/registry availability and relaunch; the migration and official reconciliation safely retry. Existing official Home data and the retired source remain available.

## Rollback

Quit the app before inspection. Do not delete either Home. The retired source remains the pre-migration reference, while the official Home contains target-wins merged data. To compare or recover a particular target-absent file, copy that individual file from the retired source only after verifying that the official target does not contain a newer user-owned version. Reinstalling the desktop app does not clear either Home or unrelated plugins.

## Validation

The prior unit suite covers absent sources, nonconflicting merges, target-wins conflicts, modes, symlink rejection, plugin-spec normalization, rerun idempotence, and injected mid-copy rollback. The prior Electron Node-mode integration test uses bundled pnpm and the public CLI to install the original four packages, then starts the pinned Harness and fetches the desktop client from its boot graph. Release `0.3.3` extends the same coordinator with two compiled local plugin snapshots and checks their identities, entry/client closure, and bare-name patches both before packaging and inside the mounted DMG. The release build and mounted-image verifier both exited 0; the full previously green test suite was intentionally not rerun for this packaging-only addition.

## Related Documents

- Parent: [Operations index](./index.md)
- Prerequisite: [Unsigned installation](./install-unsigned.md)
- Related: [Architecture overview](../architecture/overview.md)
- Next: [Troubleshooting](./troubleshooting.md)

## Change Log

- `2026-08-16T19:00:00+08:00` — Documented the implementation-backed official single-Home migration and plugin installation contract.
- `2026-08-16T20:22:00+08:00` — Added the two installed local Web plugins to the immutable installer resources and official CLI reconciliation set.
