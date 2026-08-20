# DeepSeek Harness Code Beta 2-1 Persistent Bash Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reproducible runtime patch for the persistent Bash PTY readiness hang, publish `0.1.0-BETA2-1`, and verify the installed app can discover and apply the update.

**Architecture:** Patch the pinned `@deepseek-ai/dsh-terminal-bash@0.1.0-rc.8` package through the existing `config/node-runtime` pnpm patch pipeline. The patch makes the shell prompt unique to the persistent Bash tool and derives the prompt-tail bound from the prompt length. The runtime closure gate, package tests, and live app verification all prove that the same patch reaches development, packaged, and updated installations.

**Tech Stack:** Electron 43.4.0, Node.js 22.13+, pnpm 11.19.0, `@deepseek-ai/dsh@0.1.0-rc.8`, `@deepseek-ai/dsh-terminal-bash@0.1.0-rc.8`, electron-builder 26.15.3, GitHub Releases.

**Spec:** The user-supplied attached prompt patch (the `.rtfd` reference in the task) and [project release intent](../../project/intent.md).

## Global Constraints

- Keep the official Harness package version pinned at `0.1.0-rc.8`.
- Apply the patch through `config/node-runtime/patches/`; do not rely on an untracked live `node_modules` edit.
- Preserve the exact requested prompt text `__DSH_PERSISTENT_BASH_PROMPT__` and use valid JavaScript `CONTROLLED_PROMPT.length + 1`.
- Do not print or commit credentials, cookies, auth headers, or prompt bodies.
- Do not claim update support until a manifest and replacement-capable artifact are published and verified.

## Read Set

- [Runtime preparation](../../../scripts/prepare-node-runtime.mjs) — copies runtime manifests and patches into the packaged resource.
- [Runtime closure gate](../../../scripts/check-runtime-closure.mjs) — verifies pinned packages, copied patches, and build artifacts.
- [Updater configuration](../../../apps/desktop/src/updater/updater-config.ts) — manifest URL and local verification escape hatch.
- [Updater host](../../../apps/desktop/src/lifecycle/updater-host.ts) — current user-facing check behavior.
- [BETA2 release notes](../../../docs/releases/0.1.0-BETA2.md) — current release boundary and update limitations.

## Tasks

### Task 1: Capture the regression and patch contract

**Files:**

- Create: `tests/unit/persistent-bash-patch.test.ts`
- Create: `config/node-runtime/patches/@deepseek-ai__dsh-terminal-bash@0.1.0-rc.8.patch`
- Modify: `config/node-runtime/pnpm-workspace.yaml`
- Modify: `scripts/check-runtime-closure.mjs`

- [ ] Write assertions that require the patch to replace `dsh> `, use `CONTROLLED_PROMPT.length + 1`, and be registered in the runtime workspace.
- [ ] Run the focused test and confirm it fails because the patch is absent.
- [ ] Add the minimal pnpm patch and closure checks.
- [ ] Re-run the focused test and the runtime closure gate after regenerating the lockfile/resource.

### Task 2: Apply and validate the local runtime

**Files:**

- Modify: `/Users/trip/Library/Application Support/deepseek-harness-desktop/node-runtime/...` only as a temporary live-instance installation step, never as the source of truth.

- [ ] Install the patched runtime from the source manifest with the existing system Node and pnpm flow.
- [ ] Confirm the loaded `@deepseek-ai/dsh-terminal-bash/lib/index.js` contains both requested changes.
- [ ] Restart the local app so the running Harness process loads the new module.
- [ ] Run a fresh `cd`, `pwd`, and directory-list Bash call and verify it settles before the configured timeout.

### Task 3: Build and publish Beta 2-1

**Files:**

- Modify: `package.json` version and release metadata.
- Modify: `docs/releases/0.1.0-BETA2-1.md`.
- Modify: updater manifest generation/release assets as required by the existing updater contract.

- [x] Bump the application version to `0.1.0-BETA2-1` without changing the pinned Harness version.
- [x] Run build, tests, closure, and platform artifact verification.
- [x] Publish the Git commit/tag and GitHub Release with installable artifacts and update manifest/assets.

### Task 4: Verify discovery and replacement

- [x] Configure the updater source to check the published manifest and verify the old `BETA2` version detects `0.1.0-BETA2-1` in the real-version regression test.
- [x] Confirm the desktop UI reports `0.1.0-BETA2-1` as available from the old installed build after the Mac is unlocked.
- [x] Download and apply the replacement package using the supported updater path.
- [x] Confirm the restarted app version and both terminal patch expressions after update.
- [x] Re-run the original Bash command and record completion evidence.

## Completion Evidence

- Patch file and lock hash are present in source and `build/node-runtime`.
- Focused regression, full tests, typecheck/lint/format/docs/security, build, and package verification pass.
- Remote tag/release/assets/manifest are visible from GitHub.
- The local app reports the new version, applies the update, and loads the patched terminal-bash file. The post-update UI run of the exact path command returned `BASH_PATCH_OK`; session statistics report `工具调用 0.8s`.
