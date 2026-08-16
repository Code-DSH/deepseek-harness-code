---
id: plan.startup-recovery-0.3.1
title: Startup Recovery 0.3.1
summary: Reproduce and fix the Electron pre-ready activation crash and the invalid Routing Suite profile patch that makes the embedded Harness exit before readiness, then package a verified Universal macOS patch release.
kind: plan
status: canonical
content_stage: final-verified
scope: [desktop, electron, harness, routing-suite, macos, packaging]
triggers:
  [
    BrowserWindow before app ready,
    Harness exited before becoming ready,
    startup failure,
  ]
read_when: [diagnosing or releasing the 0.3.1 startup recovery]
skip_when: [unrelated feature work]
priority: must
freshness_class: project
last_verified: 2026-08-16T17:05:00+08:00
owners: [primary-agent]
source_of_truth:
  [
    ../../../apps/desktop/src/main.ts,
    ../../../apps/desktop/src/lifecycle/routing-suite-link.ts,
  ]
related:
  prerequisites: [../../architecture/lifecycle.md, ../../engineering/testing.md]
  next:
    [
      ../../engineering/acceptance-report.md,
      ../../operations/install-unsigned.md,
    ]
supersedes: []
tags: [execplan, startup, bugfix, release]
---

# Startup Recovery 0.3.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to execute this plan task-by-task in the existing isolated worktree.

**Goal:** Make DeepSeek Harness Code start reliably when macOS emits an early `activate` event and when an existing 0.3.0 profile contains the malformed Routing Suite patch, then deliver a verified Universal macOS 0.3.1 DMG.

**Architecture:** Keep every `BrowserWindow` construction behind Electron's resolved `app.whenReady()` boundary. Generate the mode-boost patch as one valid top-level YAML sequence, repair the exact malformed 0.3.0 shape idempotently without overwriting unrelated user-authored entries, and adapt the verified injector entry to the profile-relative path required by the rc.6 Node Loader. Prove the result with the pinned Harness loader plus a packaged-app smoke test.

**Tech Stack:** TypeScript 5.9.2, Electron 43.4.0, Vitest 3.2.4, `@deepseek-ai/dsh` 0.1.0-rc.6, pnpm 11.19.0, electron-builder 26.15.3.

## Global Constraints

- Preserve the user's Harness sessions, credentials, settings, presets, and unrelated `cordis.patch.yml` content.
- Keep the Routing Suite integration and the rc.6 stream-performance patch enabled.
- Add no production dependency solely to parse or rewrite the one managed YAML entry.
- Validate behavior against the exact pinned Harness runtime, not only a string snapshot.
- Keep the app unsigned/ad-hoc signed and never change global Gatekeeper settings.

---

### Task 1: Capture both startup failures

**Files:**

- Inspect: `/Applications/DeepSeek Harness Code.app/Contents/Resources/app/dist/desktop/main.js`
- Inspect: `/Users/trip/Library/Application Support/deepseek-harness-desktop/dsh-home/profiles/web/cordis.patch.yml`
- Inspect: app-owned watchdog/log paths

**Interfaces:**

- Consumes: the installed 0.3.0 app and app-owned profile.
- Produces: bounded diagnostics proving the failing lifecycle callback and Harness parser failure without modifying user data.

- [x] Run the installed pinned DSH entry against an isolated temporary `DSH_HOME` that mirrors the installed Web profile and capture its exit status and stderr.
- [x] Resolve the exception stack offsets against the installed `dist/desktop/main.js` and record the exact pre-ready `activate` callback.
- [x] Confirm that the installed patch contains the invalid top-level `[]` followed by `- insert:` shape.

### Task 2: Guard Electron activation with a regression test

**Files:**

- Create: `tests/unit/app-readiness.test.ts`
- Modify: `apps/desktop/src/main.ts`

**Interfaces:**

- Consumes: Electron's `app.whenReady(): Promise<void>` and macOS `activate` event.
- Produces: a startup registration contract under which `new BrowserWindow()` is unreachable before readiness.

- [x] Add a Vitest Electron mock that keeps `whenReady()` pending, imports the real main module, emits `activate`, and asserts that BrowserWindow construction does not occur.
- [x] Run `pnpm exec vitest run tests/unit/app-readiness.test.ts` and retain the failing `Cannot create BrowserWindow before app is ready` evidence.
- [x] Register the `activate` handler only inside the successful `app.whenReady()` continuation while preserving create-or-show behavior after readiness.
- [x] Re-run the focused test and existing window lifecycle tests until they pass.

### Task 3: Repair the Routing Suite patch with migration coverage

**Files:**

- Modify: `tests/unit/routing-suite.test.ts`
- Modify: `apps/desktop/src/lifecycle/routing-suite-link.ts`
- Modify: `scripts/fetch-routing-suite.mjs`

**Interfaces:**

- Consumes: empty/default, malformed 0.3.0, valid user-authored, and already-managed patch files.
- Produces: one valid YAML sequence containing exactly one profile-relative `mode-boost` insert, plus one verified injector patch adapted to profile-relative resolution, while retaining unrelated valid entries.

- [x] Extend the routing test to load the generated patch through the exact pinned Harness YAML loader and assert one managed insert.
- [x] Add a migration fixture matching the installed 0.3.0 comments plus `[]` plus `- insert:` output and assert a valid, idempotent repaired sequence.
- [x] Run the focused routing tests and retain the parser failure before changing production code.
- [x] Replace the empty/default sequence instead of appending after `[]`, detect and normalize only the exact malformed managed shape, and preserve unrelated valid entries.
- [x] Adapt the checksum-verified injector patch from its bare entry to the same profile-relative public entry point and reject an unexpected upstream patch shape.
- [x] Re-run the routing unit tests and a real pinned-Harness startup against an isolated generated profile; the Web root returned HTTP 200 on port 47978.

### Task 4: Package and validate 0.3.1

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/architecture/lifecycle.md`
- Modify: `docs/engineering/testing.md`
- Modify: `docs/engineering/acceptance-report.md`
- Generate: `release/DeepSeek-Harness-Code-0.3.1-mac-universal.dmg`

**Interfaces:**

- Consumes: the two green regression fixes and clean dependency installation.
- Produces: one Universal macOS patch-release DMG with checksum and startup evidence.

- [x] Bump only the application patch version from 0.3.0 to 0.3.1; the lockfile carries no root package version and remained unchanged.
- [x] Run focused tests, full unit/integration gates, typecheck, lint, format, docs links, security checks, build, and runtime preflight; all applicable gates passed.
- [x] Build the Universal DMG, run `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.1-mac-universal.dmg --universal`, and record SHA-256 `35d7a81fbddd8ffb479b5834ac2b669eb5708c62ac67781f6d43368af91bbf79`.
- [x] Run the packaged app's Electron executable and bundled DSH with an isolated profile, receive HTTP 200 from the local Web root, and terminate the smoke-test instance cleanly.
- [x] Review the final diff and report the artifact path, verification evidence, and any residual risks.
