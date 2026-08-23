---
id: architecture.overview
title: System Architecture
summary: Electron shell with an official single Harness Home, validated warm plugin reconciliation, opt-in token-gated LAN proxy, managed presets, watchdog boundaries, and native Harness rendering.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, lan-access, routing-suite, skills, watchdog]
triggers: [architecture, IPC, security boundary]
read_when: [changing process ownership or public interfaces]
skip_when: [documentation-only wording fixes]
priority: must
freshness_class: project
last_verified: 2026-08-20T00:00:00+08:00
release_validation: beta2-2-pending-tag-ci
owners: [project]
source_of_truth: [../../apps, ../../packages]
related:
  prerequisites: [../project/intent.md]
  next: [./lifecycle.md, ./system.svg]
supersedes: []
tags: [architecture, electron]
---

# System Architecture

The Electron main process owns BrowserWindow security policy, close behavior, local Harness lifecycle, and the narrow preload bridge. The complete Code-DSH maintained family (`0.1.1-rc.2.code.1`) is built from the pinned `deps/deepseek-harness` submodule, packed into the app, and installed from local tarballs into app-owned user data. The child keeps the public DSH contracts and uses a nonblank `DSH_HOME` or `~/.dsh`. The renderer remains sandboxed and loopback-only; the detached Node-mode watchdog observes the desktop process over inherited OS IPC.

Before Harness starts, the host scans PATH and common Node installations, executes each candidate with `--version`, accepts Node 22.19+ and 24+ while rejecting Node 23, then installs the local maintained family plus exactly locked external dependencies. Plugin reconciliation continues through the public `dsh plugin --profile web add <package>` command. A validated app-owned marker suppresses repeated additions only when the managed roster, package roots and identities, profile dependencies, and pnpm store still match. The complete runtime supplies the Codex and Claude Code subagent packages, so composition contributes configuration without separate `linkOnly` installs or profile-manifest post-processing. Startup never installs or modifies a global `dsh`.

The DSH Routing Suite is another immutable app resource. The build fetches exact injector `0.3.3` (`355238fa...391f48`), mode-boost `0.1.0` (`72836d64...ca12b`), and router preset commit `eff787e95132d6c7104214542104a84d656b497e` (`a8f3616f...126676`), rejects any archive whose SHA-256 differs before extraction, and packages the verified tree. Injector and Mode Boost retain bare package names and public `dsh.bundle.patch` metadata; the Harness child receives `--expose-internals`. Routing code changes only with a reviewed app release.

Within a selected Anchored Standard session, `system-prompt/assemble` exposes exactly `bash` and `str_replace_editor` before a durable tool call or assistant message exists. `agent/pre-step` filters only automatic `agent-instructions` and `skill-catalog` messages during that bootstrap phase. Promotion retains the Minimal pair plus `dev_tool_search`, `skill_search`, and `skill_load`; other tools appear only after an explicit `dev_tool_search` unlock recorded in durable session events. Compaction starts a new epoch with a controlled work set, and subagents start resident. Missing phase-required tools fail preset assembly instead of returning the full catalog.

The Superpowers Coding Mode (`dsh-superpowers`) gates heavy tools (`subagent`, `subagent_fork`, `workflow`, `ralph`) behind an `auto/on/off` setting with a difficulty heuristic. Prompt-principles (`dsh-prompt-principles`) appends layered behavioral sections after `system-prompt/assemble` delegation for Standard-like sessions only. Vision routing (`dsh-vision-router`) provides an OVH-backed vision chain and 11 pixel tools; the sidebar workbench (`dsh-better-sidebar`) exposes a `ctx.betterSidebar` service for tab/viewer registration with lazy chunks. UI polish (`dsh-ui-polish`) and code-brand are inject-style client bundles that mount via `window.__ModuleLoader__`.

## Trust Boundaries

- Renderer: untrusted Web content with no Node integration.
- Preload: exactly five allow-listed capability groups (`preferences`, `lanAccess`, `runtime`, `updater`, and `bundledPlugins`) with validated mutation/state payloads.
- Main: process and filesystem authority limited to Electron-owned settings, the official Harness Home, bundled resources, and fixed actions.
- Harness: loopback-only HTTP server and official plugin host. The optional Electron-owned LAN reverse proxy is disabled by default; it may bind `0.0.0.0` only after user opt-in. Each native Copy action issues a fresh one-time URL token in Electron main and invalidates any prior unredeemed token; a redeemed token yields an HttpOnly cookie. The proxy forwards authenticated HTTP/WebSocket traffic to loopback and never returns a token-bearing URL to the renderer. The renderer remains on loopback. LAN HTTP is for a trusted LAN only: it is not Internet exposure and provides no TLS claim.
- Routing Suite: exact app-bundled snapshot only; no mutable runtime download or execution path.
- Watchdog: can relaunch only the validated fixed application executable/argument vector; exposes no network listener; removes `ELECTRON_RUN_AS_NODE` before relaunch.
- Plugins: each bundle's `cordis.patch.yml` declares its own loader row; client bundles run in the Harness Web sandbox as `window.__ModuleLoader__` modules.

## Implemented Host Contract

- IPC channels are fixed to `runtime:get`, `runtime:restart`, `runtime:changed`, `logs:open`, `preferences:get`, `preferences:set`, `lan-access:get`, `lan-access:set`, `lan-access:copy-url`, `updater:check`, `bundled-plugins:list`, and the send-only `clipboard:paste` alias. The alias accepts only trusted macOS `Control+V` keyboard events, pastes into its originating WebContents, rejects page-script synthetic events, and is not exposed in the public bridge.
- BrowserWindow uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- The packaged `apps/desktop/src/startup.html` is the only file navigation exception. After startup, only the exact current HTTP loopback origin is allowed in-app; external HTTPS opens through the system browser and redirects use the same policy.
- Harness readiness requires a live child and a 2xx Web-root response with a five-second request timeout. The host reloads the newly allocated origin after recovery.
- Startup diagnostics are bounded, redacted, and detached once the child is ready.
- The detached Watchdog uses inherited OS IPC only. State, marker, and 10 MB × five-file logs are constrained to `<userData>/watchdog`; normal quit awaits an acknowledgement before disconnect.
- The package intentionally uses an unpacked application tree (`asar: false`). The empty-client-graph failure was established against rc.8; BETA3 preserves the verified unpacked boundary while upgrading Harness to 0.1.1-rc.2, without exposing Node to the renderer.
- Packaged extra resources include `routing-suite/`, `superpowers-skills/`, `global-agent-prompt`, `desktop-plugin`, `dsh-ui-motion`, `dsh-model-two-level-selector`, `dsh-ui-polish`, `dsh-updater-check`, `dsh-lan-access`, `prompt-principles-plugin`, `dsh-vision-router`, `better-sidebar`, `anchored-standard-plugin`, and `app-composition`. Plugin roots are installed by the public CLI from immutable app resources; Skills and managed presets use ownership-safe synchronization into the official Home.

## Public Bridge

The public types are defined in `apps/desktop/src/shared/contracts.ts`. `window.deepseekDesktop.preferences` reads the persisted close/LAN state and only accepts validated close-behavior writes. `lanAccess` exposes validated redacted state, enable/disable, and a main-process-only Copy action; it never returns the token-bearing URL. `runtime` reads/subscribes runtime state and invokes restart/open-logs, `updater` exposes the fixed update check, and `bundledPlugins` lists the fixed packaged inventory surface. The sandbox preload is self-contained: `zod` is bundled and the only runtime external is Electron.

## Frontend Layering Boundary

The official renderer owns all conversation paint. Its effective hierarchy is:

```text
BrowserWindow web contents
└─ Harness AppFrame (`position: relative; overflow: hidden`)
   ├─ Sidebar column
   ├─ Center column
   │  └─ Conversation shell
   │     ├─ Header and tabs
   │     ├─ Scroll body → ChatView → `[data-chat-flow]`
   │     │  └─ Assistant reasoning → Think row (`position: relative; overflow: hidden`)
   │     └─ Sticky composer (`z-index: 7` while active)
   └─ `shell.overlay` (`position: absolute; inset: 0; z-index: 20`)
```

`shell.overlay` is a root-level modal/overlay layer, not a child of the chat flow. A fixed-position child placed there bypasses the Think row's clipping and native mask, so the desktop plugin never paints a fixed conversation visual or hides the native polite status. Its second slot registration is only a React lifecycle seat: the returned standard portal object targets the current direct native status row. That row remains Harness-owned and receives one non-interactive 20-pixel `ThinkingOrb` host with `position: relative`, `z-index: 1`, and `order: -1`; completion, replacement, navigation, or disposal removes it. The maintained 0.1.1-rc.2.code.1 conversation source exposes Harness's own clock from `0s` and removes only the label shimmer. Streamed prose, reasoning, Markdown, token ordering, scrolling, clipping, and live-region semantics stay inside the Harness component tree.

On macOS, `html`, `body`, the renderer root, sidebar surface, and main surface retain full-window geometry. The maintained sidebar source moves only its inner content below the native traffic lights: expanded mode computes `46px` top padding and collapsed mode `58px`. Windows and Linux receive neither rule. Esbuild emits one offline `client.js`; React and Harness UI primitives remain renderer-provided, while `thinking-orbs@0.3.1` is bundled with its MIT notice.

The better-sidebar workbench extends this boundary with a right-dock and bottom panel, lazy-chunked editors/terminals, and a service registry that third-party plugins consume through `ctx.betterSidebar.registerTab` / `registerFileViewer`. The code-brand badge is a `pointer-events: none` overlay positioned between the HARNESS lockup and the collapse button. UI-polish manages its toggles through `data-uip-*` attributes on `<html>`.

## Related Documents

- Parent: [Architecture index](./index.md)
- Prerequisite: [Intent](../project/intent.md)
- Next: [Lifecycle](./lifecycle.md)

## Validation

The prior BETA2-1 baseline passed unit, 108 Anchored Standard, 24 plugin/real-Harness, 39 package-contract, Chromium e2e, structural, runtime-closure, and Universal packaging gates. BETA2-2 expands Anchored Standard to 116 tests and adds warm-reconciliation, LAN-proxy, Windows workspace-boundary, packaged LAN-resource, and smoke-evidence contracts. Tag Run `32502448560` verifies the distributable on native Windows/Linux x64+arm64 and macOS Intel/Apple Silicon; repaired Run `32505104693` adds explicit macOS no-Node evidence. Details remain in the [acceptance report](../engineering/acceptance-report.md).
