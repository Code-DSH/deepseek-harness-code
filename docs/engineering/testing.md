# Testing Strategy

Use TDD for runtime behavior. Required layers are unit tests for state and security contracts, plugin DOM tests, real Harness roster/session integration, deterministic request-assembly tests, process fault injection, cross-platform Chromium Web tests, and macOS package/signature inspection.

The maintained Harness 0.1.1-rc.2.code.1 exposes no verified `/api/health` route. Integration tests therefore assert child liveness and an HTTP 2xx Web-root response; they also assert that Harness itself binds only to `127.0.0.1`. Runtime gates additionally verify the submodule gitlink, complete local family, provenance hashes, token-gated LAN proxy, IPC redaction, and Windows sandbox/workdir behavior.

BETA3 native package Run [32550253496](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32550253496) passed Windows and Linux x64/arm64 plus macOS Intel/Apple Silicon runtime and packaged no-Node scenarios before publishing GitHub Latest. The same run produced the nine release assets and updater manifest.

## Current checkout audit snapshot

The audited checkout is `review/install-update-flow`, with package baseline `0.1.0-BETA3` / Harness `0.1.1-rc.2.code.1`. Focused updater coverage includes replayable status snapshots, plugin-owned desktop/LAN status UI, authenticated LAN JSON/SSE routes, persistent AppImage targeting, Windows custom NSIS directory forwarding, ranged installer bounds, app-owned runtime-tree cleanup, stale pending-update invalidation, and the existing macOS helper contract. Native Windows/Linux replacement and macOS post-update launch validation remain platform-runner gates.

Live acceptance is separate: credentials are entered in the Harness UI by the user and are never inspected by automation. The planned 45-minute V4 Flash observation and 20 interactions are recorded only when configured.

## Release evidence vocabulary

- **产品 bug**：打包应用在用户机器上的安装、启动、恢复或功能路径失败，例如 BETA1 的 Watchdog/锁/端口清理问题、BETA2 的重复生命周期，以及 BETA2-2 首次标记中 Windows x64 安装后 600 秒未 ready。
- **CI / 包装门禁 bug**：workflow、runner、资产校验、清理或证据采集本身不可靠，例如 BETA2 的 AppImage exit 127 诊断、deb 命令路径和 stale-evidence 防护。这类修复不能冒充产品功能修复。
- **覆盖缺口**：workflow 没有在目标架构实际安装/解包并启动，或没有执行 no-Node 场景。交叉构建只能证明构建，不得标记为原生执行。

BETA2 最终 package Run [32363049370](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32363049370) 成功，但旧 workflow 的真实安装+启动仅覆盖 Windows x64 NSIS 与 Linux x64 deb；Linux x64 AppImage 是解包+启动，macOS 是静态 DMG 检查，Windows/Linux arm64 是交叉构建。BETA2-1 Run [32389858728](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32389858728) 也全绿，不能因后续首次安装问题改写为红色。

BETA2-2 workflow 已在 Windows x64/arm64 完成安装+启动+卸载，在 Linux x64/arm64 完成 AppImage 解包+启动与 deb 安装+启动+purge，并在 Apple Silicon/Intel 上复制并启动 Universal DMG。Windows/Linux runtime + node-required 与 macOS runtime 来自 tag Run `32502448560`；macOS node-required 来自 Bash 3.2 修复后的 Run `32505104693`。精确表见[验收报告](./acceptance-report.md#beta2-2-exact-validation-matrix)。

## Current Desktop Rendering Contract

The desktop bundle leaves streamed prose, Think disclosures, native status copy, elapsed-time calculation, and accessibility semantics to the maintained Harness DOM. It does not install a text mask, glyph copy, particle effect, fixed-position thinking indicator, status replacement, or DOM-mutation-driven page animation. On macOS all page surfaces begin at the top edge, while the maintained sidebar source uses `46px` expanded / `58px` collapsed top padding to clear native traffic lights. Superpowers 6.2.0 is copied into `<DSH_HOME>/skills` without overwriting user-owned directories.

## Current candidate baseline verified on 2026-08-21

- The full `pnpm test` candidate run on `f0414b7` completed with 382 passing tests and 4 designed skips in the unit/state/security stage, followed by 117 Anchored Standard tests, 24 plugin/real-Harness integration tests, 58 package/runtime tests, and 3 Playwright tests. The unit stage includes startup single-flight and isolated smoke user-data regressions plus the QQ community, generated-icon, and Basic Auth diagnostic-redaction contracts. These protect the shared user-data runtime from duplicate Watchdogs, overlapping pnpm installs, and CI path/credential escapes; the remaining coverage includes the desktop host, watchdog, system-node auto-detection, official Home selection, copy-only migration, public plugin CLI coordinator, progressive preset installer, checksum-pinned Routing Suite, native conversation-rendering boundary, inline Orb detector/cleanup, immediate Harness timer, and absence of manual profile assembly.
- Six Routing Suite tests cover preset-only synchronization, preservation of user profile files, idempotency, fail-open absence, upstream bare-name patches, official mode-boost bundle metadata, and rejection of a structurally valid substituted archive before executable extraction. Temporarily disabling only the SHA-256 comparison makes the security regression fail.
- System-node tests cover PATH + common locations + NVM_DIR/VOLTA_HOME/FNM_DIR resolution, executable `--version` probing, acceptance of Node 22.19+ and 24+, and explicit Node 23 rejection.
- The Electron readiness regression imports the real main module with `whenReady()` pending and proves that an early macOS `activate` event cannot construct a BrowserWindow. The pre-fix test reproduced the user's exact `Cannot create BrowserWindow before app is ready` exception.
- The maintained 0.1.1-rc.2.code.1 stream-projection regression executes the actual built Assistant and turn-tail Definitions. It verifies reasoning/final/structural synchronous publication, hydration/reconnect, two interleaved session assemblers, and fail-open behavior without a desktop-side DSH patch.
- The prior BETA2-1 baseline carried 108 Anchored Standard tests; BETA2-2 expands the focused suite to 117 tests for the Windows sandbox/workdir boundary, host-sandboxed editor change, and follow-up regression coverage.
- Anchored Standard coverage includes exact two-tool bootstrap, both promotion events, automatic-context filtering, explicit unlock recovery, session isolation, subagent residency, compaction epochs, maintained Harness discovery/session creation, conflict preservation, atomic upgrades, and locale-aware zh/en display copy.
- Runtime staging tests seed `.mimosa` session files in patch/vendor resources and pre-existing user-data directories, then prove both the packaged build and first-launch installer exclude or remove them before pnpm runs.
- The prior BETA2-1 package/runtime contract comprised 39 tests; an earlier BETA2-2 LAN-only snapshot comprised 43 tests. BETA2-2 verifies 58 package/runtime tests covering `package.json` version, engines, plugin manifests, generated installer assets, isolated Harness Home, Linux CI sandbox startup, natural shutdown and final-evidence exit races, bounded evidence freshness and temporary-directory cleanup retries, packaged LAN resources, native smoke/no-Node evidence, architecture binding, diagnostic redaction, agent-tool metadata exclusion, and the single-entry `AGENTS.md` rule.
- Plugin and real-Harness integration covers the public plugin contract, deterministic client build, CLI idempotence/preservation, progressive preset roster/session creation, question protocol, and the real maintained-Harness boot graph.
- Browser acceptance covers 3 Playwright cases: two for desktop slot registration, route-transition commit, cleanup, and the actual generated client under React 18, plus the LAN access UI address-selection/copy contract. The real Chromium test proves the Orb canvas is 20×20, is parented by the native `role=status` row, uses relative `z-index: 1` / `order: -1`, and is removed on disposal.
- TypeScript, ESLint, Prettier, the 7-control/6-forbidden static security contract, and the production dependency audit passed at this code-test baseline. The forbidden contract rejects automatic Node installation, global Harness process termination, and packaged automatic update replacement in addition to the original renderer/Gatekeeper controls. Generated checksum-pinned Routing Suite files and the vendored Superpowers tree are outside owned-source lint/format scope.
- Runtime closure verifies the pinned gitlink, family version, sorted package provenance, every local tarball SHA-256, local-only manifest/lock resolution for all 227 DSH packages, bundled pnpm, external plugin resources, and absence of registry DSH fallbacks.
- The package contract compares the root and first-launch runtime optional-dependency manifests, keeping all 28 platform-native packages explicit so packaged Linux, Windows, and macOS startup does not depend on pnpm discovering transitive optional binaries.
- The desktop plugin has no fixed conversation overlay, CSS Highlight, glyph copy, particle, or status replacement to retain. Its inline Orb host exists only while the authoritative native running row exists.
- Fault injection recovered a killed Harness in nine seconds. Killing the renderer rebuilt the window while preserving the Electron main and Harness PIDs.
- The 0.1.0-BETA1 Universal package was mounted and signature-checked; both managed preset resource sets were present and 49 Mach-O files passed Universal/architecture-qualified inspection. The Routing Suite manifest and all expected executable/preset entry points were also checked in the packaged resources.
- The packaged 0.1.0-BETA2-1 build reuses the same pipeline, carries the terminal-bash patch hash, emits a macOS Universal ZIP for updates, and verifies the architecture-aware update manifest alongside the DMG, Windows NSIS, and Linux AppImage/deb artifacts.

Detailed evidence and unexecuted external checks are in the [acceptance report](./acceptance-report.md).

## Documentation gate verified on 2026-08-21

- `node scripts/check-doc-links.mjs` verified 59 documentation files with zero broken local links after the Beta release/coverage rewrite.
- `pnpm format:check`, the targeted stale-claim searches, and `git diff --check` passed for the documentation change. This current documentation result does not imply the 2026-08-20 code-test suites were rerun.

## BETA2-2 Release Gates

The first BETA2-2 tag did not publish: main CI Run [32468966137](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468966137) had 9 green jobs, while package Run [32468983175](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32468983175) failed at the installed Windows x64 runtime gate after NSIS installation, Node 24.18.0 detection, and pinned Harness installation. No ready evidence arrived within 600 seconds; the app exited code 1 and the release job was skipped. This is packaged-runtime evidence, not an installer-build failure, and it does not identify an exact TypeScript throw site.

BETA2-2 was subsequently published only after the full project suite, structural checks, runtime-closure checks, and repaired native platform packaging workflow passed. BETA3 reused those gates and passed its own native Run `32550253496`. The isolated-data LAN opt-in/authenticate/disable interaction remains separate acceptance evidence.

The package contract now executes the macOS verifier against controlled mounted-app fixtures and rejects a missing LAN five-file resource set, a wrong `dsh-lan-access@1.0.0` identity, or a non-bare patch. Smoke verification also requires `dsh-lan-access/package.json` in both the packaged resource inventory and the app's ready/final evidence. These focused source tests do not replace the pending `dist:mac` plus real-DMG `verify-macos-artifact` gate.

The progressive mechanism and package lifecycle are release gates even without provider credentials. A V4 Pro quality claim is a separate paired experiment: fixed tasks, Standard and Anchored at least ten times each, schema hashes/completion/score/variance only, and no retained reasoning body.
