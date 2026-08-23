# Beta2-2 LAN Access, Startup, and Workspace Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release `0.1.0-BETA2-2` with opt-in authenticated LAN access, fast warm startup, and no app-created Windows workspace-sandbox bypass.

**Architecture:** Keep Harness loopback-only. A new Electron-owned proxy binds `0.0.0.0` only after the bundled `dsh-lan-access` settings plugin calls a fixed preload IPC capability; each native Copy action signs a fresh one-time URL token, invalidates any earlier unredeemed token, and a redeemed token yields a cookie before forwarding to the local Harness. Managed plugin reconciliation gains a release-input marker so unchanged launches skip all serial official CLI invocations.

**Tech Stack:** Electron 43, TypeScript, Node HTTP/net/crypto, Vitest, official DSH plugin format.

**Spec:** [Beta2-2 design](../../superpowers/specs/2026-08-21-beta2-2-lan-access-design.md)

## Global Constraints

- LAN access is disabled by default and must never directly bind Harness to a non-loopback address.
- Proxy authorization uses `crypto.randomBytes`, timing-safe comparison, an HttpOnly/SameSite cookie, and no token persistence or logging.
- Electron renderer navigation stays bound to the exact loopback Harness origin.
- Existing user profile manifests and user-owned plugins are never hand-edited, except for the narrow post-CLI rc.8 removal of explicitly `linkOnly` duplicate bundle names.
- Managed package reconciliation remains through `dsh plugin --profile web add` whenever the marker is absent or invalid.
- The Windows custom Bash tool must use the per-session DSH sandbox policy and reject an out-of-workspace `workdir`.

---

### Task 1: Prove warm startup skips redundant reconciliation

**Files:**

- Modify: `tests/unit/desktop-plugin-link.test.ts`
- Modify: `apps/desktop/src/lifecycle/desktop-plugin-link.ts`

**Interfaces:**

- Produces `ensureOfficialHarnessInstall()` result status `installed | unchanged` and an app-owned marker under `DSH_HOME`.
- Consumes exact managed package names, package roots, and managed pnpm store path.

- [x] Write regression tests for unchanged warm startup, managed identity/store/profile invalidation, and rc.8 link-only bundle de-duplication.
- [x] Observe RED before each implementation increment, including the isolated runtime reproduction of duplicate `subagent-codex` loader registration.
- [x] Add marker digest/read/validate/write helpers plus the narrow link-only bundle compatibility cleanup required by rc.8.
- [x] Run the focused suite green (20 passing, 1 Windows-only fixture skipped locally) and receive independent task/re-regression reviews.

### Task 2: Add a token-gated `0.0.0.0` LAN proxy

**Files:**

- Create: `apps/desktop/src/lifecycle/lan-proxy.ts`
- Create: `tests/unit/lan-proxy.test.ts`
- Modify: `apps/desktop/src/main.ts`

**Interfaces:**

- Produces `LanProxyHost.start(loopbackOrigin)` → `{ port }`, main-process-only `issueAccessUrl()`, and `stop()`.
- `issueAccessUrl()` signs a fresh one-time `lanToken` query and invalidates any prior unredeemed exchange; the matching HttpOnly cookie then forwards HTTP/WebSocket traffic to the loopback origin.

- [x] Write real local integration tests for rejection, token exchange, header redaction, HTTP/WebSocket forwarding, all-interface binding, listener closure, and active-stream teardown.
- [x] Observe RED before implementation, then implement the dependency-free proxy and lifecycle tracking.
- [x] Run the focused proxy suite green with HTTP/WebSocket exchange, rotation, teardown, and replay coverage, then receive independent task/re-review approval.

### Task 3: Expose only LAN state through the desktop bridge

**Files:**

- Modify: `apps/desktop/src/shared/contracts.ts`
- Modify: `apps/desktop/src/preload-api.ts`
- Modify: `apps/desktop/src/ipc-handlers.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `tests/unit/contracts.test.ts`
- Modify: `tests/unit/preload-api.test.ts`
- Modify: `tests/unit/ipc-handlers.test.ts`

**Interfaces:**

- Adds `window.deepseekDesktop.lanAccess.get()`, `set({ enabled: boolean })`, and `copyUrl({ address? })`.
- `set()` persists the boolean, starts/stops the proxy, and returns only redacted listener state. `copyUrl()` accepts only a current redacted IPv4 address, signs a fresh token-bearing URL in Electron main, and writes it to the native clipboard without returning it to the renderer.

- [x] Write strict schema/IPC/preload/controller tests, including token-redaction and async interleaving cases.
- [x] Observe RED before implementation.
- [x] Implement typed bridge actions, main-process-only copy, serialized preferences, and last-command-wins proxy lifecycle integration.
- [x] Run focused tests green with address allowlist, lifecycle serialization, token-redaction, and async-interleaving coverage, then receive independent task/re-review approval.

### Task 4: Ship the LAN settings plugin

**Files:**

- Create: `packages/dsh-lan-access/{package.json,index.js,lib/index.js,lib/client.js,cordis.patch.yml,README.md}`
- Modify: `apps/desktop/src/main.ts`
- Modify: `electron-builder.yml`
- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `tests/unit/package-runtime-closure.test.ts`

**Interfaces:**

- `dsh-lan-access` is installed by the official plugin CLI and adds one General settings row.
- The row is local-only, displays the trusted-LAN warning and selectable redacted addresses (never an active URL), and calls only the typed `lanAccess` bridge.

- [x] Write a failing runtime-closure contract for the official plugin package.
- [x] Observe RED before the package exists.
- [x] Add the client-only plugin, official startup inventory, builder resource, and closure contract.
- [x] Run the closure/unit checks green and receive independent review approval.

### Task 5: Remove the Windows workspace boundary bypass

**Files:**

- Modify: `packages/anchored-standard-plugin/{preset,zero-anchored-standard,whoami-standard}/custom-bash.mjs`
- Modify: `packages/anchored-standard-plugin/{preset,zero-anchored-standard,whoami-standard}/agent.cordis.yml`
- Add or modify: focused preset/custom-Bash tests

**Interfaces:**

- The custom Bash plugin injects `subprocess`, `tools`, `sandbox`, and `sandboxPolicy`.
- The shell argv is passed to `ctx.sandbox.confine()` under the calling session policy; a canonicalized `workdir` must be within that session’s workspace root.

- [x] Write failing tests for sandbox argv/session policy propagation and canonical sibling/missing/symlink-escape rejection.
- [x] Observe RED under the original direct subprocess implementation.
- [x] Implement shared sandboxed custom-Bash behavior and remove the `fs-local` bootstrap shadow from every shipped preset variant.
- [x] Run the full Anchored suite green (116 tests), fix release-gate lint, and receive independent review approval.

### Task 6: Version, documentation, package, and interactive release evidence

**Files:**

- Modify: `package.json`
- Create: `docs/releases/0.1.0-BETA2-2.md`
- Modify: `docs/architecture/{overview.md,lifecycle.md}`
- Modify: `docs/engineering/testing.md`, `docs/operations/troubleshooting.md`, `docs/plans/index.md`, `AGENTS.md`

- [x] Bump the root version to `0.1.0-BETA2-2` and document the default-off LAN/token boundary, warm reconciliation behavior, and Windows limitation.
- [x] Run `pnpm build`, `pnpm test`, `pnpm check`, and `pnpm preflight:runtime`.
- [ ] Build a macOS package and validate it.
- [x] Use Computer Use to confirm the installed General-settings plugin row is present and default-off; user separately confirmed the plugin was loaded and tested, so no agent-side LAN activation was performed.
- [ ] Review the final diff, commit, push the release tag, and let the packaging workflow publish `update-manifest.json` and platform artifacts.

The first `v0.1.0-BETA2-2` tag attempt failed its Windows x64 installed-package smoke before publishing a Release. Recovery, expanded native architecture/no-Node validation, and the replacement-tag procedure continue in [Beta 2-2 release gate recovery](./beta2-2-release-gate.md).
