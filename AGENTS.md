# AGENTS.md

Electron 43 desktop host for Code-DSH maintained DeepSeek Harness (`deepseek-harness-code@0.1.0-BETA6`, DSH family `0.1.1-rc.2.code.1` from the pinned `deps/deepseek-harness` submodule). BETA6 is the verified GitHub Latest test release, published from merged commit `d8ba74f` by native package Run `33140759412`; BETA5 is the previous release. BETA6 is intended to exercise the BETA5→BETA6 updater flow and does not change updater runtime logic. The broken BETA2-1 GitHub Release/assets were removed while its source tag was preserved. Community distribution — not official DeepSeek. Harness and desktop renderer stay loopback-only; disabled-by-default trusted-LAN access is an Electron-owned token-gated proxy. macOS distribution remains unsigned/ad-hoc.

## 长期工程记忆 / DHC Forge operating memory

- **Goal / scope:** ship a resilient Electron host around the official Harness Web runtime, official-format plugins, one official Home, managed Skills/presets/global prompt, immutable Routing Suite, user-confirmed updater, and independent Watchdog. The current release line is BETA6 / `0.1.1-rc.2.code.1`; its test-release preparation was merged to `main` through PR #44 and published from tag Run `33140759412`.
- **Official boundary:** preserve `@deepseek-ai/dsh` question/session/plugin protocols and public `dsh plugin --profile web add`; do not invent a wire format, intercept private requests, capture reasoning text, or replace Harness-owned rendering/status semantics. Harness and renderer stay on `127.0.0.1`; LAN is disabled by default and may use only the Electron-owned token/password-gated proxy.
- **Host security invariants:** preload exposes only the fixed capability groups; renderer stays sandboxed with no Node integration; every IPC input is schema-validated; credentials, Authorization/Cookie, prompts, responses, and token-bearing URLs never enter logs or renderer state; recovery is serialized, bounded, and never blindly replays requests.
- **Task route:** read this file and `docs/index.md` first, then the smallest canonical document/source slice. Establish current source facts from `package.json`, `pnpm-workspace.yaml`, `electron-builder.yml`, `apps/desktop/src/`, `packages/`, and focused tests before changing prose. Route runtime behavior to source + focused test + matching architecture/operations docs; route product/version claims to project intent and upstream baseline; route release claims to tag/CI evidence only. The current BETA6 test-release evidence is the merged PR #44 commit `d8ba74f` and package Run `33140759412`.
- **Branch and Issue rules:** inventory `refs/heads` and `refs/remotes` with `git for-each-ref`, merge-base, and left/right commit counts before comparing work. `fetch --all --prune` is read-only preparation; do not pull, merge, rebase, force checkout/reset, delete branches, push, close Issues, or comment on them without an explicit user request. Fetch all open/closed Issues with `gh issue list/view`; classify each by local evidence, branch/file, risk, and next action. Fix only local, narrow, testable defects; external repositories, platform-only failures, product/security decisions, and ambiguous requests remain evidence-backed blockers.
- **Validation order:** capture status/diff first; run `git diff --check`; run `pnpm build` before suites that consume `dist/` or `build/`; run focused tests for each behavior change, then `pnpm test`, `pnpm check`, `pnpm preflight:runtime`, and native packaging only when scope and environment justify them. Never edit `dist/`, `build/`, `release/`, vendored code, or generated bundles as a workaround.
- **Context compression:** retain only Goal, Scope, Non-goals, Invariants, Acceptance, Validation, changed paths/symbols, command results, and unresolved evidence. Cite paths and symbols instead of copying source; separate observed facts from historical reports and unexecuted gates; record the next minimal command for every blocker. Do not put credentials, tokens, or other sensitive data in this memory.

## Setup

- Node.js `^22.19.0 || >=24.0.0` required (Node 23 is unsupported). `pnpm@11.19.0` pinned (`package.json:12`, `pnpm-workspace.yaml`). If missing: `npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile`.
- `strict-peer-dependencies=false`, `save-exact=true`, `minimum-release-age=1440` except `@deepseek-ai/dsh`, `electron`, `electron-builder` (`.npmrc:1-6`).
- Generated and controller-scratch artifacts are gitignored and must not be committed: `dist/`, `release/`, `build/` (incl. `build/node-runtime/`, `build/routing-suite/`), `.superpowers/` (`.gitignore`).

## Commands

```bash
pnpm install --frozen-lockfile          # always first
pnpm build                              # clean + icon + maintained Harness family + node-runtime + routing-suite + desktop/plugins (package.json:14)
pnpm test                               # runs unit -> anchored -> plugin -> package -> e2e sequentially (package.json:23)
pnpm check                              # typecheck + lint + format:check + verify:docs + verify:security (package.json:32)
pnpm check:memory                        # bounded heap + peak-RSS tripwire
pnpm preflight:runtime                  # strict submodule/provenance/tarball/runtime closure + bare-name plugin checks
pnpm start                              # build + electron .
pnpm dist:mac                           # build + build:icon + preflight + electron-builder --mac --universal (also dist:win / dist:linux)
node scripts/verify-macos-artifact.mjs release/DeepSeek-Harness-Code-*.dmg --universal
```

Focused verification (avoid full `pnpm test` when iterating):

```bash
pnpm test:unit                          # vitest run tests/unit + packages/desktop-plugin/test + packages/watchdog/test + packages/prompt-principles-plugin/test (vitest.config.ts:7)
pnpm --dir packages/anchored-standard-plugin test  # alias: pnpm test:anchored (116 tests)
pnpm test:plugin                        # vitest --config tests/e2e/plugin-vitest.config.ts
pnpm test:package                       # vitest --config tests/e2e/package-vitest.config.ts (runs build:icon first)
pnpm test:e2e                           # playwright (tests/playwright/, chromium, headless — playwright.config.ts:3-12)
pnpm typecheck && pnpm lint && pnpm format:check  # structure slices (CI runs these via pnpm check)
```

**Order matters:** `pnpm build` before any `pnpm test` / `pnpm check:memory` / `pnpm preflight:runtime` — suites exercise `dist/**` and `build/routing-suite` (`.github/workflows/ci.yml:82-86`). Linux E2E needs `pnpm exec playwright install --with-deps chromium`.

## Architecture

- **Main entry:** `apps/desktop/src/main.ts:1` (window, tray, lifecycle, preload bridge). Preload `apps/desktop/src/preload.ts` exposes only the fixed `preferences`, `lanAccess`, `runtime`, `updater`, and `bundledPlugins` capability groups (sandboxed renderer, no Node integration, `createSecureWebPreferences`).
- **Lifecycle:** `apps/desktop/src/lifecycle/` — `runtime-controller.ts`, `port-retry.ts`, `watchdog-host.ts`, `system-node.ts` (auto-detects official Node across nodejs.org/Homebrew/nvm/Volta/fnm/mise/Scoop/nvm-windows via PATH + `NVM_DIR`/`VOLTA_HOME`/`FNM_DIR`), `node-runtime.ts`, `desktop-plugin-link.ts`, and the optional `lan-proxy.ts`. Harness launched as `dsh lib/bin.js web --host 127.0.0.1 --port <port> --no-open --expose-internals` with 5s probe interval, 30s readiness window, 3x `EADDRINUSE`-only port retry; the proxy may bind `0.0.0.0` only after explicit opt-in and forwards only authenticated traffic back to loopback.
- **Packaging:** `electron-builder.yml:5-7` — `asar:false`, `npmRebuild:false`, excludes `node_modules` from app; `build:harness` packs the complete maintained DSH family into `build/node-runtime/vendor/dsh` with `maintained-harness.json`, and first launch installs only those local tarballs plus exactly locked external dependencies into `app.getPath(userData)/node-runtime` via bundled pnpm. `extraResources` bundles watchdog + node-runtime + desktop/plugin resources + routing suite (`electron-builder.yml:20-106`).
- **Plugins:** `packages/desktop-plugin`, `packages/dsh-ui-motion`, `packages/dsh-model-two-level-selector`, `packages/dsh-ui-polish`, `packages/dsh-updater-check`, `packages/prompt-principles-plugin`, `packages/dsh-lan-access`, `packages/anchored-standard-plugin` (preset `anchored-standard`), `packages/watchdog`, `packages/better-sidebar`. Client bundles via esbuild (externals = Harness); desktop via `tsup.desktop.config.ts:3-21` (format cjs, target node24, `noExternal: [/^@deepseek-ai\//, /^zod$/]` — must stay bundled, packaged app has no `node_modules`).
- **Routing Suite:** immutable snapshot in `build/routing-suite/` with SHA-256 in `versions.json` (injector 0.3.3 `355238fa…`, mode-boost 0.1.0 `72836d64…`, router-preset 0.2.0 at `eff787e` `a8f3616f…`). Build verifies digest before `tar`; installed app never auto-updates (`scripts/fetch-routing-suite.mjs`, `scripts/check-runtime-closure.mjs:242-331`).
- **Data:** single DSH Home `$DSH_HOME` or `~/.dsh` (`@deepseek-ai/dsh-home-paths`), plugins reconciled via public `dsh plugin --profile web add` + `--expose-internals`. The complete maintained runtime supplies subagent packages; composition contributes configuration only and no `linkOnly` profile post-processing remains. An app-owned marker skips reconciliation only after validating the unchanged managed roster, package roots/identities, profile dependency, and store ownership. Skills/presets/global prompt use ownership-safe sync (marker + digest, user-owned never overwritten). Startup never installs or modifies a global `dsh`.

## Conventions & Gotchas

- **pnpm workspace** `apps/*`, `packages/*` (`pnpm-workspace.yaml:1-3`). `deepseek-harness-desktop-plugin: workspace:*` only.
- **Maintained Harness:** `.gitmodules` pins `deps/deepseek-harness` without a branch. Windows plugin quoting, preset locale, macOS sidebar inset, and persistent Bash prompt live in that repository's source at family version `0.1.1-rc.2.code.1`; this repository carries no DSH pnpm patches. Normal builds allow a dirty submodule, while `preflight:runtime` and release/package commands require it clean and provenance-consistent.
- **Lint/format scope:** `eslint.config.mjs:7-27` and `.prettierignore:7-27` ignore `dist/`, `release/`, `build/`, `vendor/`, and generated `client.js`/`index.js`/`lib/**` bundles. Don't edit those generated files.
- **TS:** `tsconfig.json:2-8` strict + `exactOptionalPropertyTypes`, `NodeNext` module, includes `apps/**/*.ts`, `packages/**/*.ts`, `tests/**/*.ts`.
- **No request replay, no overlapping recovery, bounded shutdown (8s SIGTERM→SIGKILL) — see `docs/architecture/lifecycle.md`.** Single-flight startup prevents duplicate Watchdog/pnpm installs.
- **Windows workspace boundary:** custom Bash resolves the DSH session policy and canonical workdir boundary; `str_replace_editor` uses the host sandboxed filesystem. The maintained 0.1.1-rc.2.code.1 baseline does not guarantee universal read isolation, and canonical preflight retains a filesystem TOCTOU residual risk.
- **Renderer quirks:** `autoHideMenuBar` on win/linux (`main.ts:237`), 30s unresponsive threshold before window replacement, Harness process kept alive on renderer rebuild. `html`/`body`/AppFrame stay full-window; only sidebar inner content gets `46px`/`58px` macOS inset.

## Docs (read when changing those areas)

- `docs/index.md` — router. `docs/architecture/overview.md` + `lifecycle.md` for IPC/process/security. `docs/engineering/testing.md` and `acceptance-report.md` for test layers and the candidate-versus-executed native matrix. `docs/knowledge/topics/github-actions-runner-matrix.md` for rapid-freshness runner labels. `docs/knowledge/upstream-baseline.md` for pinned versions (trust `package.json`/`pnpm-workspace.yaml`/`electron-builder.yml` over prose when they conflict). `docs/operations/install-unsigned.md` for macOS quarantine.

## Rules

- Keep this file as the repo's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve the public Harness question protocol (`@deepseek-ai/dsh-tool-ask-user` etc.) — do not create a parallel wire format.
- Never log credentials, auth headers, cookies, prompt bodies, or response bodies.
- Runtime behavior changes are test-first; verify before claiming completion.
- Cross-build is never native execution. BETA6 claims are bound to tag Run `33140759412` and the published asset/manifest evidence; all five package runners plus Linux arm64 deb and dual-native macOS smoke runners passed before Release creation. BETA2-1 downloads are retired; retain its source tag and archive.
