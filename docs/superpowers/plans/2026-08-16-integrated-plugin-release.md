# Integrated Plugin Release 0.3.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a local Universal macOS DMG whose first launch installs every bundled and currently installed Web plugin through the official `dsh plugin --profile web add` flow while preserving existing Harness data and plugins.

**Architecture:** Snapshot the two user-authored installed plugins into immutable application resources, add them to the existing integrated-plugin coordinator, and let the pinned public Harness CLI own profile dependency placement and bundle ordering. Existing official Home migration, bundled pnpm, bare-package loader support, Skills, presets, sessions, and credentials remain unchanged; private user data is never embedded in the installer.

**Tech Stack:** Electron 43.4.0, TypeScript 5.9, Node 24/Electron Node mode, `@deepseek-ai/dsh@0.1.0-rc.6`, pnpm 11.19.0, electron-builder 26.15.3.

## Global Constraints

- Install plugins only through `dsh plugin --profile web add <packaged-root>`.
- Preserve explicit `DSH_HOME`, existing official Home content, existing plugins, sessions, credentials, Skills, and presets.
- Never package credentials, settings, sessions, logs, prompts, or private profile state.
- Retain bare package names in every `cordis.patch.yml`; the Harness child must keep `--expose-internals`.
- Include the installed `dsh-ui-motion@1.0.0` and `dsh-model2-selector@1.0.0` compiled closures as app resources.
- Decide packaging success only from the terminal process exit status and subsequent DMG verification output.
- Do not rerun the previously completed full test suite; run only release preflight and artifact verification required to prove this new package.

---

### Task 1: Consolidate the release base and freeze plugin inventory

**Files:**

- Modify: Git history only
- Create: this plan

- [x] Fetch the remote, create `release/0.3.3-integrated-plugins` from consolidated `main`, and merge every remaining local branch commit.
- [x] Inventory the active legacy Web profile and record only plugin names, versions, install roots, and public package metadata.
- [x] Exclude credentials, sessions, settings, logs, and private runtime state from the installer.

### Task 2: Add the installed plugin closures to the official coordinator

**Files:**

- Create: `packages/dsh-ui-motion/**`
- Create: `packages/dsh-model-two-level-selector/**`
- Modify: `apps/desktop/src/main.ts`
- Modify: `electron-builder.yml`
- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `scripts/verify-macos-artifact.mjs`

- [x] Add release-preflight expectations for both plugin roots, manifests, entry files, client bundles, and bare-name patches; run preflight and observe the expected missing-artifact failure.
- [x] Snapshot the exact installed compiled plugin closures into the repository.
- [x] Package both roots as `extraResources` and reconcile them with the public plugin CLI on every startup.
- [x] Extend mounted-DMG verification to assert both plugin closures and patch names.

### Task 3: Release metadata and documentation

**Files:**

- Modify: `package.json`
- Modify: `AGENTS.md`
- Modify: `docs/project/intent.md`
- Modify: `docs/project/status.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/operations/harness-home-migration.md`
- Modify: `docs/plans/index.md`

- [x] Bump the local integrated release to `0.3.3`.
- [x] Document the six-Web-plugin first-launch set plus the Anchored Standard preset and ownership/preservation rules.
- [x] Record the local-plugin snapshot provenance and final build evidence without including private user data.

### Task 4: Build, verify, and publish the PR

**Files:**

- Generated: `release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg`

- [x] Run `pnpm dist:mac` once and monitor the same terminal session until it exits.
- [x] Require exit code 0, then run `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg --universal`.
- [x] Inspect the final diff and confirm every branch head is an ancestor of the release branch.
- [ ] Commit, push `release/0.3.3-integrated-plugins`, and create a PR against `main`.

## Release Evidence

- Build terminal: `pnpm dist:mac` exited 0 after generating the Universal DMG and blockmap.
- Artifact terminal: `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg --universal` exited 0 after mounted-image signature, runtime, plugin, and Mach-O checks.
- DMG size: 289,838,445 bytes.
- DMG SHA-256: `21835867dc474d39ad04b0de5f0825d1a409ccb2105c055e423e65e919a65cd8`.
- Branch audit: every fetched local and remote branch head is an ancestor of `release/0.3.3-integrated-plugins`.
- Full test suite: intentionally not rerun per the user's packaging instruction; prior full-suite evidence remains in the architecture and acceptance documents.

## Read Set

- [Official Harness installation plan](./2026-08-16-official-harness-install.md) — public CLI, official Home, migration, and packaged pnpm contract.
- [Architecture overview](../../architecture/overview.md) — current resource and lifecycle boundaries.
- [Harness Home migration](../../operations/harness-home-migration.md) — preservation and rollback behavior.

## Risks and Rollback

- A missing compiled plugin artifact aborts preflight before electron-builder starts.
- A failed public CLI install aborts Harness startup and retries on the next launch; user data remains intact.
- Existing user-owned plugin/profile content is not deleted. Rollback is the prior app version plus the unchanged official or legacy Home.
