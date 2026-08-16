---
id: design.official-harness-install
title: Official Harness Installation and Single-Home Design
summary: Run the embedded Harness against its official single home and install every bundled plugin through the public dsh plugin command without deleting user data or plugins.
kind: architecture
status: canonical
content_stage: goal-only
scope: [desktop-host, harness-home, plugins, migration, packaging]
triggers: [DSH_HOME, plugin install, migration, packaged runtime]
read_when:
  [
    changing Harness startup,
    bundled plugin installation,
    or user-data locations,
  ]
skip_when: [changing renderer-only presentation]
priority: must
freshness_class: project
last_verified: 2026-08-16T18:40:00+08:00
owners: [primary-agent]
source_of_truth:
  - user confirmation of architecture A
  - https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/src/plugin.ts
  - pinned @deepseek-ai/dsh@0.1.0-rc.6 package
related:
  prerequisites: [./2026-08-16-deepseek-harness-code-design.md]
  next: [../plans/2026-08-16-official-harness-install.md]
supersedes: []
tags: [official-cli, pnpm, migration, dsh-home]
---

# Official Harness Installation and Single-Home Design

## Decision

DeepSeek Harness Code remains a self-contained desktop distribution: the application bundle owns the pinned Harness runtime and package-manager runtime, while Harness user data lives in the one root resolved by the official `@deepseek-ai/dsh-home-paths` helper. The default is `~/.dsh`; an explicit nonblank `DSH_HOME` keeps the official override semantics.

The first launch after installation or upgrade runs the bundled `dsh plugin --profile web add <package>` command for every integrated Web plugin. The command receives a private app-owned `PATH` entry that exposes bundled pnpm, so it uses the same profile initialization, dependency installation, and bundle reconciliation as standalone Harness. Desktop code no longer creates profile `node_modules` links, initializes profile manifests, appends `dsh.profile.bundles`, or injects mode-boost into the profile user patch.

## Runtime and plugin set

- Launch `dsh web` through Electron Node mode with `--expose-internals` before the CLI entry. This restores the rc.6 native cascaded loader and permits official bare package names in bundle patches.
- Install `deepseek-harness-desktop-plugin`, `@dsh-external/dsh-super-injector`, `@dsh-external/dsh-mode-boost`, and pristine `dsh-find-plugin@0.3.6` through the official CLI.
- Add official `dsh.bundle.patch` metadata to the packaged mode-boost snapshot so official reconciliation can activate it. Its patch uses the bare package name.
- Keep Anchored Standard, router presets, and Superpowers skills separate from plugin installation because rc.6 exposes no generic arbitrary-preset/skill install command. They retain conflict-aware managed synchronization, but target the official Home.

## First-launch coordination

The app resolves the official Home once and passes the same absolute path to migration, plugin installation, and the Harness child. A versioned app-data marker may skip package-manager work only after the target profile manifest still contains the exact managed dependency specifications. Missing or altered managed dependencies trigger official reconciliation again; unrelated dependencies and bundles are never removed.

On macOS DMG installs this occurs before Harness starts on first application launch because drag-copy installation has no safe post-install hook. Replacing the application updates the embedded runtime; it does not overwrite a separately installed global `dsh` executable.

## Migration and rollback

The legacy source is `<Electron userData>/dsh-home`; the official target is the resolved Harness Home. Migration runs before plugin installation and never removes or renames the source.

- Copy only target-absent sessions, attachments, storages, skills, presets, settings, credentials, anonymous ID, and other explicitly allow-listed Harness data.
- Do not follow symbolic links and do not copy legacy `profiles/**/node_modules`, lockfiles, or profile manifests.
- Treat a target-existing path as authoritative. Record a conflict without reading credential contents or overwriting either side.
- Extract legacy profile dependencies as package-manager arguments. Preserve target-installed dependencies; install only missing legacy packages plus the fixed integrated package set.
- Keep scalar secrets at mode `0600`, directories at `0700`, diagnostics bounded, and logs free of file contents.
- Apply copied files transactionally. On failure, remove only files created by the current attempt. The intact legacy Home is the rollback source for the previous application version.

After a successful cutover, the desktop app reads and writes only the official Home. Electron caches, preferences, migration reports, installer markers, and watchdog logs remain under Electron `userData`.

## Acceptance

1. A real isolated `dsh plugin` run initializes `profiles/web`, installs all managed packages, and produces bare-name bundle entries without desktop manifest editing.
2. Repeated reconciliation is idempotent and preserves unrelated target dependencies and bundles.
3. Legacy-only, official-only, both-root, conflict, partial-failure, permission, and repeat-run migrations are covered.
4. `dsh web` receives `--expose-internals`; plugin patches no longer use `./node_modules/...` names.
5. Packaging contains the pnpm runtime, pristine find plugin, mode-boost bundle metadata, and all existing offline resources.
6. Typecheck, tests, lint, formatting, docs, security, runtime closure, and real-Harness integration pass.
