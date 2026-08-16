# Official Harness Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop distribution use one official Harness Home and install every bundled plugin through the public `dsh plugin` flow before starting Harness.

**Architecture:** The existing desktop lifecycle installer becomes an orchestration boundary around the pinned official CLI. It resolves the official Home, performs a copy-only transactional migration from the old app Home, exposes bundled pnpm to the CLI, reconciles integrated packages, then launches `dsh web --expose-internals` against that same Home. Presets and Skills remain ownership-safe resource synchronization because rc.6 has no arbitrary resource installer.

**Tech Stack:** Electron 43.4.0, TypeScript 5.9, Node 24/Electron Node mode, `@deepseek-ai/dsh@0.1.0-rc.6`, `@deepseek-ai/dsh-home-paths@0.1.0-rc.6`, pnpm 11.19.0, Vitest, Playwright.

## Global Constraints

- Default Harness Home is official `~/.dsh`; preserve an explicit nonblank `DSH_HOME` override.
- Never delete the legacy Home, existing target data, existing target plugins, or unrelated target bundle entries.
- Never log credential/settings contents, plugin output without redaction, prompt bodies, or response bodies.
- Use the public `dsh plugin --profile web add` command; do not import hashed CLI internals or reimplement bundle reconciliation.
- Keep plugin patch names bare after adding `--expose-internals`.
- Keep Electron-only preferences, caches, watchdog data, installer markers, and migration reports under Electron `userData`.

---

### Task 1: Official Home and native loader launch

**Files:**

- Modify: `tests/unit/host-config.test.ts`
- Modify: `apps/desktop/src/host-config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `HarnessLaunchInput` and official `resolveDshHome(configured?, env?)`.
- Produces: `createHarnessLaunchSpec()` with `args[0] === "--expose-internals"` and one resolved Home shared by every lifecycle stage.

- [x] Write a failing launch-spec assertion for `--expose-internals` before the CLI entry.
- [x] Run `pnpm vitest run tests/unit/host-config.test.ts` and prove the assertion fails on the old argument vector.
- [x] Add the minimal launch argument and exact `@deepseek-ai/dsh-home-paths@0.1.0-rc.6` production dependency.
- [x] Run the focused test and typecheck.

### Task 2: Public CLI plugin coordinator with bundled pnpm

**Files:**

- Modify: `tests/unit/desktop-plugin-link.test.ts`
- Modify: `tests/e2e/plugin-real-harness.test.ts`
- Modify: `apps/desktop/src/lifecycle/desktop-plugin-link.ts`
- Modify: `scripts/fetch-routing-suite.mjs`
- Modify: `build/routing-suite/mode-boost/package.json`
- Create: `build/routing-suite/mode-boost/cordis.patch.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces: `ensureOfficialHarnessInstall(input): Promise<OfficialHarnessInstallResult>`.
- Input contains `dshEntry`, `dshHome`, `electronExecutable`, `pnpmEntry`, `runtimeBinRoot`, `integratedPlugins`, `legacyPluginSpecs`, and `env`.
- Result contains only package names, status values, and bounded diagnostics; it never contains file contents.

- [x] Add failing tests for the exact CLI argv/env, preservation of unrelated manifest dependencies, repeated reconciliation, a package-name conflict, and nonzero CLI exit.
- [x] Run the focused tests and prove RED against the existing manual link/bundle implementation.
- [x] Add exact `pnpm@11.19.0` and `dsh-find-plugin@0.3.6` production dependencies.
- [x] Generate an app-owned POSIX/Windows pnpm launcher in `runtimeBinRoot`, prepend it to `PATH`, and invoke the public CLI with `shell: false`.
- [x] Make the packaged mode-boost snapshot an official bare-name bundle and apply the same transformation in `fetch-routing-suite.mjs`.
- [x] Run an isolated real CLI test and assert official profile dependencies/bundles contain all integrated packages while an unrelated package/bundle survives.

### Task 3: Copy-only transactional migration

**Files:**

- Modify: `tests/unit/desktop-plugin-link.test.ts`
- Modify: `apps/desktop/src/lifecycle/desktop-plugin-link.ts`

**Interfaces:**

- Produces: `migrateLegacyHarnessHome(input): Promise<HarnessMigrationResult>`.
- Result exposes `status`, copied relative paths, conflict relative paths, skipped symlinks, and normalized missing legacy plugin specs.

- [ ] Add failing table tests for absent legacy Home, legacy-only, official-only, both nonconflicting, scalar conflicts, modified presets/skills, symlink rejection, permission preservation, rerun idempotence, and injected mid-copy failure rollback.
- [ ] Run the migration tests and prove RED.
- [ ] Implement allow-listed recursive copy with no symlink following, `0600` scalar-secret modes, `0700` created directories, target-wins conflicts, and current-attempt rollback.
- [ ] Parse legacy Web profile dependencies without copying profile state; normalize relative `file:`/`link:` specs against the legacy profile directory.
- [ ] Run the focused migration tests and security contract.

### Task 4: Replace startup manual assembly

**Files:**

- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/src/lifecycle/desktop-plugin-link.ts`
- Modify: `apps/desktop/src/lifecycle/routing-suite-link.ts`
- Modify: `tests/unit/routing-suite.test.ts`
- Modify: `tests/e2e/plugin-real-harness.test.ts`

**Interfaces:**

- Startup order: resolve Home → migrate legacy data → official plugin reconciliation → managed presets/Skills → launch Harness.
- `routing-suite-link.ts` retains only managed router-preset synchronization; plugin linking, bundle edits, and user-patch injection are removed.

- [ ] Add failing tests proving startup helpers never create profile links, bundles, manifests, or mode-boost user patch entries.
- [ ] Run focused tests and prove RED.
- [ ] Rewire `main.ts` to the official Home and coordinator, preserving bounded optional-resource notices.
- [ ] Delete the superseded manual profile/link functions and update routing helpers to presets only.
- [ ] Run unit, plugin, real-Harness, typecheck, and security tests.

### Task 5: Packaging, documentation, and completion gates

**Files:**

- Modify: `electron-builder.yml`
- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `tests/unit/package-runtime-closure.test.ts`
- Modify: `tests/e2e/package-contract.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/project/intent.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/operations/index.md`
- Create: `docs/operations/harness-home-migration.md`
- Modify: `docs/knowledge/upstream-baseline.md`
- Modify: `docs/plans/index.md`

**Interfaces:**

- Packaging must contain pnpm, find-plugin, all integrated plugin roots, and bare-name patches.
- Operations docs describe first-launch behavior, conflict handling, rollback through the intact legacy Home, and official target directories.

- [ ] Add failing runtime/package contract assertions for bundled pnpm, pristine find-plugin patch, official mode-boost metadata, and absence of manual profile assembly text.
- [ ] Update packaging and closure checks until the focused contracts pass.
- [ ] Update implementation-backed architecture, intent, knowledge evidence, operations runbook, indexes, and `AGENTS.md` status.
- [ ] Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm verify:docs`, `pnpm verify:security`, and `pnpm preflight:runtime`.
- [ ] Inspect the final diff, confirm all legacy source data remains untouched, and record any environment-only packaging limitation.
