---
id: architecture.overview
title: System Architecture
summary: Implemented DeepSeek Harness Code Electron shell, two-capability plugin bridge, integrated bundles, and watchdog process boundaries.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, watchdog]
triggers: [architecture, IPC, security boundary]
read_when: [changing process ownership or public interfaces]
skip_when: [documentation-only wording fixes]
priority: must
freshness_class: project
last_verified: 2026-08-16T11:18:00+08:00
owners: [project]
source_of_truth: [../../apps, ../../packages]
related:
  prerequisites: [../project/intent.md]
  next: [./lifecycle.md, ./system.svg]
supersedes: []
tags: [architecture, electron]
---

# System Architecture

The implemented Electron main process owns BrowserWindow security policy, close behavior, local Harness lifecycle, and the narrow preload bridge. Harness runs as a child through Electron's embedded Node runtime with `DSH_HOME` at `<userData>/dsh-home`. The official-format plugin augments settings, diagnostics, theme, and transitions without replacing Harness sessions or question protocols; its visible controls reuse the official Harness UI primitives and locale service. The detached Node-mode watchdog observes the desktop process over inherited OS IPC and only restarts after abnormal disconnect.

The host creates an idempotent, app-owned Web profile manifest containing the two official Web bundles plus `deepseek-harness-desktop-plugin`. When the validated `anchoredStandard` preference is enabled, it also links and registers `dsh-anchored-standard`; disabling the setting removes that bundle from the profile and the official settings plugin requests a Harness restart. The production desktop plugin supplies an HMR-compatible no-op registration service because the pinned rc.6 Web profile expects the service even in a packaged build. Anchored Standard publishes an explicit safe-fallback marker; rc.6 does not allow catalog recomposition after an agent has produced output.

## Trust Boundaries

- Renderer: untrusted Web content with no Node integration.
- Preload: exactly two allow-listed capability groups and validated payloads.
- Main: process and filesystem authority limited to app-owned data and fixed actions.
- Harness: loopback-only HTTP server and official plugin host.
- Watchdog: can relaunch only the validated fixed application executable/argument vector; exposes no network listener; removes `ELECTRON_RUN_AS_NODE` before relaunch.

## Implemented Host Contract

- IPC channels are fixed to `runtime:get`, `runtime:restart`, `runtime:changed`, `logs:open`, `preferences:get`, `preferences:set`, and the send-only `clipboard:paste` alias. The alias accepts only trusted macOS `Control+V` keyboard events, pastes into its originating WebContents, rejects page-script synthetic events, and is not exposed in the public bridge.
- BrowserWindow uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- The packaged `apps/desktop/src/startup.html` is the only file navigation exception. After startup, only the exact current HTTP loopback origin is allowed in-app; external HTTPS opens through the system browser and redirects use the same policy.
- Harness readiness requires a live child and a 2xx Web-root response with a five-second request timeout. The host reloads the newly allocated origin after recovery.
- Startup diagnostics are bounded, redacted, and detached once the child is ready.
- The detached Watchdog uses inherited OS IPC only. State, marker, and 10 MB × five-file logs are constrained to `<userData>/watchdog`; normal quit awaits an acknowledgement before disconnect.
- The package intentionally uses an unpacked application tree (`asar: false`). With rc.6, package discovery through `createRequire` returned an empty client graph inside ASAR; the unpacked tree restored all 39 official/plugin client entries without exposing Node to the renderer.

## Public Bridge

The public types are defined in `apps/desktop/src/shared/contracts.ts`. `window.deepseekDesktop.preferences` only reads/writes the validated close/experimental-mode preferences. `window.deepseekDesktop.runtime` only reads/subscribes runtime state and invokes restart/open-logs. The sandbox preload is self-contained: `zod` is bundled and the only runtime external is Electron.

## Related Documents

- Parent: [Architecture index](./index.md)
- Prerequisite: [Intent](../project/intent.md)
- Next: [Lifecycle](./lifecycle.md)

## Validation

The current suite passes 21 unit files / 76 tests, 3 plugin files / 15 tests, and 1 package file / 4 tests. A real Electron run proved the grouped preload bridge, Standard workspace creation after compaction-peer repair, editable IME-capable composer, permission-menu persistence, official localized Button/Menu settings, password-field paste, and an idle five-second interval with zero layouts and a 456-byte JS-heap delta. See the [acceptance report](../engineering/acceptance-report.md).
