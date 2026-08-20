# AGENTS.md

Electron 43 desktop host for DeepSeek Harness (`@deepseek-ai/dsh@0.1.0-rc.8`). Community distribution — not official DeepSeek. Loopback-only Harness, unsigned/ad-hoc macOS.

## Setup

- Node.js >=22.13 required (runtime + toolchain). `pnpm@11.19.0` pinned (`package.json:12`, `pnpm-workspace.yaml`). If missing: `npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile`.
- `strict-peer-dependencies=false`, `save-exact=true`, `minimum-release-age=1440` except `@deepseek-ai/dsh`, `electron`, `electron-builder` (`.npmrc:1-6`).
- Generated artifacts are gitignored and must not be committed: `dist/`, `release/`, `build/node-runtime/`, `build/routing-suite/` (`.gitignore:2-14`).

## Commands

```bash
pnpm install --frozen-lockfile          # always first
pnpm build                              # clean + node-runtime + routing-suite + desktop + watchdog + plugin + anchored + sidebar (package.json:14)
pnpm test                               # runs unit -> anchored -> plugin -> package -> e2e sequentially (package.json:23)
pnpm check                              # typecheck + lint + format:check + verify:docs + verify:security (package.json:32)
pnpm check:memory                        # bounded heap + peak-RSS tripwire
pnpm preflight:runtime                  # alias for node scripts/check-runtime-closure.mjs — 25 artifacts + pinned versions + bare-name patches
pnpm start                              # build + electron .
pnpm dist:mac                           # build + build:icon + preflight + electron-builder --mac --universal (also dist:win / dist:linux)
node scripts/verify-macos-artifact.mjs release/DeepSeek-Harness-Code-*.dmg --universal
```

Focused verification (avoid full `pnpm test` when iterating):

```bash
pnpm test:unit                          # vitest run tests/unit + packages/*/test (vitest.config.ts:7)
pnpm --dir packages/anchored-standard-plugin test  # alias: pnpm test:anchored
pnpm test:plugin                        # vitest --config tests/e2e/plugin-vitest.config.ts
pnpm test:package                       # vitest --config tests/e2e/package-vitest.config.ts
pnpm test:e2e                           # playwright (tests/playwright/, chromium, headless — playwright.config.ts:3-12)
pnpm typecheck && pnpm lint && pnpm format:check  # structure slices (CI runs these via pnpm check)
```

**Order matters:** `pnpm build` before any `pnpm test` / `pnpm check:memory` / `pnpm preflight:runtime` — suites exercise `dist/**` and `build/routing-suite` (`.github/workflows/ci.yml:79-83`). Linux E2E needs `pnpm exec playwright install --with-deps chromium`.

## Architecture

- **Main entry:** `apps/desktop/src/main.ts:1` (window, tray, lifecycle, preload bridge). Preload `apps/desktop/src/preload.ts` exposes only `preferences`+`runtime` capability groups (`main.ts:211` sandboxed renderer, no Node integration).
- **Lifecycle:** `apps/desktop/src/lifecycle/` — `runtime-controller.ts`, `port-retry.ts`, `watchdog-host.ts`, `system-node.ts` (auto-detects official Node across nodejs.org/Homebrew/nvm/Volta/fnm/mise), `node-runtime.ts`, `desktop-plugin-link.ts`. Harness launched as `dsh lib/bin.js web --host 127.0.0.1 --port <port>` with readiness probe every 5s (`main.ts:1160`).
- **Packaging:** `electron-builder.yml:5-7` — `asar:false`, `npmRebuild:false`, excludes `node_modules` from app; runtime installed at first launch into `app.getPath(userData)/node-runtime` via bundled pnpm (`build/node-runtime/pnpm.mjs`). `extraResources` bundles watchdog + node-runtime + 6 integrated plugins + routing-suite + skills (`electron-builder.yml:20-101`).
- **Plugins:** `packages/desktop-plugin`, `packages/dsh-ui-motion`, `packages/dsh-model-two-level-selector`, `packages/dsh-ui-polish`, `packages/dsh-updater-check`, `packages/prompt-principles-plugin`, `packages/anchored-standard-plugin` (preset `anchored-standard`), `packages/watchdog`. Client bundles via esbuild; desktop via `tsup.desktop.config.ts:3-21` (format cjs, target node24, `noExternal: [/^@deepseek-ai\//, /^zod$/]`).
- **Routing Suite:** immutable snapshot in `build/routing-suite/` with SHA-256 in `versions.json` (injector 0.3.3, mode-boost 0.1.0, router-preset 0.2.0 at `eff787e`). Build verifies digest before extraction; installed app never auto-updates (`scripts/fetch-routing-suite.mjs`, `scripts/check-runtime-closure.mjs:242-262`).
- **Data:** single official Home `$DSH_HOME` or `~/.dsh` (`@deepseek-ai/dsh-home-paths`), plugins reconciled via public `dsh plugin --profile web add` — never edit profile manifests/bundles manually.

## Conventions & Gotchas

- **pnpm workspace** `apps/*`, `packages/*` (`pnpm-workspace.yaml:1-3`). `deepseek-harness-desktop-plugin: workspace:*` only.
- **Patches:** `patchedDependencies: "@deepseek-ai/dsh"` in `pnpm-workspace.yaml:21`; rc.6 conversation/agent-preset/sidebar patches are commented out — rebase via `pnpm patch` before re-enabling.
- **Lint/format scope:** `eslint.config.mjs:6-27` and `.prettierignore:7-27` ignore `dist/`, `release/`, `build/node-runtime`, `build/routing-suite`, `vendor/`, and generated `client.js`/`index.js` bundles. Don't edit those generated files.
- **TS:** `tsconfig.json:2-8` strict + `exactOptionalPropertyTypes`, `NodeNext` module, includes `apps/**/*.ts`, `packages/**/*.ts`, `tests/**/*.ts`.
- **No request replay, no overlapping recovery, bounded shutdown (8s SIGTERM→SIGKILL) — see `docs/architecture/lifecycle.md`.**
- **Renderer quirks:** `autoHideMenuBar` on win/linux (`main.ts:205`), 30s unresponsive threshold before window replacement, Harness process kept alive on renderer rebuild.

## Docs (read when changing those areas)

- `docs/index.md` — router. `docs/architecture/overview.md` + `lifecycle.md` for IPC/process/security. `docs/engineering/testing.md` for test layers + fault injection. `docs/knowledge/upstream-baseline.md` for pinned versions (trust `package.json`/`pnpm-workspace.yaml`/`electron-builder.yml` over prose when they conflict). `docs/operations/install-unsigned.md` for macOS quarantine.

## Rules

- Keep this file as the repo's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve official Harness question protocol (`@deepseek-ai/dsh-tool-ask-user` etc.) — do not create a parallel wire format.
- Never log credentials, auth headers, cookies, prompt bodies, or response bodies.
- Runtime behavior changes are test-first; verify before claiming completion.
