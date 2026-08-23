# Plugin-owned Updater and LAN Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all update UI into `dsh-updater-check`, expose a read-only authenticated LAN status stream, and produce a verified Universal macOS DMG without changing official Harness source.

**Architecture:** A small in-memory updater status store is the single source for Electron preload replay and LAN proxy snapshots/SSE. The plugin renders both desktop and remote read-only views; only the desktop bridge exposes mutation methods. `@deepseek-ai/dsh` remains an untouched pinned dependency.

**Tech Stack:** TypeScript, Electron 43.4.0, Node HTTP server, Zod, Vitest, Playwright, pnpm 11.19.0, electron-builder 26.15.3.

**Spec:** `docs/superpowers/specs/2026-08-23-plugin-updater-lan-status-design.md`

## Global Constraints

- Do not edit `@deepseek-ai/dsh`, installed `node_modules`, or any official Harness source.
- Keep Harness and the desktop renderer loopback-only; only the Electron-owned LAN proxy may listen on `0.0.0.0`.
- LAN status is read-only and uses the existing password/token authentication; no remote update or restart action.
- Do not expose passwords, tokens, cookies, prompts, responses, or credentials in status payloads or logs.
- Preserve all existing uncommitted user changes; never use reset, destructive checkout, force push, or broad deletion.
- Use TDD for behavior changes: failing test, observed failure, minimal implementation, passing focused test, then refactor.
- Build and verify the DMG from the final integrated tree; report the exact artifact path and SHA-256.

---

### Task 1: Preserve the working tree and record the integration baseline

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-plugin-updater-lan-status-design.md`
- Modify: `docs/superpowers/plans/2026-08-23-plugin-updater-lan-status.md`
- Inspect only: current dirty files, `origin/main`, `origin/review/install-update-flow`, and all branch refs

**Interfaces:**
- Consumes: current worktree at `review/install-update-flow`, `origin/main@9e78d31`, existing PR #33.
- Produces: a recoverable plan and a captured list of pre-existing modified/untracked paths.

- [x] **Step 1: Capture the baseline**

  Run:

  ```bash
  git status --short --branch
  git diff --check
  git for-each-ref --format='%(refname:short) %(objectname:short)' refs/heads refs/remotes/origin
  ```

  Expected: no destructive command; every pre-existing dirty path is recorded in the session notes before implementation.

- [x] **Step 2: Fetch remote refs without changing the worktree**

  Run:

  ```bash
  git fetch origin --prune
  gh pr view 33 --json state,statusCheckRollup,url
  ```

  Expected: remote refs are current; PR #33 status is evidence only and does not replace local verification.

- [ ] **Step 3: Commit only the design and plan documents**

  Run:

  ```bash
  git add docs/superpowers/specs/2026-08-23-plugin-updater-lan-status-design.md docs/superpowers/plans/2026-08-23-plugin-updater-lan-status.md
  git commit -m "docs: design plugin updater LAN status flow"
  ```

  Expected: no unrelated dirty file is staged.

### Task 2: Add the replayable updater status store

**Files:**
- Create: `apps/desktop/src/lifecycle/updater-status.ts`
- Test: `tests/unit/updater/status.test.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/ipc-handlers.ts`
- Modify: `apps/desktop/src/preload-api.ts`
- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `tests/unit/preload-bridge.test.ts`
- Modify: `tests/unit/ipc-handlers.test.ts`

**Interfaces:**
- Produces `createUpdaterStatusStore(initial?: UpdaterStatus)` with `get(): UpdaterStatus`, `publish(status: UpdaterStatus): void`, and `subscribe(listener: (status: UpdaterStatus) => void): () => void`.
- Produces preload `window.deepseekDesktop.updater.getStatus(): Promise<UpdaterStatus>` and keeps `check/apply/restart/subscribe` unchanged.

- [ ] **Step 1: Write the failing store test**

  Add tests asserting an initial `idle` snapshot, immediate subscriber replay, later publish delivery, unsubscribe behavior, and defensive snapshot copies.

- [ ] **Step 2: Run the focused test and observe the expected failure**

  ```bash
  pnpm exec vitest run tests/unit/updater/status.test.ts
  ```

  Expected: FAIL because `updater-status.ts` does not yet export the store.

- [ ] **Step 3: Implement the minimal store**

  Use a `Set` of listeners, publish a copied status object, invoke a new subscriber with the current snapshot, and return an idempotent unsubscribe function. Do not add persistence or timers.

- [ ] **Step 4: Wire the store into main and preload**

  Main keeps one store initialized to `{ phase: "idle" }`. `publishUpdaterStatus` publishes before sending Electron IPC. Add fixed IPC channel `updater:status` and schema-parse the result. The LAN proxy will consume the same store in Task 3.

- [ ] **Step 5: Update bridge/IPC contract tests and run focused tests**

  ```bash
  pnpm exec vitest run tests/unit/updater/status.test.ts tests/unit/preload-bridge.test.ts tests/unit/ipc-handlers.test.ts
  ```

  Expected: PASS with no new capability outside the fixed updater group.

### Task 3: Add authenticated LAN status JSON and SSE routes

**Files:**
- Modify: `apps/desktop/src/lifecycle/lan-proxy.ts`
- Modify: `apps/desktop/src/main.ts`
- Test: `tests/unit/lan-proxy.test.ts`

**Interfaces:**
- `LanProxyHost` accepts optional `getUpdaterStatus?: () => UpdaterStatus` and `subscribeUpdaterStatus?: (listener: (status: UpdaterStatus) => void) => () => void`.
- Routes are `GET /__dsh/update/status` and `GET /__dsh/update/events`; both return the existing `UpdaterStatus` shape and never forward upstream.

- [ ] **Step 1: Write failing route tests**

  Add tests for JSON snapshot, SSE initial event plus a later published event, no upstream request, empty-password direct access, and configured-password 401/Basic Auth behavior.

- [ ] **Step 2: Run the focused LAN tests and observe failure**

  ```bash
  pnpm exec vitest run tests/unit/lan-proxy.test.ts
  ```

  Expected: FAIL because the special status routes do not yet exist.

- [ ] **Step 3: Implement the JSON route**

  Authenticate first, accept only `GET`, serialize the bounded current status with `cache-control: no-store`, `content-type: application/json; charset=utf-8`, and `x-content-type-options: nosniff`.

- [ ] **Step 4: Implement the SSE route and cleanup**

  Authenticate first, send one `update` event immediately, subscribe to later status changes, send a `: keep-alive` comment every 15 seconds, and remove the listener/timer on client close or proxy stop. Track all status streams so `stop()` cannot leave them open.

- [ ] **Step 5: Run the focused LAN suite**

  ```bash
  pnpm exec vitest run tests/unit/lan-proxy.test.ts tests/unit/lan-access-controller.test.ts
  ```

  Expected: PASS; existing WebSocket and token/password behavior remains unchanged.

### Task 4: Move the update panel into `dsh-updater-check`

**Files:**
- Modify: `packages/dsh-updater-check/lib/client.js`
- Modify: `apps/desktop/src/preload.ts`
- Test: `tests/e2e/plugin-updater-check.test.ts`
- Modify: `tests/unit/preload-bridge.test.ts` if the overlay import contract changes

**Interfaces:**
- The plugin consumes `window.deepseekDesktop.updater` in Electron and same-origin `/__dsh/update/events` in LAN browsers.
- The plugin exports the same official loader shape (`inject: ["slots"]`, `apply(ctx)`), with all visible update UI created by the plugin.

- [ ] **Step 1: Write failing plugin behavior tests**

  Load the plugin through the existing VM harness and assert that its source/module installs a settings row, subscribes to desktop `getStatus/subscribe`, opens the action panel for `available`, renders percentage and byte counts for `downloading`, renders verification and ready-to-restart copy, and does not expose an update mutation function to a remote browser.

- [ ] **Step 2: Run the focused plugin test and observe failure**

  ```bash
  pnpm exec vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-updater-check.test.ts
  ```

  Expected: FAIL because the current plugin only owns the settings row and the preload owns the overlay.

- [ ] **Step 3: Implement the plugin panel**

  Add a small plugin-owned panel with a single status renderer. Desktop mode calls `getStatus()` on mount, subscribes to updates, and uses `check/apply/restart` only for host actions. Remote mode opens the authenticated SSE endpoint and falls back to bounded polling of `/__dsh/update/status`; remote mode displays status only and says “请在主机桌面确认更新”. Keep bytes and messages bounded by the existing schema.

- [ ] **Step 4: Remove the duplicate preload overlay**

  Delete only the DOM overlay creation/subscription from `apps/desktop/src/preload.ts`; keep `contextBridge.exposeInMainWorld` and paste shortcut behavior unchanged. This changes our host preload, not official Harness source.

- [ ] **Step 5: Run focused plugin and bridge tests**

  ```bash
  pnpm exec vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-updater-check.test.ts
  pnpm exec vitest run tests/unit/preload-bridge.test.ts tests/unit/ipc-handlers.test.ts
  ```

  Expected: PASS and no duplicate overlay implementation remains.

### Task 5: Update implementation-backed docs and check the package boundary

**Files:**
- Modify: `packages/dsh-updater-check/package.json`
- Modify: `packages/README.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/lifecycle.md`
- Modify: `docs/operations/troubleshooting.md`
- Modify: `docs/index.md`
- Modify: `docs/knowledge/upstream-baseline.md`
- Test: `tests/unit/package-runtime-closure.test.ts` or the closest existing plugin inventory contract

**Interfaces:**
- Documents the plugin-owned UI and host-owned capability boundary without claiming official Harness source changes.
- Package resources continue to include only the plugin package files required by `electron-builder.yml`.

- [ ] **Step 1: Add/adjust the package contract assertion**

  Assert the updater package manifest keeps the official Web client platform and bare-name patch, and that no `@deepseek-ai/dsh` source path is bundled or modified.

- [ ] **Step 2: Update docs from observed behavior**

  Document the two LAN read-only endpoints, authentication behavior, host-only mutation, and the plugin UI ownership. Remove stale wording that says the preload owns the visible update dialog.

- [ ] **Step 3: Run doc/security checks**

  ```bash
  pnpm verify:docs
  pnpm verify:security
  git diff --check
  ```

  Expected: all local links and security contract checks pass.

### Task 6: Full verification and local build

**Files:**
- Build outputs: `dist/`, `build/`, `release/` (generated only; do not hand-edit)
- Test: all existing suites and `scripts/verify-macos-artifact.mjs`

**Interfaces:**
- Consumes the final implementation tree and existing pinned dependency lockfile.
- Produces a Universal DMG and ZIP with the verified plugin/runtime inventory.

- [ ] **Step 1: Run source checks**

  ```bash
  pnpm test:unit
  pnpm test:plugin
  pnpm typecheck
  pnpm lint
  pnpm format:check
  ```

- [ ] **Step 2: Build and run closure checks**

  ```bash
  pnpm build
  pnpm preflight:runtime
  pnpm check:memory
  ```

- [ ] **Step 3: Build the local Universal DMG**

  ```bash
  pnpm dist:mac
  ```

  Expected: one `release/DeepSeek-Harness-Code-<version>-mac-universal.dmg` and the matching Universal ZIP.

- [ ] **Step 4: Verify the mounted DMG**

  ```bash
  node scripts/verify-macos-artifact.mjs release/DeepSeek-Harness-Code-*-mac-universal.dmg --universal
  shasum -a 256 release/DeepSeek-Harness-Code-*-mac-universal.dmg
  ```

  Expected: mount verification and deep code-signature checks pass; the report records the exact artifact path and hash.

### Task 7: Integrate cloud branches without destructive history rewriting

**Files:**
- Git refs/commits only; no source file target is predetermined until branch diffs are reviewed

**Interfaces:**
- Consumes: final feature branch, current `origin/main`, and branch inventory captured in Task 1.
- Produces: a clean integrated branch/PR state and a documented list of branches already merged, intentionally skipped as historical, or merged after review.

- [ ] **Step 1: Refresh and classify branches**

  ```bash
  git fetch origin --prune
  git for-each-ref --format='%(refname:short) %(objectname:short)' refs/heads refs/remotes/origin
  git log --left-right --cherry-pick --oneline origin/main...<candidate>
  ```

  Classify each branch as already contained, documentation-only, historical release snapshot, relevant unmerged change, or conflicting/unsafe.

- [ ] **Step 2: Protect dirty user changes**

  Before any checkout/merge, use a recoverable, explicitly named local stash or commit only after reviewing the exact paths. Do not reset, force checkout, or delete any user file. Restore the worktree before final verification.

- [ ] **Step 3: Merge only reviewed effective changes**

  Merge the current feature work into the chosen current base using normal merge commits or fast-forward where safe. Do not blindly merge obsolete release branches whose commits are already contained in `origin/main`.

- [ ] **Step 4: Re-run final verification on the merged result**

  ```bash
  git status --short --branch
  git diff --check
  pnpm test:unit
  pnpm test:plugin
  pnpm build
  ```

  Expected: the integrated tree is green and the local DMG is rebuilt from that exact tree if the merge changed source or packaged resources.

- [ ] **Step 5: Report integration evidence**

  Record the final commit, branch, PR state, skipped historical branches with reasons, DMG path, SHA-256, and any platform-only limitations.

## Completion checklist

- [ ] Official Harness source remains unchanged.
- [ ] All visible updater UI is owned by `dsh-updater-check`.
- [ ] Desktop updater has replayable state and live progress.
- [ ] LAN HTTP exposes authenticated read-only status JSON/SSE.
- [ ] Remote clients cannot update or restart the host.
- [ ] Focused, full, security, documentation, build, and DMG checks pass.
- [ ] Effective cloud branches are integrated without destructive history rewrite.
