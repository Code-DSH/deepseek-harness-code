---
id: engineering.acceptance-report
title: DeepSeek Harness Code 0.2.0 Acceptance Report
summary: Executed all-branch source, renderer, and rc.6 long-stream projection evidence; final clean Universal macOS package evidence is being refreshed.
kind: engineering
status: canonical
content_stage: partial-implementation
scope: [desktop, watchdog, plugin, packaging]
triggers: [release, acceptance, verification, DMG]
read_when: [reviewing release readiness or reproducing validation]
skip_when: [isolated source edits before release]
priority: must
freshness_class: project
last_verified: 2026-08-16T14:26:00+08:00
owners: [primary-agent]
source_of_truth: [../../apps, ../../packages, ../../tests, ../../release]
related:
  prerequisites: [./testing.md, ../operations/install-unsigned.md]
  next: [../superpowers/plans/2026-08-16-deepseek-harness-code.md]
supersedes: []
tags: [acceptance, release, evidence]
---

# DeepSeek Harness Code 0.2.0 Acceptance Report

## Artifact

- DMG: `release/DeepSeek-Harness-Code-0.2.0-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- The pre-integration artifact passed signature, quarantine, preset-provenance, and architecture verification. Its checksum is superseded and will be replaced only after the all-branch source gate produces and verifies a clean DMG.

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
10. The startup surface formerly used gradients and a frosted card. It now renders only a system light/dark pure background and one centered 24 px monochrome spinner. `preflight:runtime` resolves every production dependency, verifies 17 runtime artifacts including the preset/provenance set, and pins five critical runtime packages before any builder command runs.
11. The macOS traffic-light group previously used `{ x: 16, y: 6 }`, placing the red button closer to the top edge than the left edge. The native BrowserWindow position is now `{ x: 16, y: 16 }`; no Web title bar, spacer, or renderer offset was added.
12. The rc.6 `turn-tail.tailData()` fallback searched the complete growing Context match list on every open-turn derived flush because `state.end` is intentionally absent before `turn/end`. A 10,000-delta real-bundle regression measured 50,015,000 match inspections. The exact-version pnpm patch now reads the Definition-owned state directly during normal operation (zero inspections), retains the original scan only when state is unexpectedly absent, and leaves canonical chunk ingestion and Assistant publication cadence unchanged.

## Automated verification

| Gate              | Result                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| Unit suite        | 27 files / 102 tests passed, including 4 real-bundle stream regressions             |
| Upstream preset   | 108 vendored upstream and local-patch tests passed                                  |
| Official plugins  | 3 files / 23 tests passed, including pinned rc.6 roster, session creation, and boot |
| Package contract  | 1 file / 4 tests passed                                                             |
| Browser E2E       | 3/5 passed; two known `installStreamOutputEffects` baseline failures remain         |
| TypeScript        | `tsc --noEmit` passed                                                               |
| Static gates      | ESLint, Prettier, 31 documentation files, and 7-control security contract passed    |
| Dependency audit  | Production audit reported no known vulnerabilities at high severity or above        |
| Runtime preflight | Clean all-branch package rerun follows the verified source integration              |
| macOS package     | Clean all-branch Universal DMG rerun follows the verified source integration        |

The patched dependency was rebuilt from a moved-aside `node_modules` tree with `pnpm install --frozen-lockfile`; the installed peer-qualified package contained the patch and the focused suite passed 4/4. Reverting only the installed optimization reproduced the 50,015,000-inspection failure, then restoring it returned the suite to green. `pnpm build`, typecheck, runtime preflight, docs links, security, unit, Anchored, real-Harness plugin, and package-contract gates passed. The full Playwright run retained exactly the two documented `installStreamOutputEffects is not a function` baseline failures (3/5 passed). Full-repository lint/format remain blocked by pre-existing vendored Superpowers files and unrelated formatting drift; changed TypeScript passed targeted ESLint.

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
