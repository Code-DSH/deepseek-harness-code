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
owners: [project]
source_of_truth: [../../apps, ../../packages]
related:
  prerequisites: [../project/intent.md]
  next: [./lifecycle.md, ./system.svg]
supersedes: []
tags: [architecture, electron]
---

# System Architecture

The implemented Electron main process owns BrowserWindow security policy, close behavior, local Harness lifecycle, and the narrow preload bridge. Harness (`@deepseek-ai/dsh@0.1.0-rc.8`) runs as a child of the auto-detected system official Node.js (>=22.13) with the Home returned by the official `@deepseek-ai/dsh-home-paths@0.1.0-rc.8` resolver: nonblank `DSH_HOME` when configured, otherwise `~/.dsh`. The official-format plugin ecosystem (9 bundles including `dsh-lan-access`, plus composition + routing) augments settings, diagnostics, theme, desktop chrome, vision, sidebar, LAN controls, and the native running-status row without replacing Harness sessions, Markdown rendering, status semantics, elapsed-time ownership, or question protocols; visible controls reuse the official Harness UI primitives and locale service. The detached Node-mode watchdog observes the desktop process over inherited OS IPC and only restarts after abnormal disconnect.

Before Harness starts, the host resolves the system official Node.js (>=22.13, no upper bound) by scanning the PATH, common install locations (nodejs.org installer, Homebrew, nvm, Volta, fnm, mise, n, Scoop, nvm-windows, Chocolatey), and version-manager roots such as `NVM_DIR`/`VOLTA_HOME`/`FNM_DIR`, then installs the pinned Harness packages into app-owned user data and invokes the public `dsh plugin --profile web add <package>` command for `deepseek-harness-desktop-plugin`, `dsh-ui-motion`, `dsh-model2-selector`, `dsh-ui-polish`, `dsh-updater-check`, `dsh-prompt-principles`, `dsh-vision-router`, `dsh-better-sidebar`, `dsh-lan-access`, `dsh-superpowers`, Super Injector, Mode Boost, `dsh-find-plugin`, and the app composition bundle (MCP everything + Context7, subagent codex/claude). A validated app-owned marker suppresses those serial official CLI additions only when the complete managed package roster is unchanged and its package roots/identities, expected profile dependencies, and managed pnpm store are still present. A missing marker, changed package root or identity, missing profile dependency, or foreign store repeats the official reconciliation. When reconciliation fails on a corrupted derived profile `node_modules` (for example a self-referential symlink left by an interrupted install), the host removes that derived output once and retries the whole official flow. A private launcher puts the system Node and the bundled pnpm runtime on the child's `PATH`; the official CLI therefore owns profile initialization, dependency placement, bundle ordering, and idempotent reconciliation. The desktop layer never creates profile links or edits profile manifests, bundle lists, or user patch YAML. Anchored Standard is not a Web profile bundle: the complete pinned preset is packaged as an extra resource and atomically synchronized to `<DSH_HOME>/.agent-presets/anchored-standard` on Harness startup. A versioned ownership marker and SHA-256 digest allow safe upgrades only when the installed copy is still app-owned and unmodified. The bundled Global Agent Operating Protocol follows the same ownership model for the user-level `<DSH_HOME>/AGENTS.md`: installed when absent, upgraded only while app-managed and unmodified, never overwriting a user-authored prompt, with a backup-safe menu action to switch explicitly.

The DSH Routing Suite is another immutable app resource. The build fetches exact injector `0.3.3` (`355238fa...391f48`), mode-boost `0.1.0` (`72836d64...ca12b`), and router preset commit `eff787e95132d6c7104214542104a84d656b497e` (`a8f3616f...126676`), rejects any archive whose SHA-256 differs before extraction, and packages the verified tree. Injector and Mode Boost retain bare package names and official `dsh.bundle.patch` metadata; the Harness child receives `--expose-internals`, restoring rc.8's native cascaded loader in Electron. Startup manages only `router-standard` and `router-spec` outside the CLI, using the ownership-preserving preset installer. The installed app has no Routing Suite network updater; routing code changes only with a reviewed app release. Alongside Harness startup, the host provisions the global `dsh` command through the official `npm install -g` flow with the manifest-pinned version — installing it when missing, respecting a user-managed global installation, and degrading to a logged one-line manual command without ever blocking startup.

Within a selected Anchored Standard session, `system-prompt/assemble` exposes exactly `bash` and `str_replace_editor` before a durable tool call or assistant message exists. `agent/pre-step` filters only automatic `agent-instructions` and `skill-catalog` messages during that bootstrap phase. Promotion retains the Minimal pair plus `dev_tool_search`, `skill_search`, and `skill_load`; other tools appear only after an explicit `dev_tool_search` unlock recorded in durable session events. Compaction starts a new epoch with a controlled work set, and subagents start resident. Missing phase-required tools fail preset assembly instead of returning the full catalog.

The Superpowers Coding Mode (`dsh-superpowers`) gates heavy tools (`subagent`, `subagent_fork`, `workflow`, `ralph`) behind an `auto/on/off` setting with a difficulty heuristic. Prompt-principles (`dsh-prompt-principles`) appends layered behavioral sections after `system-prompt/assemble` delegation for Standard-like sessions only. Vision routing (`dsh-vision-router`) provides an OVH-backed vision chain and 11 pixel tools; the sidebar workbench (`dsh-better-sidebar`) exposes a `ctx.betterSidebar` service for tab/viewer registration with lazy chunks. UI polish (`dsh-ui-polish`) and code-brand are inject-style client bundles that mount via `window.__ModuleLoader__`.

## Trust Boundaries

- Renderer: untrusted Web content with no Node integration.
- Preload: exactly two allow-listed capability groups and validated payloads.
- Main: process and filesystem authority limited to Electron-owned settings, the official Harness Home, bundled resources, and fixed actions.
- Harness: loopback-only HTTP server and official plugin host. The optional Electron-owned LAN reverse proxy is disabled by default; it may bind `0.0.0.0` only after user opt-in, token-gates HTTP/WebSocket forwarding to loopback, keeps the token-bearing URL in Electron main, and exposes Copy as a native main-process action. The renderer remains on loopback. LAN HTTP is for a trusted LAN only: it is not Internet exposure and provides no TLS claim.
- Routing Suite: exact app-bundled snapshot only; no mutable runtime download or execution path.
- Watchdog: can relaunch only the validated fixed application executable/argument vector; exposes no network listener; removes `ELECTRON_RUN_AS_NODE` before relaunch.
- Plugins: each bundle's `cordis.patch.yml` declares its own loader row; client bundles run in the Harness Web sandbox as `window.__ModuleLoader__` modules.

## Implemented Host Contract

- IPC channels are fixed to `runtime:get`, `runtime:restart`, `runtime:changed`, `logs:open`, `preferences:get`, `preferences:set`, and the send-only `clipboard:paste` alias. The alias accepts only trusted macOS `Control+V` keyboard events, pastes into its originating WebContents, rejects page-script synthetic events, and is not exposed in the public bridge.
- BrowserWindow uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- The packaged `apps/desktop/src/startup.html` is the only file navigation exception. After startup, only the exact current HTTP loopback origin is allowed in-app; external HTTPS opens through the system browser and redirects use the same policy.
- Harness readiness requires a live child and a 2xx Web-root response with a five-second request timeout. The host reloads the newly allocated origin after recovery.
- Startup diagnostics are bounded, redacted, and detached once the child is ready.
- The detached Watchdog uses inherited OS IPC only. State, marker, and 10 MB × five-file logs are constrained to `<userData>/watchdog`; normal quit awaits an acknowledgement before disconnect.
- The package intentionally uses an unpacked application tree (`asar: false`). With rc.8, package discovery through `createRequire` returned an empty client graph inside ASAR; the unpacked tree restored all 39 official/plugin client entries without exposing Node to the renderer.
- Packaged extra resources include `routing-suite/`, `superpowers-skills/`, `global-agent-prompt`, `desktop-plugin`, `dsh-ui-motion`, `dsh-model-two-level-selector`, `dsh-ui-polish`, `dsh-updater-check`, `prompt-principles-plugin`, `dsh-vision-router`, `better-sidebar`, `anchored-standard-plugin`, and `app-composition`. Plugin roots are installed by the public CLI from immutable app resources; Skills and managed presets use ownership-safe synchronization into the official Home.

## Public Bridge

The public types are defined in `apps/desktop/src/shared/contracts.ts`. `window.deepseekDesktop.preferences` only reads/writes the validated close behavior; the retired `anchoredStandard` field is accepted only while reading one legacy settings version and is removed on the next write. `window.deepseekDesktop.runtime` only reads/subscribes runtime state (including the bounded preset conflict/unavailable enums) and invokes restart/open-logs. The sandbox preload is self-contained: `zod` is bundled and the only runtime external is Electron.

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

`shell.overlay` is a root-level modal/overlay layer, not a child of the chat flow. A fixed-position child placed there bypasses the Think row's clipping and native mask, so the desktop plugin never paints a fixed conversation visual or hides the native polite status. Its second slot registration is only a React lifecycle seat: the returned standard portal object targets the current direct native status row. That row remains Harness-owned and receives one non-interactive 20-pixel `ThinkingOrb` host with `position: relative`, `z-index: 1`, and `order: -1`; completion, replacement, navigation, or disposal removes it. The exact rc.8 conversation patch exposes Harness's own clock from `0s` and removes only the label shimmer. Streamed prose, reasoning, Markdown, token ordering, scrolling, clipping, and live-region semantics stay inside the official component tree.

On macOS, `html`, `body`, the renderer root, sidebar surface, and main surface retain full-window geometry. The exact rc.8 sidebar patch moves only its inner content below the native traffic lights: expanded mode computes `46px` top padding and collapsed mode `58px`. Windows and Linux receive neither rule. Esbuild emits one offline `client.js`; React and Harness UI primitives remain renderer-provided, while `thinking-orbs@0.3.1` is bundled with its MIT notice.

The better-sidebar workbench extends this boundary with a right-dock and bottom panel, lazy-chunked editors/terminals, and a service registry that third-party plugins consume through `ctx.betterSidebar.registerTab` / `registerFileViewer`. The code-brand badge is a `pointer-events: none` overlay positioned between the HARNESS lockup and the collapse button. UI-polish manages its toggles through `data-uip-*` attributes on `<html>`.

## Related Documents

- Parent: [Architecture index](./index.md)
- Prerequisite: [Intent](../project/intent.md)
- Next: [Lifecycle](./lifecycle.md)

## Validation

The verified suite passes unit, 108 Anchored Standard, 24 plugin/real-Harness, 39 package-contract, and Chromium e2e tests plus TypeScript, lint, formatting, documentation-link, security, production audit, runtime closure (51 artifacts + 8 critical versions + plugin roots + SHA-256 routing digests), and Universal app-directory packaging for the prior BETA2-1 baseline. BETA2-2 adds warm-reconciliation, LAN-proxy, and Windows workspace-boundary release gates; their package verification and platform artifacts remain pending the required tag CI. BETA2-2 keeps the immutable routing snapshot and 9-plugin managed closure, carries the sandbox-policy custom Bash / host-sandboxed `str_replace_editor` change, and documents that rc.8 does not promise universal read isolation while canonical workdir preflight retains a filesystem TOCTOU residual risk. Prior release and live-renderer evidence remains in the [acceptance report](../engineering/acceptance-report.md).
