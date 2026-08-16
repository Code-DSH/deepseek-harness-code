---
id: architecture.overview
title: System Architecture
summary: Implemented Electron shell, official single Harness Home and plugin installation flow, checksum-pinned Routing Suite, managed progressive Agent Preset, watchdog boundaries, and native Harness rendering.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, routing-suite, skills, watchdog]
triggers: [architecture, IPC, security boundary]
read_when: [changing process ownership or public interfaces]
skip_when: [documentation-only wording fixes]
priority: must
freshness_class: project
last_verified: 2026-08-16T19:00:00+08:00
owners: [project]
source_of_truth: [../../apps, ../../packages]
related:
  prerequisites: [../project/intent.md]
  next: [./lifecycle.md, ./system.svg]
supersedes: []
tags: [architecture, electron]
---

# System Architecture

The implemented Electron main process owns BrowserWindow security policy, close behavior, local Harness lifecycle, and the narrow preload bridge. Harness runs as a child of the auto-detected system official Node.js with the Home returned by the official `@deepseek-ai/dsh-home-paths` resolver: nonblank `DSH_HOME` when configured, otherwise `~/.dsh`. The official-format plugin augments settings, diagnostics, theme, desktop chrome, and the native running-status row without replacing Harness sessions, Markdown rendering, status semantics, elapsed-time ownership, or question protocols; its visible controls reuse the official Harness UI primitives and locale service. The detached Node-mode watchdog observes the desktop process over inherited OS IPC and only restarts after abnormal disconnect.

Before Harness starts, the host resolves the system official Node.js (>=22.13, no upper bound) by scanning the PATH, common install locations (nodejs.org installer, Homebrew, nvm, Volta, fnm, mise, n, Scoop, nvm-windows, Chocolatey), and version-manager roots such as `NVM_DIR`/`VOLTA_HOME`/`FNM_DIR`, then installs the pinned Harness packages into app-owned user data and invokes the public `dsh plugin --profile web add <package>` command for `deepseek-harness-desktop-plugin`, `dsh-ui-motion`, `dsh-model2-selector`, Super Injector, Mode Boost, and `dsh-find-plugin`. A private launcher puts the system Node and the bundled pnpm runtime on the child's `PATH`; the official CLI therefore owns profile initialization, dependency placement, bundle ordering, and idempotent reconciliation. The desktop layer never creates profile links or edits profile manifests, bundle lists, or user patch YAML. Anchored Standard is not a Web profile bundle: the complete pinned preset is packaged as an extra resource and atomically synchronized to `<DSH_HOME>/.agent-presets/anchored-standard` on Harness startup. A versioned ownership marker and SHA-256 digest allow safe upgrades only when the installed copy is still app-owned and unmodified.

The DSH Routing Suite is another immutable app resource. The build fetches exact injector `0.3.3`, mode-boost `0.1.0`, and router preset commit `eff787e95132d6c7104214542104a84d656b497e`, rejects any archive whose SHA-256 differs before extraction, and packages the verified tree. Injector and Mode Boost retain bare package names and official `dsh.bundle.patch` metadata; the Harness child receives `--expose-internals`, restoring rc.6's native cascaded loader in Electron. Startup manages only `router-standard` and `router-spec` outside the CLI, using the ownership-preserving preset installer. The installed app has no Routing Suite network updater; routing code changes only with a reviewed app release.

Within a selected Anchored Standard session, `system-prompt/assemble` exposes exactly `bash` and `str_replace_editor` before a durable tool call or assistant message exists. `agent/pre-step` filters only automatic `agent-instructions` and `skill-catalog` messages during that bootstrap phase. Promotion retains the Minimal pair plus `dev_tool_search`, `skill_search`, and `skill_load`; other tools appear only after an explicit `dev_tool_search` unlock recorded in durable session events. Compaction starts a new epoch with a controlled work set, and subagents start resident. Missing phase-required tools fail preset assembly instead of returning the full catalog.

## Trust Boundaries

- Renderer: untrusted Web content with no Node integration.
- Preload: exactly two allow-listed capability groups and validated payloads.
- Main: process and filesystem authority limited to Electron-owned settings, the official Harness Home, bundled resources, and fixed actions.
- Harness: loopback-only HTTP server and official plugin host.
- Routing Suite: exact app-bundled snapshot only; no mutable runtime download or execution path.
- Watchdog: can relaunch only the validated fixed application executable/argument vector; exposes no network listener; removes `ELECTRON_RUN_AS_NODE` before relaunch.

## Implemented Host Contract

- IPC channels are fixed to `runtime:get`, `runtime:restart`, `runtime:changed`, `logs:open`, `preferences:get`, `preferences:set`, and the send-only `clipboard:paste` alias. The alias accepts only trusted macOS `Control+V` keyboard events, pastes into its originating WebContents, rejects page-script synthetic events, and is not exposed in the public bridge.
- BrowserWindow uses `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- The packaged `apps/desktop/src/startup.html` is the only file navigation exception. After startup, only the exact current HTTP loopback origin is allowed in-app; external HTTPS opens through the system browser and redirects use the same policy.
- Harness readiness requires a live child and a 2xx Web-root response with a five-second request timeout. The host reloads the newly allocated origin after recovery.
- Startup diagnostics are bounded, redacted, and detached once the child is ready.
- The detached Watchdog uses inherited OS IPC only. State, marker, and 10 MB × five-file logs are constrained to `<userData>/watchdog`; normal quit awaits an acknowledgement before disconnect.
- The package intentionally uses an unpacked application tree (`asar: false`). With rc.6, package discovery through `createRequire` returned an empty client graph inside ASAR; the unpacked tree restored all 39 official/plugin client entries without exposing Node to the renderer.
- Packaged extra resources include `routing-suite/`, `superpowers-skills/`, `dsh-ui-motion/`, and `dsh-model-two-level-selector/`. The plugin roots are installed by the public CLI from immutable app resources; Skills and managed presets use ownership-safe synchronization into the official Home.

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

`shell.overlay` is a root-level modal/overlay layer, not a child of the chat flow. A fixed-position child placed there bypasses the Think row's clipping and native mask, so the desktop plugin never paints a fixed conversation visual or hides the native polite status. Its second slot registration is only a React lifecycle seat: the returned standard portal object targets the current direct native status row. That row remains Harness-owned and receives one non-interactive 20-pixel `ThinkingOrb` host with `position: relative`, `z-index: 1`, and `order: -1`; completion, replacement, navigation, or disposal removes it. The exact rc.6 conversation patch exposes Harness's own clock from `0s` and removes only the label shimmer. Streamed prose, reasoning, Markdown, token ordering, scrolling, clipping, and live-region semantics stay inside the official component tree.

On macOS, `html`, `body`, the renderer root, sidebar surface, and main surface retain full-window geometry. The exact rc.6 sidebar patch moves only its inner content below the native traffic lights: expanded mode computes `46px` top padding and collapsed mode `58px`. Windows and Linux receive neither rule. Esbuild emits one offline `client.js`; React and Harness UI primitives remain renderer-provided, while `thinking-orbs@0.3.1` is bundled with its MIT notice.

## Related Documents

- Parent: [Architecture index](./index.md)
- Prerequisite: [Intent](../project/intent.md)
- Next: [Lifecycle](./lifecycle.md)

## Validation

The previously completed suite passes 30 unit files / 118 tests, 108 Anchored Standard tests, 24 plugin/real-Harness tests, four package-contract tests, two Chromium tests, TypeScript type checking, lint, formatting, 42-document link validation, security, production dependency audit, runtime closure, and Universal app-directory packaging. The `0.3.3` release adds a fresh runtime preflight over 35 artifacts and six bundled Web plugin packages; per user direction, the prior full test suite is not rerun for this packaging-only snapshot. Mounted-DMG evidence is recorded after the release build. Prior release and live-renderer evidence remains in the [acceptance report](../engineering/acceptance-report.md).
