# DSH Routing Suite 0.3.0 Integration and Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and integrate every Git branch not yet contained by local `main`, ship the reviewed DSHROUTINGSUITE integration plus the Harness Web performance fix, and produce a verified Universal macOS 0.3.0 DMG.

**Architecture:** Start from local `main` at `f56990f`, merge the routing-suite and performance branches without rewriting their history, then harden the combined tree. The routing suite remains an offline, exact-version app resource assembled into the app-owned Harness profile at startup; mutable background code downloads are removed, and build-time archives are accepted only when their pinned SHA-256 matches. The official Harness conversation client remains exact-version patched for the already-verified open-turn projection issue.

**Tech Stack:** TypeScript/Node 24 build and Electron host, DeepSeek Harness 0.1.0-rc.6, pnpm 11.19.0 patched dependencies, Vitest, Playwright Chromium, electron-builder 26.15.3, macOS Universal packaging.

## Global Constraints

- Preserve the official Harness question/session protocols and canonical streaming event ingestion.
- Preserve user-authored profiles, plugins, presets, skills, sessions, credentials, and app data; managed installs may replace only app-owned content with valid ownership markers.
- Keep Harness bound to `127.0.0.1`; do not add renderer Node access or a wider IPC bridge.
- Do not execute mutable, unsigned routing code fetched silently at runtime. Routing artifacts must be immutable version/commit pins with expected SHA-256 values verified before extraction.
- DSHROUTINGSUITE failure remains optional and fail-open: Standard Harness startup continues with a bounded diagnostic.
- Version the combined feature release as `0.3.0` and keep all package/artifact/docs version statements consistent.
- Make changes only in the `release/0.3.0-routing-suite` worktree; preserve all source branches and existing worktrees.
- Use TDD for behavioral/security changes and record RED/GREEN evidence.

---

### Task 1: Merge and inventory all outstanding Git work

**Files:**

- Merge: `feat/routing-suite` at `16c1780`
- Merge: `fix/harness-web-performance` at `bc6a8b5`
- Modify on conflicts: only files touched by both branches/main

**Interfaces:**

- Consumes: local `main` at `f56990f`, verified branch heads, and remote ancestry inventory.
- Produces: one integration head containing every unique commit while retaining branch provenance.

- [ ] **Step 1: Verify branch inventory and merge bases**

Run `git rev-list --left-right --count main...<ref>` for every local/remote branch and confirm only `feat/routing-suite` and `fix/harness-web-performance` contain commits not in `main`.

- [ ] **Step 2: Merge DSHROUTINGSUITE without rewriting history**

Run `git merge --no-ff feat/routing-suite`. Resolve conflicts by preserving main's native conversation-rendering ownership and all routing-suite startup/packaging behavior.

- [ ] **Step 3: Merge the Harness Web performance fix**

Run `git merge --no-ff fix/harness-web-performance`. Preserve the exact rc.6 patch mapping, real-bundle 10,000-delta test, and the newest implementation-backed docs.

- [ ] **Step 4: Verify ancestry and diff integrity**

Run `git merge-base --is-ancestor` for local main, both feature heads, remote main, and the already-merged stream-animation branch; run `git diff --check` and inspect every merged file.

### Task 2: Harden the routing-suite supply chain and startup integration

**Files:**

- Modify: `scripts/fetch-routing-suite.mjs`
- Modify: `apps/desktop/src/main.ts`
- Delete: `apps/desktop/src/lifecycle/routing-suite-update.ts`
- Modify: `tests/unit/routing-suite.test.ts`
- Modify: `README.md`, `README.zh-CN.md`
- Modify: `docs/architecture/overview.md`, `docs/knowledge/upstream-baseline.md`, `docs/engineering/testing.md`

**Interfaces:**

- Consumes: injector `0.3.3`, mode-boost `0.1.0`, router preset commit `eff787e95132d6c7104214542104a84d656b497e`, and the audited archive SHA-256 values.
- Produces: `build/routing-suite` accepted only from exact pins and installed only from the app-bundled resource; no runtime GitHub fetch path.

- [ ] **Step 1: Add a failing checksum test**

Extend the real CLI test to place a deliberately incorrect cached `dsh-external-dsh-super-injector-0.3.3.tgz`, run `scripts/fetch-routing-suite.mjs --cache <fixture> --out <target>`, and assert non-zero exit plus no extracted executable output. This catches moving the checksum check after extraction or omitting it.

- [ ] **Step 2: Run the focused test and capture RED**

Run `pnpm vitest run tests/unit/routing-suite.test.ts`. Expected failure: the current script extracts/accepts bytes without comparing them to a trusted digest.

- [ ] **Step 3: Verify before extraction and remove mutable runtime updates**

Add exact expected SHA-256 values to the three immutable sources and reject a mismatch before any `tar` execution. Remove the background refresh import/call and runtime updater module; always install from the bundled resource. Update user-facing copy to state that routing components update with reviewed application releases, not silent background downloads.

- [ ] **Step 4: Run focused GREEN and mutation check**

Run the focused routing test. Temporarily disable the checksum comparison and confirm the new test fails for the intended reason, then restore and re-run green.

- [ ] **Step 5: Verify routing behavior**

Run routing unit tests, build the pinned snapshot, verify recorded versions/hashes, run runtime closure, and confirm Standard startup still degrades safely if the optional resource is unavailable.

### Task 3: Repair the native-rendering browser contract and release metadata

**Files:**

- Modify: `tests/playwright/desktop-plugin-browser.spec.ts`
- Modify: `package.json`
- Modify: version-bearing docs and active release plans identified by `rg '0\.2\.0'`

**Interfaces:**

- Consumes: main commit `f56990f`, which intentionally leaves conversation/Thinking state to native Harness and registers only `settings.general.item` from the desktop plugin.
- Produces: a browser test that asserts the actual slot identity and one registration, plus consistent application version `0.3.0`.

- [ ] **Step 1: Preserve the observed browser RED**

Record the reproducible failure `expected registrations: 2, received: 1` after rebuilding the plugin.

- [ ] **Step 2: Assert the real public behavior**

Capture slot names passed through `slots.inject`, assert exactly `['settings.general.item']`, verify route-transition style/commit behavior, and verify disposal returns active registrations to zero. Do not restore a global conversation overlay.

- [ ] **Step 3: Run browser GREEN**

Rebuild the plugin and run `pnpm test:e2e`; expected one Chromium test passed.

- [ ] **Step 4: Bump release version**

Change the root package version to `0.3.0`, regenerate the pnpm lock importer if required, and update current artifact paths, acceptance/status, and installation documentation without rewriting historical records that intentionally describe 0.2.0.

### Task 4: Full verification and Universal release artifact

**Files:**

- Generate: `release/DeepSeek-Harness-Code-0.3.0-mac-universal.dmg`
- Modify: `AGENTS.md`, active plan/status/acceptance/knowledge documents with actual evidence

**Interfaces:**

- Consumes: clean integrated source, frozen lockfile, and pinned routing archives.
- Produces: one verified Universal DMG, SHA-256 checksum, clean Git state, and auditable evidence.

- [ ] **Step 1: Run repository gates**

Run focused routing/performance tests, full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm verify:docs`, `pnpm verify:security`, and `pnpm audit --prod`. Distinguish new failures from tracked vendored baseline issues and fix all release-owned failures.

- [ ] **Step 2: Perform a clean frozen install**

Move aside only this worktree's `node_modules`, run `pnpm install --frozen-lockfile`, and rerun focused patch/routing tests to prove both dependency patches and routing pins reproduce from repository state.

- [ ] **Step 3: Build the Universal DMG**

Run `pnpm dist:mac` and retain only the final DMG plus required checksum/evidence; do not replace `/Applications` without a separate explicit user instruction.

- [ ] **Step 4: Verify the artifact**

Run `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.0-mac-universal.dmg --universal`, mount/read the artifact as needed, verify bundle ID/version/signature/resource closure, and compute `shasum -a 256`.

- [ ] **Step 5: Final ancestry/status/docs review**

Confirm every previously unmerged branch head is an ancestor of the release head, inspect final diff/log/status, update implementation-backed documentation with exact commands/results/checksum, and commit the evidence.
