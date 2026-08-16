---
id: engineering.acceptance-report
title: DeepSeek Harness Code 0.2.0 Acceptance Report
summary: Executed source, renderer, performance, and Universal macOS package evidence plus explicit external limits.
kind: engineering
status: canonical
content_stage: partial-implementation
scope: [desktop, watchdog, plugin, packaging]
triggers: [release, acceptance, verification, DMG]
read_when: [reviewing release readiness or reproducing validation]
skip_when: [isolated source edits before release]
priority: must
freshness_class: project
last_verified: 2026-08-16T11:18:00+08:00
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
- Final SHA-256: pending the current rebuild.
- Size: pending the current rebuild.
- Signature, quarantine, and architecture verification: pending the current rebuild; the previous candidate passed all three gates but is not the release artifact after the latest fixes.

## Root-cause and repair evidence

1. The installed 0.1.0 preload contained a bare `require("zod")`. Electron sandbox preload could not resolve it, so `window.deepseekDesktop` was undefined and all official desktop settings were absent. The preload now bundles validation code and exposes only `preferences` and `runtime` capability groups.
2. Standard workspace creation first lacked `@deepseek-ai/dsh-workflow`; the later `compaction (cordis:group)` failure proved that the packaged closure also omitted `@deepseek-ai/dsh-compaction` and `@deepseek-ai/dsh-invariants`. All three are exact production dependencies. The real Electron UI now switches to `Deepfake V4 pro test`, creates/restores a Standard session, and shows no mount alert.
3. The plugin initially read protected Cordis services without complete client injection. The served client now exports `inject = ["slots", "locale"]`, and the real Harness contract test applies/disposes it under a strict context.
4. Route animation forced synchronous layout with `offsetWidth`. The implementation now alternates CSS animation tokens after a single observed DOM commit and disconnects the observer.
5. Normal quit could publish `stopping` to an already destroyed renderer and abort before child retirement. Observer failures are now isolated; a real follow-up run proved the Harness PID retired after normal close.
6. The product application menu omitted Electron's native Edit roles, leaving the system clipboard shortcut path incomplete. The host now installs Undo/Cut/Copy/Paste/Select All on every platform, adds a macOS `Control+V` alias, and has a fixed internal preload fallback. The fallback rejects non-trusted synthetic keyboard events before IPC. A runtime test pasted a 33-character non-secret placeholder into the official API-key password field and then cleared both the field and clipboard.
7. The anchored preference was persisted but the bundle was always registered. Profile generation now conditionally adds or removes the official-format anchored bundle and the settings action restarts Harness. The mode remains an explicit Standard fallback on rc.6.
8. The generic menu-bar glyph was replaced by a transparent template image generated from the official mark; Windows and Linux use the full Code product icon. The official mark in the main application icon was moved down toward the Code wordmark.
9. The General-settings controls formerly used raw HTML select, checkbox, and buttons. They now use the official `@deepseek-ai/dsh-client-ui-primitives` Button/Menu/Icon components. A live layout audit found zero raw selects/checkboxes, matching trigger/menu right edges, and an ellipsis-safe label. The plugin follows the official locale service in both Chinese and English.
10. The startup surface formerly used gradients and a frosted card. It now renders only a system light/dark pure background and one centered 24 px monochrome spinner. `preflight:runtime` resolves every production dependency, verifies 11 runtime artifacts, and pins five critical runtime packages before any builder command runs.

## Automated verification

| Gate              | Result                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| Unit suite        | 21 files / 76 tests passed                                                    |
| Official plugins  | 3 files / 15 tests passed, including pinned rc.6 boot and strict client apply |
| Package contract  | 1 file / 4 tests passed                                                       |
| TypeScript        | `tsc --noEmit` passed                                                         |
| Static gates      | ESLint, Prettier, 22 documentation links, and security contract passed        |
| Dependency audit  | Production audit reported no known vulnerabilities at high severity or above  |
| Runtime preflight | 11 artifacts, 32 production dependencies, and 5 critical versions passed      |
| macOS package     | Current rebuild pending; prior candidate passed the complete inspection       |

## Real renderer and performance evidence

- Grouped bridge keys: `preferences`, `runtime`; no arbitrary IPC/shell/path API.
- Composer accepted `UI smoke test — 中文输入与复制`, and full keyboard selection covered the complete 23-character value; the test cleared it without sending.
- `Read Only` selection remained visible and the menu closed normally, then `Workspace Write` was restored. The prior flashback was not reproduced.
- Official General settings rendered the localized desktop status, official Button/Menu close selector, official Button switch/actions, Standard-fallback disclosure, restart, and logs actions. The close menu aligned to the trigger and its Chinese label did not overflow.
- Preference changes round-tripped through the bridge and the current persisted choice is `minimize` / anchored enabled.
- The official API-key password field accepted the non-secret clipboard placeholder through macOS `Control+V`; the field and clipboard were cleared immediately afterward.
- Normal application quit retired Electron, Harness, and Watchdog; no process was relaunched three seconds later.
- Five seconds idle: zero layouts, eight style recalculations, 1.631 ms cumulative task time, 456-byte heap delta, and approximately 0% Electron renderer/main CPU at the sample point.

## Anchored Standard boundary

The user-supplied community claim is experimental and was not treated as a verified benchmark guarantee. Pinned rc.6 source states preset recomposition is valid only before an agent has produced output; a post-tool-call promotion is therefore not safe through the public seam. The bundled official-format plugin fails closed to Standard, reports `dynamicPromotion: false`, and never intercepts private model-request fields or claims to control hidden chain-of-thought.

## Cross-platform status

- macOS Universal DMG is locally built and inspected.
- Windows NSIS and Linux AppImage/deb are defined in `electron-builder.yml` and produced by native x64 jobs in `.github/workflows/package.yml`.
- Windows/Linux artifacts are not claimed as locally built on this Mac. ARM64 Windows/Linux requires native runners or separately verified cross-architecture optional dependencies.

## External limits

- Computer Use reported that the Mac is locked and could not auto-unlock. The same native renderer interactions were completed through the app's Chromium debugging endpoint, but native traffic-light and menu-bar clicks remain an external visual gate.
- The key pasted in chat was not used, stored, printed, or forwarded. It must be revoked. A 45-minute live-provider soak is intentionally deferred until a replacement is entered by the user through official Harness settings.
- The requested benchmark-score/“We need” outcome is not represented as a completed or measurable acceptance claim.

## Related documents

- Parent: [Engineering index](./index.md)
- Testing strategy: [Testing](./testing.md)
- Installation: [Unsigned installation](../operations/install-unsigned.md)
- Current plan: [Implementation plan](../superpowers/plans/2026-08-16-deepseek-harness-code.md)
