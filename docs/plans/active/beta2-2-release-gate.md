---
id: plan.beta2-2-release-gate
title: Beta 2-2 Release Gate Recovery
summary: 修复 Beta 2-2 Windows 冷启动超时，补齐原生架构与无 Node 安装场景，更新版本差异文档，并在全部云端门禁通过后发布。
kind: plan
status: canonical
content_stage: partial-implementation
scope: [release, ci, packaging, installation, documentation]
triggers: [beta2-2, release, ci, package smoke, node prerequisite]
read_when: [恢复 Beta 2-2 发布或审计 Beta 1/Beta 2 差异]
skip_when: [与发布无关的局部代码修改]
priority: must
freshness_class: project
last_verified: 2026-08-21T18:30:00+08:00
owners: [primary-agent]
source_of_truth:
  - ../../../.github/workflows/
  - ../../../scripts/smoke-packaged-runtime.mjs
  - ../../../apps/desktop/src/
  - ../../../tests/
related:
  prerequisites:
    - ./beta2-2-lan-access.md
    - ../../engineering/testing.md
  next:
    - ../../releases/0.1.0-BETA2-2.md
supersedes: []
tags: [execplan, release, ci, beta2-2]
---

# Beta 2-2 Release Gate Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `0.1.0-BETA2-2` only after the installed artifacts start successfully on native x64/arm64 runners, the no-Node prerequisite path is verified, and the version-difference documentation matches Git/CI evidence.

**Architecture:** Keep the product contract unchanged: Harness remains loopback-only and the app requires an official system Node.js `>=22.13`. Reduce first-launch work by passing the complete managed plugin roster to one official `dsh plugin --profile web add` invocation, then make the package smoke runner architecture-aware and add a separate no-Node evidence phase that never starts Harness. GitHub Actions builds once per native target and runs installer/application smoke checks on matching hosted virtual machines before the release job can run.

**Tech Stack:** Electron 43.4.0, TypeScript/Node.js 24, Vitest, GitHub Actions, electron-builder 26.15.3, official `@deepseek-ai/dsh@0.1.0-rc.8` CLI.

**Spec:** User request dated 2026-08-21 plus [Beta 2-2 LAN design](../../superpowers/specs/2026-08-21-beta2-2-lan-access-design.md).

## Global Constraints

- Harness must continue to bind only to `127.0.0.1`; package smoke must prove the listener owner is the Harness PID.
- The app must use the system-installed official Node.js `>=22.13`; it must not download, bundle, or silently install Node.js.
- No-Node verification must prove the official installer-link guidance and absence of a Harness process without blocking on an interactive dialog.
- Plugin changes must continue through `dsh plugin --profile web add`, preserve user plugin specs, use `shell: false`, and never hand-edit normal profile dependencies.
- Native smoke must run on matching x64/arm64 runner architecture. Cross-built artifacts may be uploaded but do not count as installation/startup evidence.
- A 600-second cold-start ceiling is the release limit. Evidence must record elapsed startup time so a timeout cannot be reported as a successful slow install.
- `v0.1.0-BETA2-2` may be moved only because its first tag workflow failed before a GitHub Release was created. `v0.1.0-BETA2-1` source tag remains for history when its downloadable Release/assets are removed.
- Never print credentials, cookies, prompt bodies, or response bodies in CI evidence.

## Read Set

- [Beta 2-2 LAN plan](./beta2-2-lan-access.md) — existing feature boundary and pending release task; verified 2026-08-21.
- [Testing strategy](../../engineering/testing.md) — current test layers and claims; verified 2026-08-21.
- [BETA1 notes](../../releases/0.1.0-BETA1.md), [BETA2 notes](../../releases/0.1.0-BETA2.md), and [BETA2-1 notes](../../releases/0.1.0-BETA2-1.md) — release-difference source documents; verified against Git tags and CI 2026-08-21.
- GitHub Actions runs `32468966137` and `32468983175` — source SHA `012527f`; main CI green, Windows x64 installed-package smoke failed before ready evidence.
- GitHub Issue #10 — BETA1 watchdog restart race; GitHub Issue #17 — Windows source-build prerequisites and Node documentation drift.
- GitHub runner-images current labels — `ubuntu-24.04-arm`, `windows-11-arm`, `macos-15`, and `macos-15-intel`; verified from the official runner-images repository 2026-08-21.

## Current Facts and Root-Cause Hypothesis

- The failed Windows x64 job installed the NSIS package, detected Node.js `24.18.0`, and installed the pinned Harness runtime before exceeding the 600-second ready-evidence deadline.
- First launch currently performs 16 serial synchronous official plugin CLI calls. The candidate patch combines the exact same validated install specs into one official CLI call.
- Hypothesis: repeated pnpm resolution/linking in 16 serial CLI invocations dominates Windows cold-start time. The hypothesis is accepted only if the same Windows package smoke becomes green and emits bounded elapsed-time evidence.

---

### Task 1: Batch official plugin reconciliation and prove the Windows timeout regression

**Files:**

- Modify: `tests/unit/desktop-plugin-link.test.ts`
- Modify: `apps/desktop/src/lifecycle/desktop-plugin-link.ts`

**Interfaces:**

- Consumes the existing validated `installRequests` array.
- Produces one `runCommand(nodeExecutable, [dshEntry, "plugin", "--profile", "web", "add", ...installSpecs], options)` call per attempt.
- Preserves the current one-time corrupted-`node_modules` retry and combined diagnostic capped at 2,000 characters.

- [ ] **Step 1: Verify RED against `012527f`**

  Run the changed unit test against the tagged production implementation. Expected failure: the command runner is called once per plugin instead of once for the complete roster.

- [ ] **Step 2: Verify the exact batched argv contract**

  Assert the literal prefix `plugin --profile web add`, followed by the legacy spec first and every resolved integrated plugin root in input order. Assert `shell: false`, the managed `DSH_HOME`/pnpm environment, and that an empty install roster never invokes the CLI.

- [ ] **Step 3: Implement the single official CLI invocation**

  Keep input validation and `shell: false`; join package names only for the error message and do not concatenate shell text.

- [ ] **Step 4: Verify GREEN**

  Run `pnpm exec vitest run tests/unit/desktop-plugin-link.test.ts`. Expected: all non-Windows fixtures pass and the Windows-only fixture remains the only designed skip on macOS.

- [ ] **Step 5: Commit**

  Commit only the two files with subject `fix(desktop): batch official plugin reconciliation`.

### Task 2: Run package startup smoke on native Windows, Linux, and both macOS architectures

**Files:**

- Modify: `tests/e2e/package-smoke-runtime.test.mjs`
- Modify: `tests/e2e/package-contract.test.ts`
- Modify: `scripts/smoke-packaged-runtime.mjs`
- Modify: `.github/workflows/package.yml`

**Interfaces:**

- `assertKnownRunnerArchitecture(platform, arch)` accepts `x64` and `arm64` for Windows, Linux, and macOS only.
- `inspectArchitecture(executable)` validates PE x64 `0x8664`, PE arm64 `0xaa64`, Linux x86-64/AArch64 ELF, and macOS Universal Mach-O (`x86_64` + `arm64`).
- Package jobs run on `windows-2025`, `windows-11-arm`, `ubuntu-24.04`, `ubuntu-24.04-arm`, and a macOS build runner. macOS launch validation downloads the same Universal artifact on both `macos-15` and `macos-15-intel`.

- [ ] **Step 1: Write failing architecture and workflow-contract tests**

  Add literal fixtures for PE machine `34404` and `43620`, Linux `x86-64` and `ARM aarch64`, Universal Mach-O arch output, native runner labels, and smoke-step conditions for both architectures.

- [ ] **Step 2: Run RED**

  Run `pnpm exec vitest run --config tests/e2e/package-vitest.config.ts tests/e2e/package-smoke-runtime.test.mjs tests/e2e/package-contract.test.ts`. Expected: arm64 runner acceptance and native workflow assertions fail against the current implementation.

- [ ] **Step 3: Implement architecture-aware inspection and native workflow jobs**

  Replace x64-only guards with platform/architecture pairs. Preserve exact artifact filename/target checks. Run Windows install/smoke/uninstall on x64 and arm64; run Linux AppImage and deb smoke/purge on x64 and arm64; mount/download the Universal macOS artifact and run the installed-app smoke on Apple Silicon and Intel.

- [ ] **Step 4: Record elapsed time**

  Add `runtime.readyDurationMs` to sanitized evidence and reject values above `SMOKE_TIMEOUT_MS=600000`.

- [ ] **Step 5: Run GREEN**

  Run the focused package suite, then `pnpm test:package`. Expected: zero failures.

- [ ] **Step 6: Commit**

  Commit the four files with subject `ci: verify packages on native architectures`.

### Task 3: Add a real packaged no-Node prerequisite smoke phase

**Files:**

- Modify: `tests/unit/smoke-contract.test.ts`
- Modify: `tests/e2e/package-smoke-runtime.test.mjs`
- Modify: `apps/desktop/src/lifecycle/smoke-contract.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `scripts/smoke-packaged-runtime.mjs`
- Modify: `.github/workflows/package.yml`

**Interfaces:**

- `SmokeConfig` gains a validated scenario enum `runtime | node-required`; normal users cannot activate it because smoke configuration remains packaged-only, nonce-bound, matrix-allowlisted, and evidence-root constrained.
- The `node-required` scenario runs the installed app with Node paths removed from the child environment, records the official architecture-specific installer URL and minimum version, confirms no Harness ready/listener evidence, exits zero after acknowledgement, and never opens an external browser in CI.
- The parent smoke verifier validates this evidence separately from normal runtime ready/final evidence.

- [ ] **Step 1: Write failing smoke-config and no-Node evidence tests**

  Cover invalid scenario rejection, packaged-only gating, official `https://nodejs.org/` installer URL, `22.13.0` minimum, no Harness PID/origin fields, and clean acknowledgement/exit.

- [ ] **Step 2: Run RED**

  Run `pnpm exec vitest run tests/unit/smoke-contract.test.ts --config tests/e2e/package-vitest.config.ts tests/e2e/package-smoke-runtime.test.mjs`. Expected: the scenario is absent and no-Node evidence cannot be produced.

- [ ] **Step 3: Implement the packaged-only no-Node path**

  Keep the normal dialog unchanged outside CI. In validated smoke mode, write the node-required evidence instead of showing a blocking dialog or opening the URL, await the nonce acknowledgement, then request a clean quit.

- [ ] **Step 4: Add native no-Node workflow steps**

  Reuse each installed/extracted artifact after the runtime smoke. Strip Node from the child lookup environment without removing OS utilities needed by Electron. Require the node-required evidence and clean exit on Windows x64/arm64, Linux x64/arm64, macOS Apple Silicon, and macOS Intel.

- [ ] **Step 5: Run GREEN and security checks**

  Run focused tests, `pnpm check`, and `node scripts/check-security-contract.mjs`. Expected: no automatic Node downloader/installer path becomes reachable.

- [ ] **Step 6: Commit**

  Commit the six files with subject `test(package): verify no-node guidance`.

### Task 4: Rewrite Beta release and CI coverage documentation from verified evidence

**Files:**

- Modify: `docs/releases/0.1.0-BETA1.md`
- Modify: `docs/releases/0.1.0-BETA2.md`
- Modify: `docs/releases/0.1.0-BETA2-1.md`
- Modify: `docs/releases/0.1.0-BETA2-2.md`
- Modify: `docs/engineering/testing.md`
- Modify: `docs/engineering/acceptance-report.md`
- Modify: `docs/project/status.md`
- Modify: `docs/index.md`
- Modify: `docs/plans/index.md`
- Create: `docs/knowledge/topics/github-actions-runner-matrix.md`
- Modify: `docs/knowledge/index.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Documentation distinguishes product bugs, CI/release-pipeline bugs, and coverage gaps.
- It states that no formal `BETA1-1` tag or Release exists; if the reported name meant BETA2-1, the retired-download reason and known installation/prerequisite failures are listed under BETA2-1 without rewriting history.
- It corrects the BETA1 Node-model drift: PR #4 predates the BETA1 tag, so the tag code used system Node even though the old release prose claimed portable download.

- [ ] **Step 1: Write the evidence-backed change summary**

  Include BETA1 watchdog restart/lock/process-leak bugs, BETA2 single lifecycle and rc.8 fixes, BETA2 native packaging hardening, BETA2-1 persistent Bash/update fixes, and BETA2-2 installation/startup/native-matrix changes.

- [ ] **Step 2: Add the exact validation matrix**

  For every artifact identify build runner, install/extract method, Node-present result, no-Node result, ready duration, process/loopback result, and CI Run URL. Never label a cross-build as native execution.

- [ ] **Step 2a: Record current runner-label knowledge**

  Add a rapid-freshness knowledge record with retrieval date, official `actions/runner-images` source, exact x64/arm64 labels, applicability, confidence, and 24-hour revalidation boundary; link it from the knowledge index.

- [ ] **Step 3: Update statuses only after evidence exists**

  Before cloud success keep BETA2-2 `pending`; after success record exact run IDs, job conclusions, published assets, and verification date.

- [ ] **Step 4: Validate docs**

  Run `node scripts/check-doc-links.mjs`, `pnpm format:check`, and search for stale `pending tag CI`, `BETA1-1`, portable-Node, and unsupported coverage claims.

- [ ] **Step 5: Commit**

  Commit documentation with subject `docs: publish beta2 repair and validation notes`.

### Task 5: Run full gates, replace the failed tag, publish Beta 2-2, and retire Beta 2-1 downloads

**Files:**

- Update after cloud verification: `docs/releases/0.1.0-BETA2-2.md`, `docs/engineering/acceptance-report.md`, `docs/project/status.md`, `docs/index.md`, `AGENTS.md`, this plan.

- [ ] **Step 1: Run local release gates on the exact candidate commit**

  Run `pnpm build`, `pnpm test`, `pnpm check`, and `pnpm preflight:runtime`; review `git diff --check` and the complete branch diff.

- [ ] **Step 2: Push through the repository integration path**

  Push the feature branch, create/review/merge a PR to `main`, and confirm the resulting `main` CI has every job green.

- [ ] **Step 3: Run package workflow before moving the tag**

  Dispatch `Package DeepSeek Harness Code` on the merged `main` SHA. Require every build/install/runtime/no-Node/macOS dual-architecture job to pass and retain sanitized evidence artifacts.

- [ ] **Step 4: Replace only the unpublished failed tag**

  Confirm `gh release view v0.1.0-BETA2-2` still returns not found, delete only the old remote tag pointing at `012527f`, create an annotated `v0.1.0-BETA2-2` tag at the verified merged SHA, and push it.

- [ ] **Step 5: Verify tag publishing**

  Wait for the tag workflow. Require all jobs green, `Publish GitHub release` green, the Release marked Latest/non-prerelease, all platform assets present, and `update-manifest.json` hashes matching downloaded artifacts.

- [ ] **Step 6: Retire the broken Beta 2-1 download**

  Delete GitHub Release/assets `v0.1.0-BETA2-1` only after Beta 2-2 is confirmed downloadable. Keep the source tag and archived documentation for audit/recovery. Verify Latest now resolves to Beta 2-2 and Beta 2-1 Release returns not found.

- [ ] **Step 7: Write final evidence and commit documentation sync**

  Record exact main/tag SHAs, CI Run IDs, job matrix, durations, Release URL/assets, Beta 2-1 retirement, and remaining limitations. Mark this plan `final-verified` only after those checks pass.

## Risks and Rollback

- Native ARM runner labels may be capacity-constrained. Queue delay is not a pass; the release remains blocked until a matching runner executes the artifact.
- A batched official CLI call may expose an upstream multi-spec incompatibility. Roll back to serial calls only if a measured native run proves batching invalid; do not raise the 600-second limit as a substitute.
- The no-Node smoke path is CI-only and must remain impossible to activate in an unpackaged or unvalidated process.
- If the moved tag workflow fails, delete no existing Release. Fix forward on `main`, replace the still-unpublished Beta 2-2 tag again, and retain all failed Run IDs in the plan.

## Definition of Done

- Every local suite and every job in the final main/tag workflows is green.
- Windows and Linux x64/arm64 artifacts run on matching native runners; macOS Universal runs on both Apple Silicon and Intel.
- Node-present and no-Node prerequisite paths emit verified, sanitized, bounded-time evidence.
- Beta differences and bugs are documented without inventing BETA1-1 or mislabeling CI failures as product failures.
- Beta 2-2 is Latest with a verified manifest and complete assets; Beta 2-1 downloadable Release/assets are removed while its source tag remains.

## Decision Log

- 2026-08-21 — Treat “BETA1-1” as an unverified name, not a version. Git tags, Releases, history, and code search contain no such release.
- 2026-08-21 — The failed `012527f` tag may move because its publish job never ran and no Beta 2-2 Release exists; preserving a known-bad unpublished source pointer would not provide a usable release boundary.
- 2026-08-21 — “No Node installation” means verifying the supported guided prerequisite flow. Automatic Node installation is prohibited by the confirmed project contract.

## Progress

- 2026-08-21 — Read-only audit complete: main CI `32468966137` green; tag package CI `32468983175` blocked on Windows x64 installed-app ready timeout; four other package jobs green but ARM/macOS runtime coverage incomplete.
- 2026-08-21 — Root-cause hypothesis recorded and candidate two-file batching patch found uncommitted in the isolated worktree; focused current-tree unit suite passes 22 tests with one designed skip.
