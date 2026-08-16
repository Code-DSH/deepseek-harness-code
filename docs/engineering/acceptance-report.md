---
id: engineering.acceptance-report
title: DeepSeek Harness Code 0.3.0 Acceptance Report
summary: Final source, Routing Suite, rc.6 long-stream projection, clean-install, and Universal macOS package evidence for the integrated 0.3.0 release.
kind: engineering
status: canonical
content_stage: final-verified
scope: [desktop, watchdog, plugin, routing-suite, packaging]
triggers: [release, acceptance, verification, DMG]
read_when: [reviewing release readiness or reproducing validation]
skip_when: [isolated source edits before release]
priority: must
freshness_class: project
last_verified: 2026-08-16T16:38:10+08:00
owners: [primary-agent]
source_of_truth: [../../apps, ../../packages, ../../tests, ../../release]
related:
  prerequisites: [./testing.md, ../operations/install-unsigned.md]
  next: [../superpowers/plans/2026-08-16-deepseek-harness-code.md]
supersedes: []
tags: [acceptance, release, evidence]
---

# DeepSeek Harness Code 0.3.0 Acceptance Report

## Artifact

- DMG: `release/DeepSeek-Harness-Code-0.3.0-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- Size: 284,134,947 bytes (271 MiB displayed by `ls`)
- SHA-256: `c4d94cbe36b01152083f9eb5606fb85f2d5b80b155b4a5ecbe7946d37054314f`
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
10. The startup surface formerly used gradients and a frosted card. It now renders only a system light/dark pure background and one centered 24 px monochrome spinner. `preflight:runtime` resolves every production dependency, verifies 22 runtime artifacts including both preset/provenance sets, and pins five critical runtime packages before any builder command runs.
11. The macOS traffic-light group previously used `{ x: 16, y: 6 }`, placing the red button closer to the top edge than the left edge. The native BrowserWindow position is now `{ x: 16, y: 16 }`; no Web title bar, spacer, or renderer offset was added.
12. The rc.6 `turn-tail.tailData()` fallback searched the complete growing Context match list on every open-turn derived flush because `state.end` is intentionally absent before `turn/end`. A 10,000-delta real-bundle regression measured 50,015,000 match inspections. The exact-version pnpm patch now reads the Definition-owned state directly during normal operation (zero inspections), retains the original scan only when state is unexpectedly absent, and leaves canonical chunk ingestion and Assistant publication cadence unchanged.
13. The merged Routing Suite branch originally downloaded release archives plus a mutable router `main` archive in the background, recorded their digests only after download, and executed the resulting cache on the next launch. The release now bundles exact injector `0.3.3`, mode-boost `0.1.0`, and router preset commit `eff787e95132d6c7104214542104a84d656b497e`; each archive is compared with a reviewed SHA-256 before any `tar` extraction. The runtime updater was removed, and an intentionally valid but substituted archive fixture proves the check fails before executable output is created.

## Automated verification

| Gate              | Result                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Unit suite        | 27 files / 103 tests passed, including 4 Routing Suite and 4 real-bundle stream regressions  |
| Upstream preset   | 108 vendored upstream and local-patch tests passed                                           |
| Official plugins  | 3 files / 23 tests passed, including pinned rc.6 roster, session creation, and boot          |
| Package contract  | 1 file / 4 tests passed                                                                      |
| Browser E2E       | 1/1 passed; asserts only `settings.general.item`, route commit, and disposal                 |
| TypeScript        | `tsc --noEmit` passed                                                                        |
| Static gates      | ESLint, Prettier, 34 documentation files, and 7-control/3-forbidden security contract passed |
| Dependency audit  | `pnpm audit --prod` reported no known vulnerabilities                                        |
| Runtime preflight | 22 artifacts, 32 production dependencies, and 5 critical Harness packages verified           |
| macOS package     | 0.3.0 Universal DMG mounted, signature/resource closure checked, and SHA-256 recorded        |

The patched dependency was rebuilt from a moved-aside `node_modules` tree with `pnpm install --frozen-lockfile`; the installed peer-qualified package contained the patch and the focused stream suite passed 4/4. Reverting only the installed optimization reproduced the 50,015,000-inspection failure, then restoring it returned the suite to green. The Routing Suite checksum test was also mutation-checked: disabling only the comparison made the substituted archive test fail, restoring it returned all four routing tests to green. The final frozen install, full tests, build, typecheck, runtime preflight, lint, formatting, documentation links, security contract, production audit, Universal packaging, artifact verification, and deep signature check all passed.

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

The user-supplied community claim is experimental and is not a benchmark guarantee. The pinned Agent Preset uses rc.6 assembly/event hooks rather than `AgentPresets.recompose()`: request one exposes exactly `bash` and `str_replace_editor`; a durable tool call or assistant message promotes the current epoch to resident discovery, and explicit unlock events extend later schemas. The real rc.6 roster reports the preset healthy, Standard remains default, and `session.create` successfully mounts `anchored-standard`. A loopback mock DeepSeek provider captured the serialized first request with exactly the two bootstrap tools and the second request with exactly the five resident tools. The implementation never intercepts private model-request fields or captures/replays hidden reasoning.

## Cross-platform status

- macOS Universal DMG is locally built and inspected.
- Windows NSIS and Linux AppImage/deb are defined in `electron-builder.yml` and produced by native x64 jobs in `.github/workflows/package.yml`.
- Windows/Linux artifacts are not claimed as locally built on this Mac. ARM64 Windows/Linux requires native runners or separately verified cross-architecture optional dependencies.

## External limits

- The equal 16-point traffic-light contract is verified in source, test, and the packaged main process. Native visual inspection on macOS 15 and macOS 26 remains an external gate; the local packaging host is macOS 27 and cannot substitute for those runs.
- The key pasted in chat was not used, stored, printed, or forwarded. It must be revoked. A 45-minute live-provider soak is intentionally deferred until a replacement is entered by the user through official Harness settings.
- V4 Pro/Flash selection and the official `off` / `high` / `max` reasoning controls are available in the pinned adapter. The literal `We need` automatic reasoning trigger is documented as a next requirement and is not represented as shipped until its public per-request implementation and tests exist.

## Related documents

- Parent: [Engineering index](./index.md)
- Testing strategy: [Testing](./testing.md)
- Installation: [Unsigned installation](../operations/install-unsigned.md)
- Current plan: [Implementation plan](../plans/active/deepseek-harness-desktop.md)
