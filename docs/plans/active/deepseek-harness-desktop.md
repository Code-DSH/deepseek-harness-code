---
id: plan.deepseek-harness-desktop
title: DeepSeek Harness Desktop Implementation
summary: Active, resumable execution plan for the desktop release, Routing Suite and bundled Skills integration, and progressive Anchored Standard preset — now at 0.1.0-BETA2 / rc.8.
kind: plan
status: canonical
content_stage: implementation-backed
scope:
  [
    repository,
    desktop,
    watchdog,
    plugin,
    routing-suite,
    skills,
    packaging,
    validation,
  ]
triggers: [resume, milestone, implementation plan]
read_when: [starting or reviewing any milestone]
skip_when: [isolated documentation typo]
priority: must
freshness_class: project
last_verified: 2026-08-20T00:00:00+08:00
owners: [primary-agent]
source_of_truth: [../../../apps, ../../../packages, ../../../tests]
related:
  prerequisites: [../../project/intent.md]
  next: [../../architecture/overview.md, ../../engineering/testing.md]
supersedes: []
tags: [execplan, active]
---

# DeepSeek Harness Desktop Implementation

## Goal and Non-goals

Implement and verify the confirmed intent. Do not add auto-update installer, notarization, a second session database, or a custom question protocol. Updater-check is a settings entry, not an auto-installer.

## Intent Baseline

[Confirmed project intent](../../project/intent.md) — `deepseek-harness-code@0.1.0-BETA2`, `@deepseek-ai/dsh@0.1.0-rc.8`, Electron 43.4.0.

## Read Set

- [Project intent](../../project/intent.md) — approved scope and acceptance; verified 2026-08-20.
- [Architecture overview](../../architecture/overview.md) — process/trust boundaries including 8 plugins, Routing Suite, Skills, and Global Prompt; verified 2026-08-20.
- [Upstream baseline](../../knowledge/upstream-baseline.md) — pinned versions (rc.8), routing archive digests (SHA-256), 8-plugin inventory, official protocol; verified 2026-08-20.
- [Testing](../../engineering/testing.md) — verification layers (unit → anchored 108 → plugin 24 → package 4 → e2e) and gates; verified 2026-08-20.
- [Anchored Standard](../../knowledge/anchored-standard.md) — pinned source (db4527a), progressive state contract, and experiment boundary; verified 2026-08-20.
- [Lifecycle](../../architecture/lifecycle.md) — system Node auto-detection and watchdog state machine.

## Milestones

1. **Bootstrap and baseline:** workspace, lockfile, official Harness launch, minimal docs, initial tests.
2. **Desktop host:** secure window/preload, lifecycle controller, close behavior, menu, navigation policy, system Node auto-detection.
3. **Watchdog and diagnostics:** IPC disconnect recovery, circuit breaker (1 s / 2 s, open on 3rd in 5 min), health state (5 s probe, 3 failures), rotating redacted logs (5 × 10 MB).
4. **Official plugins, presets, Routing Suite, and Skills:** 8 Web bundles (desktop, ui-motion 1.1.0, model2 1.1.0, ui-polish, updater-check, prompt-principles, vision-router 1.7.1, better-sidebar 0.12.3) + composition (MCP + subagents) + superpowers (coding mode) + global prompt + managed progressive `anchored-standard` preset + auto-assembled immutable dsh-routing-suite (`injector 0.3.3` / `mode-boost 0.1.0` / `router-preset eff787e`) + bundled Superpowers skills 6.2.0.
5. **Packaging:** icon, universal app/DMG (`asar: false`), ad-hoc signing, targeted quarantine guidance, runtime closure (35 artifacts + 8 critical versions + SHA-256 routing digests).
6. **Acceptance:** unit/integration/fault/security/package tests, mount verification, Computer Use, live soak if credentials exist (BETA1 shipped; BETA2 integration re-verified).

## Dependencies and Risks

- Cross-architecture packaging may need x64 execution/download support. If an upstream Mach-O is single-arch, produce two clearly labeled equivalent DMGs and record evidence.
- Live V4 Flash acceptance depends on credentials entered by the user.
- Harness RC behavior is version-pinned at rc.8; upgrades require official-source revalidation.
- A user-authored same-name preset is never overwritten; it produces a bounded conflict notice while Standard remains available.
- Routing Suite is now an immutable SHA-256-pinned snapshot; no runtime updater. Changes require a reviewed app release (verified by `check-runtime-closure.mjs` + `fetch-routing-suite.mjs`).
- V4 Pro quality gains require a future credentialed paired experiment and are not a package acceptance gate.

## Test and Acceptance

Follow [testing strategy](../../engineering/testing.md). Every runtime change starts with an observed failing test. Final claims require fresh `pnpm build` → `pnpm check` → `pnpm preflight:runtime` → `pnpm dist:* --universal` → `verify-macos-artifact.mjs` verification.

## Decision Log

- 2026-08-15 — Architecture A confirmed: Electron + official Harness plugin + independent watchdog.
- 2026-08-15 — Standalone repository chosen because the parent directory is not a Git repository.
- 2026-08-17 — Runtime switched to system official Node.js (>=22.13 auto-detected); portable download removed.
- 2026-08-20 — Bumped to `0.1.0-BETA2` / `rc.8` with 8 integrated plugins, immutable routing snapshot, vision-router + better-sidebar service, and global prompt ownership model.

## Progress

- 2026-08-15 — Created the minimum documentation router and implementation plan.
- 2026-08-15 — Started official Harness rc.6 on loopback with an isolated DSH_HOME and verified HTTP 200 at the Web root.
- 2026-08-15 — Completed the secure Electron host after independent spec and quality reviews; 13 test files / 37 tests, typecheck, and Host build passed.
- 2026-08-15 — Completed independent Watchdog, shutdown ACK integration, circuit persistence, secure relaunch, and rotating redacted logs; integrated suite reached 16 files / 54 tests.
- 2026-08-15 — Generated and XML-validated the accessible native SVG architecture diagram.
- 2026-08-15 — Completed the official plugin, deterministic client build, Settings integration, route animation cleanup, reduced-motion path, and real pinned-Harness boot test.
- 2026-08-15 — Built the ad-hoc-signed Universal App and DMG; verified every Mach-O, absence of quarantine, DMG mount/layout, and SHA-256.
- 2026-08-15 — Booted the final packaged App with 39 Web client entries and HTTP 200 for the Web root, desktop plugin, and official question UI.
- 2026-08-15 — Final automated baseline: 18/57 unit, 2/11 plugin, 1/2 package, and 1 Playwright browser test plus typecheck, lint, format, docs, security, and package inspection.
- 2026-08-16 — Repaired the latest packaged Standard preset failure by pinning compaction/invariants peers, verified real workspace switching/session restoration, migrated plugin controls to official Harness Button/Menu primitives with locale-aware copy and overflow-safe layout, simplified startup to a monochrome system-matched spinner, and added a mandatory runtime dependency preflight.
- 2026-08-16 — Replaced the anchored Standard fallback Web bundle with the pinned progressive Agent Preset. Added strict two-tool bootstrap, durable promotion/unlock reconstruction, compaction epochs, subagent residency, atomic app-owned installation, conflict preservation, legacy preference migration, installer provenance, and official rc.6 roster/session-create integration tests.
- 2026-08-16 — Added strict optional-preset isolation so corrupt packaged resources publish an unavailable notice without blocking Standard, then completed 84 unit, 108 vendored, 20 plugin/integration, 4 package-contract, and 1 Playwright tests. The real Harness test uses a loopback mock provider to capture the serialized two-tool first request and five-tool second request.
- 2026-08-16 — Rebuilt the 271 MiB Universal DMG and verified the pinned preset provenance, dependency resolution, signature, quarantine state, and all 49 Mach-O layouts. Final SHA-256 is `b651c04dfeb5d21de9a8d5dbb10e9f04ab3c07cc789566eb89bcd587ee92c4c9`.
- 2026-08-16 — The prior streaming dissolve and active ThinkingOrb integration were retired after visual defects. The desktop bundle now defers all streaming and Think rendering to the official Harness component tree; the packaging gate is rerun against this native-rendering configuration.
- 2026-08-17 — Switched to system Node auto-detection, fixed macOS icudtl/GPU crash (clean bundle reinstall), fixed plugin-tree missing `dsh-subagent-*` composition links, verified warm start ~6 s, single-instance lock, and 8-preset mode menu.
- 2026-08-20 — Bumped to `0.1.0-BETA2` / `rc.8`: 8 integrated plugins (ui-polish, updater-check, prompt-principles, vision-router, better-sidebar service, superpowers, code-brand, composition), immutable routing snapshot with SHA-256 pins, global prompt + global `dsh` CLI ownership model, system Node host contract, runtime closure 35 artifacts / 8 critical versions, docs synchronized across workspace and repository.
- 2026-08-20 — Integrated the unfinished `fix/preset-locale-copy` worktree onto rc.8: four product-owned preset IDs now use locale-aware zh/en client copy with English-only managed fallbacks, while unknown user presets remain metadata-driven. First-launch runtime staging now excludes and self-cleans accidental `.mimosa` hook state that previously surfaced as a misleading Node package installation failure.

## Discoveries and Deviations

- Local machine has Node 26.7.0 and npm 11.19.0 but no global pnpm; project commands use an exact temporary pnpm 11.19.0 runner.
- Harness rc.8 returns 404 for `/api/health` and `/api/`; host health uses child liveness plus the 2xx Web root.
- electron-builder 26.15.3 uses `singleArchFiles` / `x64ArchFiles`; no `universalArchFiles` option exists. Both official Electron 43.4.0 macOS architecture archives are cached locally for packaging.
- The approved “1/2/4-second backoff” and “third crash opens the circuit” cannot both schedule a third restart. The implementation chooses the safer explicit circuit rule: restart after 1 and 2 seconds, then open the circuit on the third abnormal exit within five minutes.
- Harness package discovery returned an empty client graph from the tested ASAR layout. The verified release uses `asar: false` and an app-owned official bundle manifest, producing 39+ entries.
- Universal assembly preserves paired architecture-qualified native packages; shared Electron and Chromium Mach-O files are true Universal binaries.
- Harness rc.8 may serve the Web root before Cordis registers `agentPreset.list`; integration readiness now waits on that exact API condition and six consecutive diagnostic repetitions passed.
- Computer Use remains blocked by the locked Mac/permissions, and live V4 Flash soak remains blocked by absent user-entered credentials. See the [acceptance report](../../engineering/acceptance-report.md).

## Documentation Write-back

After each verified module, update its implementation facts and `content_stage`; at final verification update architecture, lifecycle, testing, operations, status, and this plan.

## Completion Conditions

All applicable code/tests/packages/runtime evidence/docs/SVG agree, no secrets are captured, and unresolved external blockers are explicit.
