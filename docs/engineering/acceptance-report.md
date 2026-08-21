---
id: engineering.acceptance-report
title: DeepSeek Harness Code Acceptance Report
summary: BETA2-2 repaired native-package gate remains pending cloud evidence; includes the exact candidate-versus-executed matrix plus verified BETA2-1/BETA2/BETA1 history.
kind: engineering
status: canonical
content_stage: implementation-backed
scope: [desktop, watchdog, plugin, routing-suite, packaging]
triggers: [release, acceptance, verification, DMG]
read_when: [reviewing release readiness or reproducing validation]
skip_when: [isolated source edits before release]
priority: must
freshness_class: project
last_verified: 2026-08-21T00:00:00+08:00
owners: [primary-agent]
source_of_truth: [../../apps, ../../packages, ../../tests, ../../release]
related:
  prerequisites: [./testing.md, ../operations/install-unsigned.md]
  next: [../superpowers/plans/2026-08-16-deepseek-harness-code.md]
supersedes: []
tags: [acceptance, release, evidence]
---

# DeepSeek Harness Code Acceptance Report

## Evidence state and bug classes

- **Current release state**：BETA2-2 is `pending cloud release gate`. The first tag source exists at `012527f059c5888c64830c68a7182104f36998c4`, but package Run [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175) failed and no GitHub Release was created. There is no published BETA2-2 asset/hash evidence yet.
- **产品 bug**影响打包应用行为：BETA1 Watchdog/锁/端口竞争、BETA2 重复 lifecycle/并发 pnpm、BETA2-1 persistent Bash hang，以及 BETA2-2 首次标记中安装后 Windows x64 runtime 未 ready。
- **CI / 包装门禁 bug**影响发布证据可靠性：tag/ref、资产名、AppImage/deb 命令、清理、超时、用户数据隔离、证据新鲜度和 native architecture binding。
- **覆盖缺口**表示从未在目标架构安装/解包并启动，或缺少 packaged no-Node 场景。Cross-build is never native execution.

## BETA2-2 first gate and repairs

- main CI Run [32468966137](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468966137) completed all 9 jobs successfully.
- In package Run [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175), linux-x64, linux-arm64, windows-arm64, and macos-universal jobs were green. The windows-x64 job installed NSIS, detected Node 24.18.0, installed the pinned Harness, then produced no ready evidence within 600 seconds and exited code 1. The release job was skipped.
- This is an installed packaged-runtime gate failure, not an NSIS build failure. Available evidence does not identify a precise TypeScript throw site.
- Repair commits `deacad0`, `096fe7d`, and `bddb6f7` batch the complete managed-plugin roster into one shell-free official CLI call per attempt and keep diagnostics redacted/bounded. Commits `bfca0f4` and `feb6355` define native Windows/Linux x64+arm64 and dual-native macOS smoke with exact listener PID, architecture binding, and ready duration. Commit `737d023` defines packaged-only no-Node guidance evidence for every native artifact.
- Those commits define the candidate gate; they do not turn it green. Exact repaired cloud Run IDs, conclusions, durations, listener evidence, published assets, manifest, and hashes remain pending.

## BETA2-2 exact validation matrix

“候选定义”来自 repaired workflow contract；“实际证据”只记录已发生的 package Run 32468983175 和此前覆盖边界。Runner label 来源与 24 小时重验边界见 [GitHub Actions runner matrix](../knowledge/topics/github-actions-runner-matrix.md)。`pending` 不是失败，也不是通过。

| 产物 / 目标架构                           | 候选 workflow 定义（build runner；安装/解包）                                    | 实际 Node-present 结果                                                                  | 实际 no-Node 结果                                    | 实际 ready duration       | 实际进程 / loopback 结果                                             | 实际 CI Run                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows x64 NSIS                          | `windows-2025` x64；安装 → 启动 → 卸载；runtime + node-required                  | **失败**：NSIS 已安装，检测 Node 24.18.0，pinned Harness 已安装，但应用 code 1          | 旧 workflow 未运行；候选场景已定义，云端证据 pending | 未 ready（600s deadline） | 无 ready evidence；旧证据不足以证明精确 listener PID/loopback 所有权 | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（windows-x64 failed）                                             |
| Windows arm64 NSIS                        | `windows-11-arm` arm64；安装 → 启动 → 卸载；runtime + node-required              | 旧 job green 只证明交叉构建，不是 arm64 原生启动；候选 native 结果 pending              | 未运行；候选场景已定义，pending                      | 未采集                    | 未采集；无原生 PID/architecture/loopback 证据                        | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（windows-arm64 green cross-build）                                |
| Linux x64 AppImage                        | `ubuntu-24.04` x64；解包 → 启动；runtime + node-required                         | 旧 workflow 已做 extract+start，package job green                                       | 未运行；候选场景已定义，pending                      | 旧证据未记录精确时长      | 旧 smoke 未绑定精确 listener PID；候选证据 pending                   | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（linux-x64 green）                                                |
| Linux x64 deb                             | `ubuntu-24.04` x64；安装 → 启动 → purge；runtime + node-required                 | 旧 workflow 已做 install+start，package job green                                       | 未运行；候选场景已定义，pending                      | 旧证据未记录精确时长      | 旧 smoke 未绑定精确 listener PID；候选证据 pending                   | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（linux-x64 green）                                                |
| Linux arm64 AppImage                      | `ubuntu-24.04-arm` arm64；解包 → 启动；runtime + node-required                   | 旧 job green 只证明交叉构建，不是 arm64 原生启动；候选 native 结果 pending              | 未运行；候选场景已定义，pending                      | 未采集                    | 未采集；无原生 PID/architecture/loopback 证据                        | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（linux-arm64 green cross-build）                                  |
| Linux arm64 deb                           | `ubuntu-24.04-arm` arm64；安装 → 启动 → purge；runtime + node-required           | 旧 job green 只证明交叉构建，不是 arm64 原生启动；候选 native 结果 pending              | 未运行；候选场景已定义，pending                      | 未采集                    | 未采集；无原生 PID/architecture/loopback 证据                        | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（linux-arm64 green cross-build）                                  |
| Universal macOS DMG（Apple Silicon 执行） | `macos-15` arm64；挂载 DMG → 复制 `.app` → 启动；runtime + node-required         | 旧 macos-universal job green 为静态 DMG/产物校验，不是 arm64 原生启动；候选结果 pending | 未运行；候选场景已定义，pending                      | 未采集                    | 未采集；无原生 PID/architecture/loopback 证据                        | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（macos-universal static green）                                   |
| Universal macOS DMG（Intel 执行）         | `macos-15-intel` x64；挂载 DMG → 复制 `.app` → 启动；runtime + node-required     | 旧 macos-universal job green 为静态 DMG/产物校验，不是 x64 原生启动；候选结果 pending   | 未运行；候选场景已定义，pending                      | 未采集                    | 未采集；无原生 PID/architecture/loopback 证据                        | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（macos-universal static green）                                   |
| Universal macOS ZIP（更新载体）           | `macos-15` 打包产物；仅静态归档与 `update-manifest.json` 选择/校验，不作为启动包 | 未执行 ZIP 原生启动；候选 workflow 也未定义该启动路径                                   | 未覆盖；没有 ZIP packaged no-Node 启动场景           | 不适用                    | 不适用；ZIP 不是本矩阵的可执行安装路径                               | [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175)（macos-universal static green；release/manifest publish skipped） |

发布后再补：repaired Run URL、每个 job conclusion、实际 ready duration、精确 Electron/Harness/listener PID 与 `127.0.0.1` 绑定、no-Node 指引结果、资产名、manifest 和 SHA-256。没有这些字段时不得把矩阵标成 verified。

## 0.1.0-BETA2-1 implementation evidence

- The pinned `@deepseek-ai/dsh-terminal-bash@0.1.0-rc.8` patch changes `CONTROLLED_PROMPT` to `__DSH_PERSISTENT_BASH_PROMPT__` and replaces the hard-coded prompt bound with `CONTROLLED_PROMPT.length + 1`. The patch is registered in both root and packaged runtime lockfiles with hash `ab9c3393...`.
- A real local installed Harness run after runtime reconciliation executed `cd "/Users/trip/TRUE 开发/openless" && pwd && printf "BASH_PATCH_OK\n"` in `0.3s` and returned `BASH_PATCH_OK`; the previous same-shape call had timed out at 300s. After the remote update/restart, the same exact command returned `BASH_PATCH_OK` again; current session statistics report `工具调用 0.8s`.
- Local `pnpm test` passes 316 unit tests (3 intentionally skipped), 108 Anchored tests, 24 plugin/real-Harness tests, 39 package-contract tests, and 2 Playwright E2E tests. `pnpm check`, runtime closure, Universal DMG verification, and the Universal ZIP resource inspection also pass locally.
- The updater now remains user-confirmed: it selects the x64/arm64 or macOS universal asset, verifies SHA-256, invokes the platform replacement helper, and restarts only after the user chooses “Update and restart”. CI generates `update-manifest.json` from the release assets.
- The updater host policy now explicitly allows GitHub’s signed `release-assets.githubusercontent.com` redirect target. The regression reproduces the real release redirect and the updater host/fetch/manifest suite passes 47 tests after the fix.
- Large installer downloads now use 32 MiB HTTPS Range chunks with per-chunk timeout, retry, and size validation, so a CDN connection ending near 100 MB cannot leave the update flow hanging or corrupt the package.
- Tagged workflow `32389858728` completed successfully for macOS Universal, Windows x64/arm64, Linux x64/arm64 packaging jobs and the GitHub Release publish job. This describes successful asset production, not native execution of every architecture. Release `v0.1.0-BETA2-1` is Latest/non-prerelease and exposes eight installers plus `update-manifest.json`; the remote manifest selects the Universal macOS ZIP and architecture-specific Windows/Linux assets with 64-character SHA-256 values.
- The green final run does not erase fresh-install usability problems. BETA2-1 synchronously invoked the official plugin CLI once per managed plugin, which was borderline on Windows and became a 600-second failure with the BETA2-2 roster. It also requires official system Node >=22.13 and never installs Node; the [Issue #17](https://github.com/Code-DSH/deepseek-harness-code/issues/17) reply claiming automatic Node installation was incorrect.
- Replace this download only after BETA2-2 is Latest and its assets/manifest are independently verified. Then delete only the BETA2-1 GitHub Release/assets; retain its source tag and this record.

## 0.1.0-BETA2 integration evidence (current)

- BETA2 is released only from the synchronized `main` commit accepted by the release PR; tag `v0.1.0-BETA2` identifies the immutable source used by tag CI.
- Runtime pinned at `@deepseek-ai/dsh@0.1.0-rc.8`, Electron 43.4.0, pnpm 11.19.0, `dsh-find-plugin@0.3.6`. BETA2 retains the official system Node >=22.13 implementation already present in the BETA1 tag; PR #4 merge `0d0bb18` predates BETA1, and the BETA1/BETA2 `system-node` blob is identical. The old BETA1 portable-Node prose was documentation drift.
- Harness Home resolution uses `@deepseek-ai/dsh-home-paths@0.1.0-rc.8`. Migration from `<Electron userData>/dsh-home` is copy-only, target-wins, symlink-rejecting, permission-preserving (0600/0700), idempotent, and rollback-safe.
- The host installs **8+ integrated plugins** only through `dsh plugin --profile web add` using the bundled pnpm runtime: `deepseek-harness-desktop-plugin`, `dsh-ui-motion@1.1.0`, `dsh-model2-selector@1.1.0`, `dsh-ui-polish`, `dsh-updater-check@1.0.0`, `dsh-prompt-principles`, `dsh-vision-router@1.7.1`, `dsh-better-sidebar@0.12.3`, `dsh-superpowers`, `@dsh-external/dsh-super-injector@0.3.3`, `@dsh-external/dsh-mode-boost@0.1.0`, `dsh-find-plugin`, and `deepseek-harness-composition` (MCP bridges + subagent providers). The Harness child receives `--expose-internals`; all bare-name patches are retained. A corrupted profile `node_modules` triggers a one-time rebuild before failing.
- Packaged extra resources include `routing-suite/` (SHA-256 pinned), `superpowers-skills/`, `global-agent-prompt/`, and the 8 plugin trees; `asar: false` preserves the full `window.__DSH_BOOT__` boot graph (39+ entries).
- Historical BETA2 gates: `pnpm build` → `pnpm check:memory` → `pnpm preflight:runtime` (51 runtime artifacts + 35 production dependencies + 8 critical versions + 10 bundled plugin packages + SHA-256 digests + bare-name patches + orphan import rejection) → `pnpm check` (typecheck + lint + format:check + verify:docs + verify:security) → tag CI packaging. The macOS tag job ran `verify-macos-artifact.mjs --universal`; Windows/Linux arm64 asset builds were cross-build coverage, not native execution.
- BETA2 accepted only an official system Node.js installation and never downloaded or added a private Node to PATH. Its updater host was informational only; BETA2-1 supersedes that boundary with user-confirmed replacement while retaining no background schedule or silent update. Startup no longer scans or terminates unrelated system Harness processes.

## 0.1.0-BETA1 historical artifact

- DMG: `release/DeepSeek-Harness-Code-0.1.0-BETA1-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- Size: 221,134,518 bytes
- SHA-256: `b1afaa874d00f1254c8d5542c64bc80969a804ad44d3ce96284c0ad73fcf25ce`
- `verify:mac --universal` mounted the DMG read-only, verified the runtime dependency closure, Anchored Standard provenance, ad-hoc signature, and 49 Universal/architecture-qualified Mach-O files. A separate `codesign --verify --deep --strict` completed without error.
- Integrated surface in BETA1: 6 plugins and rc.6. Historical release prose incorrectly claimed portable Node download/no global Node: PR [#4](https://github.com/Code-DSH/deepseek-harness-code/pull/4), merge `0d0bb18`, is an ancestor of the BETA1 tag, so tagged code already required system Node. BETA2 retained the same `system-node` blob rather than introducing or expanding that model.
- [Issue #10](https://github.com/Code-DSH/deepseek-harness-code/issues/10) records the BETA1 product bugs: silent single-instance-lock failure, one resident Watchdog per relaunch, and a 1-second Windows cleanup race that could trigger `EADDRINUSE`.
- No formal `BETA1-1` tag, Release, commit text, Issue, PR, or code reference exists. If that name meant BETA2-1, use the BETA2-1 section above.

## 0.3.2/0.3.1 historical evidence (archived)

### 0.3.2 official-install evidence

- All pre-existing local branches and worktrees were consolidated into `main@89c2b19`; implementation continues in the isolated `feat/official-harness-install` worktree.
- Harness Home resolution now uses `@deepseek-ai/dsh-home-paths@0.1.0-rc.6`. Migration from `<Electron userData>/dsh-home` is copy-only, target-wins, symlink-rejecting, permission-preserving, idempotent, and rollback-safe; it never removes the source or copies profile installation state.
- The host installs the desktop bundle, Super Injector, Mode Boost, and `dsh-find-plugin` only through `dsh plugin --profile web add`. Its private `PATH` exposes `pnpm@11.19.0` from the app bundle, while the Harness child receives `--expose-internals` and all three audited plugin patches retain bare names.
- The Universal app directory is 871 MB unpacked, ad-hoc signature verification passes, and its primary executable contains `x86_64 arm64`. Packaged Electron resolves its own `@deepseek-ai/dsh`, Home-paths, pnpm entry, and find-plugin package.
- A packaged-runtime integration run used the Universal executable, packaged pnpm, packaged rc.6, and all four actual plugin roots against an isolated Home. Official reconciliation completed and the loopback boot graph served `deepseek-harness-desktop-plugin/client.js` successfully.
- Current gates: 30 unit files / 118 tests, 108 Anchored tests, 24 plugin/real-Harness tests, four package tests, two Chromium tests, typecheck, lint, formatting, 42 documentation files, security contract, production audit, and runtime closure all pass. Runtime closure records 25 artifacts, 35 production dependencies, eight critical versions, and four integrated plugin packages.

### 0.3.1 artifact (archived)

- DMG: `release/DeepSeek-Harness-Code-0.3.1-mac-universal.dmg`
- App: `release/mac-universal/DeepSeek Harness Code.app`
- Size: 284,138,156 bytes (271 MiB displayed by `ls`)
- SHA-256: `35d7a81fbddd8ffb479b5834ac2b669eb5708c62ac67781f6d43368af91bbf79`
- `verify:mac --universal` mounted the DMG read-only, verified the runtime dependency closure, Anchored Standard provenance, ad-hoc signature, and 49 Universal/architecture-qualified Mach-O files. A separate `codesign --verify --deep --strict` completed without error.

## Root-cause and repair evidence

1. The installed 0.1.0 preload contained a bare `require("zod")`. Electron sandbox preload could not resolve it, so `window.deepseekDesktop` was undefined and all official desktop settings were absent. The preload now bundles validation code and exposes only `preferences` and `runtime` capability groups.
2. Standard workspace creation first lacked `@deepseek-ai/dsh-workflow`; the later `compaction (cordis:group)` failure proved that the packaged closure also omitted `@deepseek-ai/dsh-compaction` and `@deepseek-ai/dsh-invariants`. All three are exact production dependencies. The real Electron UI now switches to `Deepfake V4 pro test`, creates/restores a Standard session, and shows no mount alert.
3. The plugin initially read protected Cordis services without complete client injection. The served client now exports `inject = ["slots", "locale"]`, and the real Harness contract test applies/disposes it under a strict context.
4. Route animation forced synchronous layout with `offsetWidth`. The implementation now alternates CSS animation tokens after a single observed DOM commit and disconnects the observer.
5. Normal quit could publish `stopping` to an already destroyed renderer and abort before child retirement. Observer failures are now isolated; a real follow-up run proved the Harness PID retired after normal close.
6. The product application menu omitted Electron's native Edit roles, leaving the system clipboard shortcut path incomplete. The host now installs Undo/Cut/Copy/Paste/Select All on every platform, adds a macOS `Control+V` alias, and has a fixed internal preload fallback. The fallback rejects non-trusted synthetic keyboard events before IPC. A runtime test pasted a 33-character non-secret placeholder into the official API-key password field and then cleared both the field and clipboard.
7. The former anchored preference and fallback Web bundle were removed. The audited preset is now an optional Agent Preset installed atomically under the app-private Harness home. Unknown or locally modified same-name presets are never overwritten; invalid packaged resources disable only the optional preset, so Standard startup continues. The desktop runtime emits bounded conflict/unavailable enums. The old persisted field is ignored for one migration version and disappears on the next preference write.
8. The generic menu-bar glyph was replaced by a transparent template image generated from the official mark; Windows and Linux use the full Code product icon. The official mark in the main application icon was moved down toward the Code wordmark.
9. The General-settings controls formerly used raw HTML select, checkbox, and buttons. They now use the official `@deepseek-ai/dsh-client-ui-primitives` Button/Menu/Icon components. A live layout audit found zero raw selects/checkboxes, matching trigger/menu right edges, and an ellipsis-safe label. The plugin follows the official locale service in both Chinese and English.
10. The startup surface formerly used gradients and a frosted card. It now renders only a system light/dark pure background and one centered 24 px monochrome spinner. `preflight:runtime` resolves every production dependency, verifies runtime artifacts including both preset/provenance sets, and pins critical runtime packages before any builder command runs.
11. The macOS traffic-light group previously used `{ x: 16, y: 6 }`, placing the red button closer to the top edge than the left edge. The native BrowserWindow position is now `{ x: 16, y: 16 }`; no Web title bar, spacer, or renderer offset was added.
12. The rc.6 `turn-tail.tailData()` fallback searched the complete growing Context match list on every open-turn derived flush because `state.end` is intentionally absent before `turn/end`. A 10,000-delta real-bundle regression measured 50,015,000 match inspections. The exact-version pnpm patch now reads the Definition-owned state directly during normal operation (zero inspections), retains the original scan only when state is unexpectedly absent, and leaves canonical chunk ingestion and Assistant publication cadence unchanged.
13. The merged Routing Suite branch originally downloaded release archives plus a mutable router `main` archive in the background, recorded their digests only after download, and executed the resulting cache on the next launch. The release now bundles exact injector `0.3.3`, mode-boost `0.1.0`, and router preset commit `eff787e95132d6c7104214542104a84d656b497e`; each archive is compared with a reviewed SHA-256 before any `tar` extraction. The runtime updater was removed, and an intentionally valid but substituted archive fixture proves the check fails before executable output is created.
14. The 0.3.0 macOS `activate` listener was registered before Electron readiness and could call `new BrowserWindow()` from a pre-ready event. The installed stack resolved exactly to that callback. The listener is now registered only inside the fulfilled `app.whenReady()` continuation, matching Electron's documented lifecycle requirement; the regression reproduces the old exception under a pending readiness promise.
15. Routing Suite assembly appended its managed `- insert:` block after the official empty `[]` profile document. The exact rc.6 loader rejected line 5 with `end of the stream or a document separator is expected`, so the child exited before readiness. Startup now replaces the empty document, migrates the exact malformed 0.3.0 output idempotently, and preserves unrelated valid user patch entries.
16. After repairing YAML, a real isolated rc.6 run revealed both Routing Suite packages still failed as bare imports from profile-local links. The build now adapts the injector's checksum-verified patch only after archive verification, and both injector and mode boost resolve through stable profile-relative public entry paths. A source-tree run and the packaged 0.3.1 executable each served the loopback Web root with HTTP 200.
17. System Node auto-detection entered the tagged product through PR #4 before BETA1: `apps/desktop/src/lifecycle/system-node.ts` scans PATH + Homebrew/nvm/Volta/fnm/mise/Scoop/Chocolatey + NVM_DIR/VOLTA_HOME/FNM_DIR. BETA2 carries the same blob; its built-in `pnpm` launcher and isolated retry on corrupted profile `node_modules` keep the public CLI path green even from GUI launches with a minimal PATH.
18. A BETA2 merge retained both the direct `app.whenReady()` block and the extracted lifecycle authority. One Electron main process therefore launched two Watchdogs and two first-run pnpm installs against the same `node-runtime/packages` directory; one copy removed `@deepseek-ai__dsh.patch` while the other still handled it, surfacing `ENOENT unlink` even though the competing install later completed. The direct duplicate registration is removed, updater ownership is folded into the single lifecycle authority, and the startup action is single-flight with a concurrent-call regression.

## Automated verification

| Gate              | Historical result (BETA2-1)                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit suite        | 51 files / 314 tests passed (3 intentionally skipped), including Routing Suite, system-node, updater, and stream regressions |
| Upstream preset   | 108 vendored upstream and local-patch tests passed                                                                           |
| Official plugins  | 3 files / 24 tests passed, including pinned rc.8 roster, session creation, and boot                                          |
| Package contract  | 2 files / 39 tests passed                                                                                                    |
| Browser E2E       | 2 Playwright Chromium tests — desktop slot/transition/cleanup + real client graph                                            |
| TypeScript        | `tsc --noEmit` passed                                                                                                        |
| Static gates      | ESLint, Prettier, documentation links (verified 2026-08-20), and 7-control/6-forbidden security contract passed              |
| Dependency audit  | `pnpm audit --prod` reported no known vulnerabilities                                                                        |
| Runtime preflight | 51 artifacts, 35 production dependencies, 8 critical packages, and 10 bundled plugin packages verified                       |
| macOS package     | Local `verify:mac --universal` passed; tagged Universal macOS job passed and uploaded DMG + ZIP                              |

Historical BETA2-1 and 0.3.x gate snapshots are retained for traceability; the current BETA2-2 repaired cloud gate is pending.

## Real renderer and performance evidence

- Grouped bridge keys: `preferences`, `runtime`; no arbitrary IPC/shell/path API.
- Composer accepted `UI smoke test — 中文输入与复制`, and full keyboard selection covered the complete 23-character value; the test cleared it without sending.
- `Read Only` selection remained visible and the menu closed normally, then `Workspace Write` was restored. The prior flashback was not reproduced.
- Official General settings render localized desktop status, the official Button/Menu close selector, restart/log actions, and bounded preset-conflict/unavailable notices only when needed. The obsolete anchored switch and fallback disclosure are absent.
- Close preference changes round-trip through the bridge; no desktop preference changes the official Agent Preset default.
- The official API-key password field accepted the non-secret clipboard placeholder through macOS `Control+V`; the field and clipboard were cleared immediately afterward.
- Normal application quit retired Electron, Harness, and Watchdog; no process was relaunched three seconds later.
- Five seconds idle: zero layouts, eight style recalculations, 1.631 ms cumulative task time, 456-byte heap delta, and approximately 0% Electron renderer/main CPU at the sample point.

## Anchored Standard boundary

The user-supplied community claim is experimental and is not a benchmark guarantee. The pinned Agent Preset uses rc.8 assembly/event hooks rather than `AgentPresets.recompose()`: request one exposes exactly `bash` and `str_replace_editor`; a durable tool call or assistant message promotes the current epoch to resident discovery, and explicit unlock events extend later schemas. The real rc.8 roster reports the preset healthy, Standard remains default, and `session.create` successfully mounts `anchored-standard`. A loopback mock DeepSeek provider captured the serialized first request with exactly the two bootstrap tools and the second request with exactly the five resident tools. The implementation never intercepts private model-request fields or captures/replays hidden reasoning.

## Routing Suite and bundled Skills boundary

- The bundled snapshot pins injector `0.3.3`, mode-boost `0.1.0`, and router preset `0.2.0` at commit `eff787e95132d6c7104214542104a84d656b497e`; `build/routing-suite/versions.json` records each archive SHA-256 (`355238fa...`, `72836d64...`, `a8f3616f...`).
- Startup assembly is idempotent: the injector is appended after the desktop bundle, mode-boost is linked and inserted into `cordis.patch.yml`, and both router presets are installed under `<DSH_HOME>/.agent-presets` with ownership markers and digests.
- The installed app has **no runtime updater**. Routing code changes only with a reviewed app release; the build rejects digest drift before `tar`.
- Superpowers 6.2.0 skills are installed under `<DSH_HOME>/skills` with per-skill markers. A same-named unmarked or modified directory is preserved and reported; package failure disables only the bundled Skills while Standard continues.
- Managed preset and skill installation normalizes bilingual display copy before digesting, so refreshed routing presets cannot silently restore raw IDs or empty descriptions.

## Cross-platform status

- macOS Universal DMG is locally built and inspected (`--universal`).
- BETA2/BETA2-1 published Windows NSIS and Linux AppImage/deb assets, but their historical green workflows did not natively execute every architecture. Old true install+start coverage was Windows x64 NSIS and Linux x64 deb; Linux x64 AppImage was extract+start; Windows/Linux arm64 were cross-build only; macOS was static DMG inspection.
- BETA2-2's candidate workflow assigns `windows-2025`, `windows-11-arm`, `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15`, and `macos-15-intel` to the native matrix. Execution remains pending until exact cloud run/job evidence is recorded in the matrix above.

## External limits

- The equal 16-point traffic-light contract is verified in source, test, and the packaged main process. Native visual inspection on macOS 15 and macOS 26 remains an external gate; the local packaging host is macOS 27 and cannot substitute for those runs.
- The key pasted in chat was not used, stored, printed, or forwarded. It must be revoked. A 45-minute live-provider soak is intentionally deferred until a replacement is entered by the user through official Harness settings.
- V4 Pro/Flash selection and the official `off` / `high` / `max` reasoning controls are available in the pinned adapter. The literal `We need` automatic reasoning trigger is documented as a next requirement and is not represented as shipped until its public per-request implementation and tests exist.
- The routing-suite immutable snapshot replaces the former mutable `dsh-router-standard/main` refresh; releases now claim a fully pinned routing supply chain verified by SHA-256 at build time.

## Related documents

- Parent: [Engineering index](./index.md)
- Testing strategy: [Testing](./testing.md)
- Installation: [Unsigned installation](../operations/install-unsigned.md)
- Current plan: [Implementation plan](../plans/active/deepseek-harness-desktop.md)
