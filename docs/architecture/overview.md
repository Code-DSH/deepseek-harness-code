---
id: architecture.overview
title: System Architecture
summary: Implemented Electron shell, two-capability plugin bridge, managed progressive Agent Preset, and watchdog process boundaries.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, watchdog]
triggers: [architecture, IPC, security boundary]
read_when: [changing process ownership or public interfaces]
skip_when: [documentation-only wording fixes]
priority: must
freshness_class: project
last_verified: 2026-08-16T14:25:00+08:00
owners: [project]
source_of_truth: [../../apps, ../../packages]
related:
  prerequisites: [../project/intent.md]
  next: [./lifecycle.md, ./system.svg]
supersedes: []
tags: [architecture, electron]
---

# System Architecture

The implemented Electron main process owns BrowserWindow security policy, close behavior, local Harness lifecycle, and the narrow preload bridge. Harness runs as a child through Electron's embedded Node runtime with `DSH_HOME` at `<userData>/dsh-home`. The official-format plugin augments settings, diagnostics, theme, transitions, and conversation paint effects without replacing Harness sessions, Markdown rendering, or question protocols; its visible controls reuse the official Harness UI primitives and locale service. The detached Node-mode watchdog observes the desktop process over inherited OS IPC and only restarts after abnormal disconnect.

The host creates an idempotent, app-owned Web profile manifest containing the two official Web bundles plus `deepseek-harness-desktop-plugin`. Anchored Standard is not a Web profile bundle: the complete pinned preset is packaged as an extra resource and atomically synchronized to `<DSH_HOME>/.agent-presets/anchored-standard` on Harness startup. A versioned ownership marker and SHA-256 digest allow safe upgrades only when the installed copy is still app-owned and unmodified. An unknown or edited same-name directory is preserved and publishes `anchored-preset-conflict`; an invalid packaged source publishes `anchored-preset-unavailable` and disables only the optional preset. Standard remains available in both cases.

Within a selected Anchored Standard session, `system-prompt/assemble` exposes exactly `bash` and `str_replace_editor` before a durable tool call or assistant message exists. `agent/pre-step` filters only automatic `agent-instructions` and `skill-catalog` messages during that bootstrap phase. Promotion retains the Minimal pair plus `dev_tool_search`, `skill_search`, and `skill_load`; other tools appear only after an explicit `dev_tool_search` unlock recorded in durable session events. Compaction starts a new epoch with a controlled work set, and subagents start resident. Missing phase-required tools fail preset assembly instead of returning the full catalog.

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

The public types are defined in `apps/desktop/src/shared/contracts.ts`. `window.deepseekDesktop.preferences` only reads/writes the validated close behavior; the retired `anchoredStandard` field is accepted only while reading one legacy settings version and is removed on the next write. `window.deepseekDesktop.runtime` only reads/subscribes runtime state (including the bounded preset conflict/unavailable enums) and invokes restart/open-logs. The sandbox preload is self-contained: `zod` is bundled and the only runtime external is Electron.

## Conversation Effects Boundary

The desktop plugin registers `ConversationEffectsOverlay` through the official `shell.overlay` slot. Harness remains the source of truth for every message, reasoning disclosure, status live region, and layout box.

- `stream-output-model.js` accepts only newly appended grapheme clusters inside the current streaming assistant step. It validates the append boundary against segmentation of the complete next string, so combining marks, emoji modifiers, and ZWJ sequences cannot be detached from the preceding grapheme. It excludes user content, code, tools, terminals, controls, status labels, and hydrated history.
- `stream-output-controller.js` leaves React-owned text nodes untouched. Newly discovered streaming roots are baselined before descendant mutations can animate, preventing hydration and navigation replay. It masks only accepted appended ranges with CSS Custom Highlight, draws accessibility-hidden fixed duplicates with sampled font metrics and source color, and removes all paint resources on completion or cancellation. Missing Highlight support, reduced motion, and overflow beyond the 120-glyph live budget all leave canonical text visible.
- `thinking-status.js` recognizes only the direct polite status below `data-chat-flow`, without matching English copy. The overlay renders `ThinkingOrb` with `breathing`, 20-pixel, 2.0-speed props; a layout effect hides the native paint only after the Orb host commits. The original 26-pixel box and live-region semantics remain, and completed DeepSeek `Think` output is not changed.
- The controllers use observers and bounded animation frames, not polling. At most 120 copied glyphs and 24 particle-bearing glyphs (72 particle nodes) can be live; overload degrades to immediate canonical paint. They neither log nor persist response content. The five-second post-completion Chromium gate records no additional frames and no retained overlay, highlight, Orb, or status marker.
- esbuild creates one offline `client.js`: `thinking-orbs` and local controllers are inlined, while only Harness-provided React and UI primitives remain external. Runtime closure verifies the generated imports and packages the plugin-specific MIT notices.

## Related Documents

- Parent: [Architecture index](./index.md)
- Prerequisite: [Intent](../project/intent.md)
- Next: [Lifecycle](./lifecycle.md)

## Validation

The combined release gate passes 25 unit/state files / 97 tests, 108 vendored preset tests, 3 plugin/real-Harness files / 22 tests, 1 package file / 4 tests, and 5 Chromium tests. It covers the progressive preset lifecycle, official rc.6 roster/session creation, stream-output grapheme boundaries, hydration baselines, bounded burst behavior, paint-only geometry preservation, real ReactDOM/ThinkingOrb commit and cleanup, reduced-motion quiescence, runtime closure, and package structure. A prior real Electron run separately proved the grouped preload bridge, Standard workspace creation after compaction-peer repair, editable IME-capable composer, permission-menu persistence, official localized Button/Menu settings, password-field paste, and its host-level idle probe. Artifact evidence is recorded in the [acceptance report](../engineering/acceptance-report.md).
