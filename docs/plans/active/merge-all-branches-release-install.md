---
id: plan.merge-all-branches-release-install
title: Merge All Branches, Release, and Install
summary: Integrate every local and fetched remote branch plus the in-progress Anchored Standard worktree, build one clean Universal DMG, and replace the installed app without deleting user data.
kind: plan
status: canonical
content_stage: partial-implementation
scope: [repository, integration, macos, packaging, installation]
triggers: [merge all branches, DMG, replace application, preserve data]
read_when: [integrating the 2026-08-16 release candidate]
skip_when: [unrelated feature work]
priority: must
freshness_class: project
last_verified: 2026-08-16T19:17:07+08:00
owners: [primary-agent]
source_of_truth:
  [../../../.git, ../../../package.json, ../../../electron-builder.yml]
related:
  prerequisites: [./deepseek-harness-desktop.md, ../../engineering/testing.md]
  next:
    [
      ../../engineering/acceptance-report.md,
      ../../operations/install-unsigned.md,
    ]
supersedes: []
tags: [execplan, release, installation]
---

# Merge All Branches, Release, and Install Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to execute this plan task-by-task in the existing isolated worktree.

**Goal:** Put every committed branch and all in-progress Anchored Standard changes into local `main`, produce a freshly verified Universal DMG, and install its app in `/Applications` while retaining the existing Electron/Harness user data.

**Current status (2026-08-16):** the primary worktree is now `feat/routing-suite`, which already contains the Routing Suite auto-load integration, bundled Superpowers Skills, bilingual preset localization, and the progressive Anchored Standard work. The clean DMG rebuild and `/Applications` replacement tasks remain open; see [acceptance report](../../engineering/acceptance-report.md) for the current partial browser/lint gates.

**Architecture:** The dirty feature worktree is the integration boundary. Its current changes are committed first, then local `main` is merged into that branch so conflict resolution and verification happen away from `main`; the verified integration head is then fast-forwarded into `main`. Packaging starts from a clean local-output state, installation uses the app mounted from the verified DMG, and the existing application plus user-data directories receive recoverable backups before replacement.

**Tech Stack:** Git worktrees, pnpm 11.19.0, TypeScript 5.9.2, Electron 43.4.0, electron-builder 26.15.3, macOS `hdiutil`/`codesign`/`ditto`.

## Global Constraints

- Preserve `/Users/trip/Library/Application Support/DeepSeek Harness Code` and any app-owned data path discovered from the shipped bundle identifier `community.deepseek.harness.code`.
- Do not delete or overwrite the existing app until the new DMG has passed repository verification.
- Keep the release unsigned/ad-hoc signed; never disable Gatekeeper globally.
- Retain the final DMG as the requested deliverable; remove stale and intermediate build/package outputs.
- Do not rewrite branch history or force-reset user work.

---

### Task 1: Inventory and recovery boundary

**Files:**

- Inspect: `.git/`, all worktrees, `/Applications/DeepSeek Harness Code.app`
- Create: `docs/plans/active/merge-all-branches-release-install.md`

**Interfaces:**

- Consumes: fetched local/remote refs and the dirty `feat/anchored-standard-progressive` worktree.
- Produces: an exact branch/dirty-state inventory and a recoverable integration path.

- [x] Fetch all configured remotes with pruning and enumerate local/remote branches.
- [x] Prove with `git rev-list --left-right --count` that committed feature heads are ancestors of local `main`.
- [x] Confirm local `main` is clean and the Anchored Standard worktree contains the only outstanding source changes.
- [x] Identify the installed app bundle identifier and version without launching or modifying it.

### Task 2: Validate and commit the outstanding feature work

**Files:**

- Modify: every tracked and untracked file already present in the `feat/anchored-standard-progressive` worktree.
- Test: `tests/unit`, `tests/e2e`, `packages/*/test`.

**Interfaces:**

- Consumes: the complete dirty worktree state.
- Produces: one traceable feature commit without secrets or whitespace errors.

- [x] Wait for the already-running artifact verifier to finish; do not mutate its inputs while active.
- [x] Run `git diff --check` and scan changed/untracked files for credential material.
- [x] Run `npm exec --yes --package=pnpm@11.19.0 -- pnpm test`, `typecheck`, `lint`, `format:check`, `verify:docs`, and `verify:security`.
- [x] Commit all intended Anchored Standard changes with a descriptive feature commit.

### Task 3: Integrate main inside the feature worktree

**Files:**

- Modify: only merge-conflicted files, if any.
- Test: the complete repository verification surface.

**Interfaces:**

- Consumes: the feature commit and local `main` at `140eb212846064bd89b9e0e7113f5c0e15f09f47` or its verified successor.
- Produces: one integration head containing every branch and dirty-worktree change.

- [x] Merge local `main` into `feat/anchored-standard-progressive` without rebasing or rewriting history.
- [x] Resolve conflicts by preserving both the already-verified streaming animation and Anchored Standard behavior.
- [x] Run the full tests, typecheck, lint, formatting, documentation-link, and security gates.
- [ ] Verify `main`, `feature/stream-output-animation`, and fetched remote heads are ancestors of the integration head.
- [ ] Fast-forward local `main` to the verified integration head.

### Task 4: Clean build and Universal DMG

**Files:**

- Generate: `release/DeepSeek-Harness-Code-0.2.0-mac-universal.dmg`
- Remove before build: `dist/`, `release/`, `test-results/`, `playwright-report/`, and project-local tool caches.

**Interfaces:**

- Consumes: clean local `main` and the pinned lockfile.
- Produces: one current Universal DMG and checksum.

- [ ] Remove stale project-local build, test, and package outputs; keep dependency stores and unrelated global caches intact.
- [ ] Run `npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile`.
- [ ] Run `npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:mac`.
- [ ] Run `npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:mac release/DeepSeek-Harness-Code-0.2.0-mac-universal.dmg --universal`.
- [ ] Record `shasum -a 256` and prove the mounted app has the expected bundle identifier, version, signatures, and Universal/qualified Mach-O layout.

### Task 5: Preserve data and replace the installed app

**Files:**

- Replace: `/Applications/DeepSeek Harness Code.app`
- Preserve: app user data and preferences under `/Users/trip/Library`.
- Backup: the previous app and existing user-data directories to timestamped recoverable locations.

**Interfaces:**

- Consumes: the verified DMG-mounted app.
- Produces: the latest `/Applications/DeepSeek Harness Code.app` with pre-existing user data still present.

- [ ] Confirm no app/runtime process is active; request graceful quit and wait before escalating.
- [ ] Snapshot size/count metadata and make a timestamped `ditto` backup of each discovered app-owned user-data directory.
- [ ] Mount the verified DMG read-only and validate the source app identity again.
- [ ] Stage the new app in `/Applications`, move the old app to a timestamped recoverable backup, and atomically rename the staged app into place.
- [ ] Remove quarantine only from `/Applications/DeepSeek Harness Code.app`; do not change global Gatekeeper settings.
- [ ] Launch the installed app, verify its process and usable local Web root, then quit it cleanly.
- [ ] Confirm preserved data directory size/count metadata still exists after the smoke test.

### Task 6: Final cleanup and evidence

**Files:**

- Retain: the final DMG and checksum evidence.
- Remove: intermediate `dist/`, unpacked app directories, blockmaps, builder debug files, test reports, and project-local caches.
- Update: active plan, acceptance/status documentation, and repository router.

**Interfaces:**

- Consumes: verified installed app and release artifact.
- Produces: a clean repository, one final DMG, an installed latest app, and auditable evidence.

- [ ] Remove only intermediate project-local outputs, leaving the final DMG intact.
- [ ] Re-run installed bundle identity/signature/quarantine checks and final Git ancestry/status checks.
- [ ] Update implementation-backed documentation with the exact commit, checksum, install path, preserved-data evidence, and any limitations.
- [ ] Review the final diff and report verification commands and outcomes without claiming unrun checks.
