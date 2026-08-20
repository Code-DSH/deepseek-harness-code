---
id: engineering.acceptance-report
title: DeepSeek Harness Code Acceptance Report
summary: Current 0.1.0-BETA2 (rc.8 + 8 plugins) evidence plus archived BETA1/0.3.x startup recovery, Routing Suite, stream projection, and Universal release evidence.
kind: engineering
status: canonical
content_stage: implementation-backed
scope: [desktop, watchdog, plugin, routing-suite, packaging]
triggers: [release, acceptance, verification, DMG]
read_when: [reviewing release readiness or reproducing validation]
skip_when: [isolated source edits before release]
priority: must
freshness_class: project
last_verified: 2026-08-20T00:00:00+08:00
owners: [primary-agent]
source_of_truth: [../../apps, ../../packages, ../../tests, ../../release]
related:
  prerequisites: [./testing.md, ../operations/install-unsigned.md]
  next: [../superpowers/plans/2026-08-16-deepseek-harness-code.md]
supersedes: []
tags: [acceptance, release, evidence]
---

# DeepSeek Harness Code Acceptance Report

## 0.1.0-BETA2 integration evidence (current)

- BETA2 is released only from the synchronized `main` commit accepted by the release PR; tag `v0.1.0-BETA2` identifies the immutable source used by tag CI.
- Runtime pinned at `@deepseek-ai/dsh@0.1.0-rc.8`, Electron 43.4.0, pnpm 11.19.0, `dsh-find-plugin@0.3.6`; system Node >=22.13 auto-detected (PATH + nodejs.org/Homebrew/nvm/Volta/fnm/mise/Scoop/nvm-windows/Chocolatey + NVM_DIR/VOLTA_HOME/FNM_DIR), portable Node download removed.
- Harness Home resolution uses `@deepseek-ai/dsh-home-paths@0.1.0-rc.8`. Migration from `<Electron userData>/dsh-home` is copy-only, target-wins, symlink-rejecting, permission-preserving (0600/0700), idempotent, and rollback-safe.
- The host installs **8+ integrated plugins** only through `dsh plugin --profile web add` using the bundled pnpm runtime: `deepseek-harness-desktop-plugin`, `dsh-ui-motion@1.1.0`, `dsh-model2-selector@1.1.0`, `dsh-ui-polish`, `dsh-updater-check@1.0.0`, `dsh-prompt-principles`, `dsh-vision-router@1.7.1`, `dsh-better-sidebar@0.12.3`, `dsh-superpowers`, `@dsh-external/dsh-super-injector@0.3.3`, `@dsh-external/dsh-mode-boost@0.1.0`, `dsh-find-plugin`, and `deepseek-harness-composition` (MCP bridges + subagent providers). The Harness child receives `--expose-internals`; all bare-name patches are retained. A corrupted profile `node_modules` triggers a one-time rebuild before failing.
- Packaged extra resources include `routing-suite/` (SHA-256 pinned), `superpowers-skills/`, `global-agent-prompt/`, and the 8 plugin trees; `asar: false` preserves the full `window.__DSH_BOOT__` boot graph (39+ entries).
- Current gates (BETA2 pipeline): `pnpm build` → `pnpm check:memory` → `pnpm preflight:runtime` (51 runtime artifacts + 35 production dependencies + 8 critical versions + 10 bundled plugin packages + SHA-256 digests + bare-name patches + orphan import rejection) → `pnpm check` (typecheck + lint + format:check + verify:docs + verify:security) → tag CI packaging. The macOS tag job runs `verify-macos-artifact.mjs --universal` before upload; Windows NSIS and Linux AppImage/deb build on native runners.
- BETA2 accepts only an official system Node.js installation and never downloads or adds a private Node to PATH. Its updater host is informational only: no background schedule, installer download, application replacement, or automatic restart is reachable from the packaged main process. Startup no longer scans or terminates unrelated system Harness processes.

## 0.1.0-BETA1 historical artifact

- DMG: `release/DeepSeek-Harness-Code-0.1.0-BETA1-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- Size: 221,134,518 bytes
- SHA-256: `b1afaa874d00f1254c8d5542c64bc80969a804ad44d3ce96284c0ad73fcf25ce`
- `verify:mac --universal` mounted the DMG read-only, verified the runtime dependency closure, Anchored Standard provenance, ad-hoc signature, and 49 Universal/architecture-qualified Mach-O files. A separate `codesign --verify --deep --strict` completed without error.
- Integrated surface in BETA1: 6 plugins, rc.6, portable Node download still present; since BETA2 replaced by 8 plugins, rc.8, and system Node auto-detection.

## 0.3.2/0.3.1 historical evidence (archived)

### 0.3.2 official-install evidence

- All pre-existing local branches and worktrees were consolidated into `main@89c2b19`; implementation continues in the isolated `feat/official-harness-install` worktree.
- Harness Home resolution now uses `@deepseek-ai/dsh-home-paths@0.1.0-rc.6`. Migration from `<Electron userData>/dsh-home` is copy-only, target-wins, symlink-rejecting, permission-preserving, idempotent, and rollback-safe; it never removes the source or copies profile installation state.
- The host installs the desktop bundle, Super Injector, Mode Boost, and `dsh-find-plugin` only through `dsh plugin --profile web add`. Its private `PATH` exposes `pnpm@11.19.0` from the app bundle, while the Harness child receives `--expose-internals` and all three audited plugin patches retain bare names.
- The Universal app directory is 871 MB unpacked, ad-hoc signature verification passes, and its primary executable contains `x86_64 arm64`. Packaged Electron resolves its own `@deepseek-ai/dsh`, Home-paths, pnpm entry, and find-plugin package.
- A packaged-runtime integration run used the Universal executable, packaged pnpm, packaged rc.6, and all four actual plugin roots against an isolated Home. Official reconciliation completed and the loopback boot graph served `deepseek-harness-desktop-plugin/client.js` successfully.
- Current gates: 30 unit files / 118 tests, 108 Anchored tests, 24 plugin/real-Harness tests, four package tests, two Chromium tests, typecheck, lint, formatting, 42 documentation files, security contract, production audit, and runtime closure all pass. Runtime closure records 25 artifacts, 35 production dependencies, eight critical versions, and four integrated plugin packages.

### 0.3.1 artifact (archived)

- DMG: `release/DeepSeek-Harness-Code-0.3.1-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- Size: 284,138,156 bytes (271 MiB displayed by `ls`)
- SHA-256: `35d7a81fbddd8ffb479b5834ac2b669eb5708c62ac67781f6d43368af91bbf79`
- `verify:mac --universal` mounted the DMG read-only, verified the runtime dependency closure, Anchored Standard provenance, ad-hoc signature, and 49 Universal/architecture-qualified Mach-O files. A separate `codesign --verify --deep --strict` completed without error.

## Root-cause and repair evidence

1. The installed 0.1.0 preload contained a bare `require("zod")`. Electron sandbox preload could not resolve it, so `window.deepseekDesktop` was undefined and all official desktop settings were absent. The preload now bundles validation code and exposes only `preferences` and `runtime` capability groups.
2. Standard workspace creation first lacked `@deepseek-ai/dsh-workflow`; the later `compaction (cordis:group)` failure proved that the packaged closure also omitted `@deepseek-ai/dsh-compaction` and `@deepseek-ai/dsh-invariants`. All three are exact production dependencies. The real Electron UI now switches to `Deepfake V4 pro test`, creates/restores a Standard session, and shows no mount alert.
3. The plugin initially read protected Cordis services without complete client injection. The served client now exports `inject = ["slots", "locale"]`, and the real Harness contract test applies/disposes it under a strict context.
4. Route animation forced synchronous layout with `offsetWidth`. The implementation now alternates CSS animation tokens after a single observed DOM commit and disconnects the observer.
5. Normal quit could publish `stopping` to an already destroyed renderer and abort before child retirement. Observer failures are now isolated; a real follow-up run proved the Harness PID retired after normal close.
6. The product application menu omitted Electron's native Edit roles, leaving the system clipboard shortcut path incomplete. The host now installs Undo/Cut/Copy/Paste/Select All on every platform, adds a macOS `Control+V` alias, and has a fixed internal preload fallback. The fallback rejects non-trusted synthetic keyboard events before IPC. A runtime test pasted a 33-character non-secret placeholder into the official API-key password field and then cleared both the field and clipboard.
7. The former anchored preference and fallback Web bundle were removed. The audited preset is now an optional Agent Preset installed atomically under the app-private Harness home. Unknown or locally modified same-name presets are never overwritten; invalid packaged resources disable only the optional preset, so Standard startup continues. The desktop runtime emits bounded conflict/unavailable enums. The old persisted field is ignored for one migration version and disappears on the next preference write.
8. The generic menu-bar glyph was replaced by a transparent template image generated from the official mark; Windows and Linux use the full Code product icon. The official mark in the main application icon was moved down toward the Code wordmark.
9. The General-settings controls formerly used raw HTML select, checkbox, and buttons. They now use the official `@deepseek-ai/dsh-client-ui-primitives` Button/Menu/Icon components. A live layout audit found zero raw selects/checkboxes, matching trigger/menu right edges, and an ellipsis-safe label. The plugin follows the official locale service in both Chinese and English.
10. The startup surface formerly used gradients and a frosted card. It now renders only a system light/dark pure background and one centered 24 px monochrome spinner. `preflight:runtime` resolves every production dependency, verifies runtime artifacts including both preset/provenance sets, and pins critical runtime packages before any builder command runs.
11. The macOS traffic-light group previously used `{ x: 16, y: 6 }`, placing the red button closer to the top edge than the left edge. The native BrowserWindow position is now `{ x: 16, y: 16 }`; no Web title bar, spacer, or renderer offset was added.
12. The rc.6 `turn-tail.tailData()` fallback searched the complete growing Context match list on every open-turn derived flush because `state.end` is intentionally absent before `turn/end`. A 10,000-delta real-bundle regression measured 50,015,000 match inspections. The exact-version pnpm patch now reads the Definition-owned state directly during normal operation (zero inspections), retains the original scan only when state is unexpectedly absent, and leaves canonical chunk ingestion and Assistant publication cadence unchanged.
13. The merged Routing Suite branch originally downloaded release archives plus a mutable router `main` archive in the background, recorded their digests only after download, and executed the resulting cache on the next launch. The release now bundles exact injector `0.3.3`, mode-boost `0.1.0`, and router preset commit `eff787e95132d6c7104214542104a84d656b497e`; each archive is compared with a reviewed SHA-256 before any `tar` extraction. The runtime updater was removed, and an intentionally valid but substituted archive fixture proves the check fails before executable output is created.
14. The 0.3.0 macOS `activate` listener was registered before Electron readiness and could call `new BrowserWindow()` from a pre-ready event. The installed stack resolved exactly to that callback. The listener is now registered only inside the fulfilled `app.whenReady()` continuation, matching Electron's documented lifecycle requirement; the regression reproduces the old exception under a pending readiness promise.
15. Routing Suite assembly appended its managed `- insert:` block after the official empty `[]` profile document. The exact rc.6 loader rejected line 5 with `end of the stream or a document separator is expected`, so the child exited before readiness. Startup now replaces the empty document, migrates the exact malformed 0.3.0 output idempotently, and preserves unrelated valid user patch entries.
16. After repairing YAML, a real isolated rc.6 run revealed both Routing Suite packages still failed as bare imports from profile-local links. The build now adapts the injector's checksum-verified patch only after archive verification, and both injector and mode boost resolve through stable profile-relative public entry paths. A source-tree run and the packaged 0.3.1 executable each served the loopback Web root with HTTP 200.
17. System Node auto-detection was added in 0.1.0-BETA2: `apps/desktop/src/lifecycle/system-node.ts` scans PATH + Homebrew/nvm/Volta/fnm/mise/Scoop/Chocolatey + NVM_DIR/VOLTA_HOME/FNM_DIR; a built-in `pnpm` launcher and isolated retry on corrupted profile `node_modules` keep the public CLI path green even from GUI launches with a minimal PATH.
18. A BETA2 merge retained both the direct `app.whenReady()` block and the extracted lifecycle authority. One Electron main process therefore launched two Watchdogs and two first-run pnpm installs against the same `node-runtime/packages` directory; one copy removed `@deepseek-ai__dsh.patch` while the other still handled it, surfacing `ENOENT unlink` even though the competing install later completed. The direct duplicate registration is removed, updater ownership is folded into the single lifecycle authority, and the startup action is single-flight with a concurrent-call regression.

## Automated verification

| Gate              | Result (BETA2 baseline)                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Unit suite        | 50 files / 308 tests passed (3 intentionally skipped), including Routing Suite, system-node, and stream regressions       |
| Upstream preset   | 108 vendored upstream and local-patch tests passed                                                                        |
| Official plugins  | 3 files / 24 tests passed, including pinned rc.8 roster, session creation, and boot                                       |
| Package contract  | 2 files / 39 tests passed                                                                                                 |
| Browser E2E       | 2 Playwright Chromium tests — desktop slot/transition/cleanup + real client graph                                         |
| TypeScript        | `tsc --noEmit` passed                                                                                                     |
| Static gates      | ESLint, Prettier, documentation links (verified 2026-08-20), and 7-control/6-forbidden security contract passed           |
| Dependency audit  | `pnpm audit --prod` reported no known vulnerabilities                                                                     |
| Runtime preflight | 51 artifacts, 35 production dependencies, 8 critical packages, and 10 bundled plugin packages verified                    |
| macOS package     | `verify:mac --universal` mounts, signature/resource closure checked, SHA-256 recorded (BETA1 archived; BETA2 re-verified) |

Historical 0.3.x gate snapshots are retained above for traceability; current release gates are BETA2.

## Real renderer and performance evidence

- Grouped bridge keys: `preferences`, `runtime`; no arbitrary IPC/shell/path API.
- Composer accepted `UI smoke test — 中文输入与复制`, and full keyboard selection covered the complete 23-character value; the test cleared it without sending.
- `Read Only` selection remained visible and the menu closed normally, then `Workspace Write` was restored. The prior flashback was not reproduced.
- Official General settings render localized desktop status, the official Button/Menu close selector, restart/log actions, and bounded preset-conflict/unavailable notices only when needed. The obsolete anchored switch and fallback disclosure are absent.
- Close preference changes round-trip through the bridge; no desktop preference changes the official Agent Preset default.
- The official API-key password field accepted the non-secret clipboard placeholder through macOS `Control+V`; the field and clipboard were cleared immediately afterward.
- Normal application quit retired Electron, Harness, and Watchdog; no process was relaunched three seconds later.
- Five seconds idle: zero layouts, eight style recalculations, 1.631 ms cumulative task time, 456-byte heap delta, and approximately 0% Electron renderer/main CPU at the sample point.

## Anchored Standard boundary

The user-supplied community claim is experimental and is not a benchmark guarantee. The pinned Agent Preset uses rc.8 assembly/event hooks rather than `AgentPresets.recompose()`: request one exposes exactly `bash` and `str_replace_editor`; a durable tool call or assistant message promotes the current epoch to resident discovery, and explicit unlock events extend later schemas. The real rc.8 roster reports the preset healthy, Standard remains default, and `session.create` successfully mounts `anchored-standard`. A loopback mock DeepSeek provider captured the serialized first request with exactly the two bootstrap tools and the second request with exactly the five resident tools. The implementation never intercepts private model-request fields or captures/replays hidden reasoning.

## Routing Suite and bundled Skills boundary

- The bundled snapshot pins injector `0.3.3`, mode-boost `0.1.0`, and router preset `0.2.0` at commit `eff787e95132d6c7104214542104a84d656b497e`; `build/routing-suite/versions.json` records each archive SHA-256 (`355238fa...`, `72836d64...`, `a8f3616f...`).
- Startup assembly is idempotent: the injector is appended after the desktop bundle, mode-boost is linked and inserted into `cordis.patch.yml`, and both router presets are installed under `<DSH_HOME>/.agent-presets` with ownership markers and digests.
- The installed app has **no runtime updater**. Routing code changes only with a reviewed app release; the build rejects digest drift before `tar`.
- Superpowers 6.2.0 skills are installed under `<DSH_HOME>/skills` with per-skill markers. A same-named unmarked or modified directory is preserved and reported; package failure disables only the bundled Skills while Standard continues.
- Managed preset and skill installation normalizes bilingual display copy before digesting, so refreshed routing presets cannot silently restore raw IDs or empty descriptions.

## Cross-platform status

- macOS Universal DMG is locally built and inspected (`--universal`).
- Windows NSIS installers are produced by native x64 + arm64 jobs in `.github/workflows/package.yml` (BETA1 shipped; BETA2 re-verified).
- Linux AppImage/deb are defined in `electron-builder.yml` and pass on ubuntu-latest runners in the tag-triggered packaging workflow (BETA1 definitions-ready; BETA2 CI-green).

## External limits

- The equal 16-point traffic-light contract is verified in source, test, and the packaged main process. Native visual inspection on macOS 15 and macOS 26 remains an external gate; the local packaging host is macOS 27 and cannot substitute for those runs.
- The key pasted in chat was not used, stored, printed, or forwarded. It must be revoked. A 45-minute live-provider soak is intentionally deferred until a replacement is entered by the user through official Harness settings.
- V4 Pro/Flash selection and the official `off` / `high` / `max` reasoning controls are available in the pinned adapter. The literal `We need` automatic reasoning trigger is documented as a next requirement and is not represented as shipped until its public per-request implementation and tests exist.
- The routing-suite immutable snapshot replaces the former mutable `dsh-router-standard/main` refresh; releases now claim a fully pinned routing supply chain verified by SHA-256 at build time.

## Related documents

- Parent: [Engineering index](./index.md)
- Testing strategy: [Testing](./testing.md)
- Installation: [Unsigned installation](../operations/install-unsigned.md)
- Current plan: [Implementation plan](../plans/active/deepseek-harness-desktop.md)
