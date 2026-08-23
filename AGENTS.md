# AGENTS.md

Electron 43 desktop host for DeepSeek Harness (`deepseek-harness-code@0.1.0-BETA3`, `@deepseek-ai/dsh@0.1.1-rc.2`). BETA3 is the verified GitHub Latest release, published from `9762f8e` by native package Run `32550253496`; BETA2-2 is the previous release. The broken BETA2-1 GitHub Release/assets were removed while its source tag was preserved. Community distribution — not official DeepSeek. Harness and desktop renderer stay loopback-only; disabled-by-default trusted-LAN access is an Electron-owned token-gated proxy. macOS distribution remains unsigned/ad-hoc.

## Setup

- Node.js >=22.13 required (runtime + toolchain). `pnpm@11.19.0` pinned (`package.json:12`, `pnpm-workspace.yaml`). If missing: `npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile`.
- `strict-peer-dependencies=false`, `save-exact=true`, `minimum-release-age=1440` except `@deepseek-ai/dsh`, `electron`, `electron-builder` (`.npmrc:1-6`).
- Generated and controller-scratch artifacts are gitignored and must not be committed: `dist/`, `release/`, `build/` (incl. `build/node-runtime/`, `build/routing-suite/`), `.superpowers/` (`.gitignore`).

## Commands

```bash
pnpm install --frozen-lockfile          # always first
pnpm build                              # clean + build:icon + node-runtime + routing-suite + desktop + watchdog + plugin + anchored + sidebar (package.json:14)
pnpm test                               # runs unit -> anchored -> plugin -> package -> e2e sequentially (package.json:23)
pnpm check                              # typecheck + lint + format:check + verify:docs + verify:security (package.json:32)
pnpm check:memory                        # bounded heap + peak-RSS tripwire
pnpm preflight:runtime                  # alias for node scripts/check-runtime-closure.mjs — 56 artifacts + pinned versions + bare-name patches
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
- **Packaging:** `electron-builder.yml:5-7` — `asar:false`, `npmRebuild:false`, excludes `node_modules` from app; runtime installed at first launch into `app.getPath(userData)/node-runtime` via bundled pnpm (`build/node-runtime/pnpm.mjs`). `extraResources` bundles watchdog + node-runtime + desktop-plugin + dsh-ui-motion + dsh-model-two-level-selector + dsh-ui-polish + dsh-updater-check + prompt-principles + dsh-lan-access + anchored-standard + superpowers-skills + global-agent-prompt + routing-suite (`electron-builder.yml:20-106`).
- **Plugins:** `packages/desktop-plugin`, `packages/dsh-ui-motion`, `packages/dsh-model-two-level-selector`, `packages/dsh-ui-polish`, `packages/dsh-updater-check`, `packages/prompt-principles-plugin`, `packages/dsh-lan-access`, `packages/anchored-standard-plugin` (preset `anchored-standard`), `packages/watchdog`, `packages/better-sidebar`. Client bundles via esbuild (externals = Harness); desktop via `tsup.desktop.config.ts:3-21` (format cjs, target node24, `noExternal: [/^@deepseek-ai\//, /^zod$/]` — must stay bundled, packaged app has no `node_modules`).
- **Routing Suite:** immutable snapshot in `build/routing-suite/` with SHA-256 in `versions.json` (injector 0.3.3 `355238fa…`, mode-boost 0.1.0 `72836d64…`, router-preset 0.2.0 at `eff787e` `a8f3616f…`). Build verifies digest before `tar`; installed app never auto-updates (`scripts/fetch-routing-suite.mjs`, `scripts/check-runtime-closure.mjs:242-331`).
- **Data:** single official Home `$DSH_HOME` or `~/.dsh` (`@deepseek-ai/dsh-home-paths`), plugins reconciled via public `dsh plugin --profile web add` + `--expose-internals`. The sole profile-manifest compatibility exception removes only the two 0.1.1-rc.2 `linkOnly` subagent bundle names after a successful official CLI reconcile; unrelated bundle entries, user plugins, and `cordis.patch.yml` remain untouched. An app-owned marker skips reconciliation only after validating the unchanged managed roster, package roots/identities, profile dependency, and store ownership; otherwise the official CLI runs. Skills/presets/global prompt use ownership-safe sync (marker + digest, user-owned never overwritten).

## Conventions & Gotchas

- **pnpm workspace** `apps/*`, `packages/*` (`pnpm-workspace.yaml:1-3`). `deepseek-harness-desktop-plugin: workspace:*` only.
- **Patches:** `patchedDependencies` in `pnpm-workspace.yaml:20-24` — `@deepseek-ai/dsh` + `dsh-client-ui-agent-preset@0.1.1-rc.2` (locale) + `dsh-client-ui-sidebar@0.1.1-rc.2` (macOS safe-area) + `dsh-terminal-bash@0.1.1-rc.2` (persistent prompt). Staged copies in `build/node-runtime/patches/` must match `config/node-runtime/patches/` — `check-runtime-closure` enforces. Rebase via `pnpm patch`, not hand edits.
- **Lint/format scope:** `eslint.config.mjs:7-27` and `.prettierignore:7-27` ignore `dist/`, `release/`, `build/`, `vendor/`, and generated `client.js`/`index.js`/`lib/**` bundles. Don't edit those generated files.
- **TS:** `tsconfig.json:2-8` strict + `exactOptionalPropertyTypes`, `NodeNext` module, includes `apps/**/*.ts`, `packages/**/*.ts`, `tests/**/*.ts`.
- **No request replay, no overlapping recovery, bounded shutdown (8s SIGTERM→SIGKILL) — see `docs/architecture/lifecycle.md`.** Single-flight startup prevents duplicate Watchdog/pnpm installs.
- **Windows workspace boundary:** custom Bash resolves the DSH session policy and canonical workdir boundary; `str_replace_editor` uses the host sandboxed filesystem. 0.1.1-rc.2 does not guarantee universal read isolation, and canonical preflight retains a filesystem TOCTOU residual risk.
- **Renderer quirks:** `autoHideMenuBar` on win/linux (`main.ts:237`), 30s unresponsive threshold before window replacement, Harness process kept alive on renderer rebuild. `html`/`body`/AppFrame stay full-window; only sidebar inner content gets `46px`/`58px` macOS inset.

## Docs (read when changing those areas)

- `docs/index.md` — router. `docs/architecture/overview.md` + `lifecycle.md` for IPC/process/security. `docs/engineering/testing.md` and `acceptance-report.md` for test layers and the candidate-versus-executed native matrix. `docs/knowledge/topics/github-actions-runner-matrix.md` for rapid-freshness runner labels. `docs/knowledge/upstream-baseline.md` for pinned versions (trust `package.json`/`pnpm-workspace.yaml`/`electron-builder.yml` over prose when they conflict). `docs/operations/install-unsigned.md` for macOS quarantine.

## Rules

- Keep this file as the repo's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve official Harness question protocol (`@deepseek-ai/dsh-tool-ask-user` etc.) — do not create a parallel wire format.
- Never log credentials, auth headers, cookies, prompt bodies, or response bodies.
- Runtime behavior changes are test-first; verify before claiming completion.
- Cross-build is never native execution. BETA3 claims are bound to tag Run `32550253496` and the published asset/manifest evidence; all six native OS/architecture runners passed install/runtime/no-Node gates before Release creation. BETA2-1 downloads are retired; retain its source tag and archive.
