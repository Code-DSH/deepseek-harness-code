---
id: design.deepseek-harness-code
title: DeepSeek Harness Code Desktop Design
summary: Cross-platform desktop shell, official UI plugin integration, self-contained packaging, and an optional rc.6 progressive Anchored Standard Agent Preset.
kind: architecture
status: canonical
content_stage: partial-implementation
scope: [desktop, plugin, packaging, performance, branding]
triggers: [DeepSeek Harness Code, loading UI, close behavior, anchored standard]
read_when: [implementing the 2026-08-16 scope expansion]
skip_when: [unrelated maintenance]
priority: must
freshness_class: project
last_verified: 2026-08-16T13:06:11+08:00
owners: [primary-agent]
source_of_truth: [user request, ../../../apps, ../../../packages]
related:
  prerequisites: [../../project/intent.md]
  next:
    [
      ./2026-08-16-macos-traffic-light-inset-design.md,
      ../plans/2026-08-16-deepseek-harness-code.md,
    ]
supersedes: []
tags: [design, electron, harness-plugin]
---

# DeepSeek Harness Code Desktop Design

## Decision

The product and application display name become **DeepSeek Harness Code**. The existing Electron, official Harness bundle plugin, and independent Watchdog boundaries remain. This scope change is user-authorized for autonomous recommended-choice execution and does not require another approval round.

## User experience

- macOS uses an underlay title bar with only the three native traffic-light controls visible. Harness content starts at the window top; the controls use the equal native inset defined by the [macOS traffic-light design](./2026-08-16-macos-traffic-light-inset-design.md), without adding a Web title bar or moving renderer content.
- Windows and Linux use native window controls and the same Web plugin styling without macOS-only offsets.
- The startup surface contains only a pure white or pure black system-matched background and one centered monochrome spinner; it has no card, wordmark, copy, gradient, or accent color.
- The official General settings page contains the close behavior setting built from official Harness Button/Menu primitives. Closing may quit or keep the host alive in the tray/menu bar; the first close retains the one-time choice dialog.
- A real tray icon and Open/Restart/Logs/Quit menu exist on all desktop platforms; macOS keeps its Dock presence.

## Two desktop plugin APIs

The Web plugin connects to the external Electron host through exactly two capability groups:

1. `desktop.preferences`: read/write the validated `closeBehavior` preference. The retired `anchoredStandard` field is discarded from one legacy persisted shape and is not exposed by IPC.
2. `desktop.runtime`: read/subscribe runtime state and invoke the bounded `restartHarness` and `openLogs` actions.

The preload exposes no shell, arbitrary path, generic IPC, credential, prompt, or response access. Cordis host metadata remains read-only. The official question service and `QuestionComposer` remain untouched.

## Loading and title-bar integration

The local startup page owns only the monochrome spinner loading view. The official Harness client receives a scoped stylesheet through the desktop plugin. The stylesheet uses stable semantic/data selectors, a platform data attribute, and CSS variables for title-bar height/safe inset. Visible settings controls come from `@deepseek-ai/dsh-client-ui-primitives`; local CSS only supplies layout, alignment, and overflow constraints. It does not rewrite the information architecture.

Transition code reacts to route changes once per committed DOM update. It uses View Transitions when available and an animation-token CSS fallback otherwise. It never forces layout with `offsetWidth`, and the mutation observer disconnects after the relevant commit.

## Runtime reliability

The packaged preload is self-contained; sandboxed preload code may import Electron but has no unresolved package requires. Packaging includes the complete dependency closure for the pinned `standard` preset. A package smoke test creates the preset and fails on missing peer/runtime dependencies before release.

Renderer failure still rebuilds only the window, while Harness and Watchdog stay alive. The host records bounded, redacted diagnostics and never logs credentials or request bodies.

## Experimental anchored-standard plugin

`dsh-anchored-standard` is integrated as an official Agent Preset, not a Web bundle. The packaged copy is atomically installed into the app-private Harness home. The official new-session preset selector exposes it while Standard stays default. A same-ID user preset or locally edited managed copy is preserved and produces a bounded settings notice.

The preset uses rc.6 `system-prompt/assemble`, `session/event`, and `agent/pre-step` hooks inside the agent plane. A fresh top-level session receives exactly `bash` and `str_replace_editor`; the first durable tool call or assistant message promotes to the bootstrap pair plus resident discovery tools, and `dev_tool_search` unlocks additional capabilities durably. Compaction creates a new controlled epoch and subagents start resident. Missing required tools fail the selected preset instead of exposing Standard. No private request field, hidden reasoning, or cross-device warmed state is captured or replayed, and the community score remains an unverified experimental motivation.

## Packaging and migration

- Bundle id: `community.deepseek.harness.code`; version advances to `0.2.0`.
- macOS: Universal app and DMG, ad-hoc signed, targeted quarantine guidance.
- Windows: NSIS installer; Linux: AppImage and deb, produced by a platform CI matrix when local cross-build tooling is unavailable.
- All official and project plugins are part of the installer. No global Node or pnpm is required.
- Existing user data is retained via an explicit legacy data-path migration policy. Secrets are never copied into logs or repository files.
- The generated icon keeps the official mark, scales it down, and adds `Code`; raster/ICNS/ICO assets are generated deterministically.
- After the renamed app is verified, the obsolete installed `/Applications/DeepSeek Harness.app` is moved to Trash. Build artifacts are replaced, not mistaken for duplicate installations.

## Verification

Acceptance requires red-to-green tests for preload bundling, Standard preset dependency closure, two-API validation, close/tray behavior, startup rendering, animation performance, Anchored bootstrap/promotion/resume/compaction/strict failure, managed lifecycle conflicts, branding, and package matrices. The pinned real Harness must list and create a session with the preset while reporting Standard as default. Live-provider quality comparison remains optional and credential-gated.

## Packaging implementation record

`electron-builder.yml` now carries the `community.deepseek.harness.code` identity, `DeepSeek Harness Code` display name, ad-hoc macOS Universal DMG target, Windows NSIS target, and Linux AppImage/deb targets. `scripts/build-icon.mjs` generates a black official-mark-derived `deepseek-harness-code.svg` and its ICNS, ICO, and PNG derivatives. `.github/workflows/package.yml` defines native macOS, Windows, and Linux x64 package jobs; ARM64 Windows/Linux artifacts require a matching native runner or explicit cross-architecture dependency validation before release.
