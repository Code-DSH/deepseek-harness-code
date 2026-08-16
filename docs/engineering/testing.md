# Testing Strategy

Use TDD for runtime behavior. Required layers are unit tests for state and security contracts, plugin DOM tests, real Harness roster/session integration, deterministic request-assembly tests, process fault injection, cross-platform Chromium Web tests, and macOS package/signature inspection.

Harness 0.1.0-rc.6 exposes no verified `/api/health` route. Integration tests therefore assert child liveness and an HTTP 2xx Web-root response; they also assert that the service binds only to `127.0.0.1`.

Live acceptance is separate: credentials are entered in the Harness UI by the user and are never inspected by automation. The planned 45-minute V4 Flash observation and 20 interactions are recorded only when configured.

## Current Desktop Rendering Contract

The desktop bundle leaves streamed prose, Think disclosures, native status copy, elapsed-time calculation, and accessibility semantics to the official Harness DOM. It does not install a text mask, glyph copy, particle effect, fixed-position thinking indicator, status replacement, or DOM-mutation-driven page animation. While a turn is running, the plugin portals one rotating 20-pixel Orb into the direct native polite status row and the exact rc.6 patch shows Harness's own clock from `0s`; both fail open and disappear with the native row. On macOS all page surfaces begin at the top edge, while the pinned sidebar component alone uses `46px` expanded / `58px` collapsed top padding to clear native traffic lights. Superpowers 6.2.0 is copied from the packaged resource into the app-owned `DSH_HOME/skills` root at startup; an unmarked same-named skill directory remains untouched.

## Verified on 2026-08-16

- Unit/state/security and plugin contracts: 30 files / 112 tests cover the desktop host, watchdog, progressive preset installer, checksum-pinned Routing Suite assembly, native conversation-rendering boundary, inline Orb detector/cleanup, immediate Harness timer, and absence of a fixed thinking overlay.
- Seven Routing Suite tests cover valid rc.6 YAML loading, 0.3.0 migration, preservation of user entries, idempotency, fail-open absence, profile-relative injector adaptation, and rejection of a structurally valid substituted archive before executable extraction. Temporarily disabling only the SHA-256 comparison makes the security regression fail.
- The Electron readiness regression imports the real main module with `whenReady()` pending and proves that an early macOS `activate` event cannot construct a BrowserWindow. The pre-fix test reproduced the user's exact `Cannot create BrowserWindow before app is ready` exception.
- The rc.6 stream-performance regression executes the actual packaged Assistant and turn-tail Definitions. Across 10,000 ordered deltas it independently accumulates the expected text, verifies the `[7pr]` final token, reasoning/final/structural synchronous publication, hydration/reconnect, two interleaved session assemblers, and fail-open behavior. Open-turn match inspections fell from 50,015,000 on the unpatched bundle to zero with the exact-version patch.
- Vendored Anchored Standard implementation: 108 upstream and local-patch tests.
- Anchored Standard coverage includes exact two-tool bootstrap, both promotion events, automatic-context filtering, explicit unlock recovery, session isolation, subagent residency, compaction epochs, strict missing-tool failures, official rc.6 discovery/session creation, conflict preservation, and atomic upgrades.
- Package contract: 1 file, 4 tests.
- Plugin and real-Harness integration: 3 files, 23 tests covering the official plugin contract, deterministic client build, progressive preset roster/session creation, serialized two-tool and resident five-tool requests, and the real pinned-Harness boot graph. The readiness helper retries only route-level 404 responses because rc.6 can serve the Web root before Cordis registers `agentPreset.list`.
- Browser acceptance covers desktop slot registration, route-transition commit, cleanup, and the actual generated client under React 18. The real Chromium test proves the Orb canvas is 20×20, is parented by the native `role=status` row, uses relative `z-index: 1` / `order: -1`, and is removed on disposal.
- TypeScript, ESLint, Prettier, 34-file documentation-link validation, the 7-control/3-forbidden static security contract, and the production dependency audit pass as release gates. Generated checksum-pinned Routing Suite files and the vendored Superpowers tree are outside owned-source lint/format scope.
- Runtime closure verifies the local runtime artifacts, critical Harness packages, bundled `thinking-orbs@0.3.1` code, and its license artifact; it rejects unresolved Orb/controller imports in `client.js`.
- The desktop plugin has no fixed conversation overlay, CSS Highlight, glyph copy, particle, or status replacement to retain. Its inline Orb host exists only while the authoritative native running row exists.
- Fault injection recovered a killed Harness in nine seconds. Killing the renderer rebuilt the window while preserving the Electron main and Harness PIDs.
- The 0.3.1 Universal package was mounted and signature-checked; both managed preset resource sets were present and 49 Mach-O files passed Universal/architecture-qualified inspection. The Routing Suite manifest and all four expected executable/preset entry points were also checked in the packaged resources.
- The packaged 0.3.1 Electron executable ran the bundled rc.6 DSH against an isolated profile containing both Routing Suite packages; the loopback Web root returned HTTP 200 and advertised both the official conversation client and `deepseek-harness-desktop-plugin`.
- A real Electron run verified the grouped preload API, text input and full selection, Standard workspace creation after the compaction-peer repair, permission-menu persistence, localized General settings, official Harness Button/Menu rendering with no raw select/checkbox, close-preference persistence, and `Control+V` paste into the official password field without reading a credential.
- An idle five-second performance sample recorded zero layouts, 1.631 ms total task time, and a 456-byte JS-heap delta. The plugin no longer uses `offsetWidth` or an always-running animation.

Detailed evidence and unexecuted external checks are in the [acceptance report](./acceptance-report.md).

The progressive mechanism and package lifecycle are release gates even without provider credentials. A V4 Pro quality claim is a separate paired experiment: fixed tasks, Standard and Anchored at least ten times each, schema hashes/completion/score/variance only, and no retained reasoning body.
