# Testing Strategy

Use TDD for runtime behavior. Required layers are unit tests for state and security contracts, plugin DOM tests, real Harness roster/session integration, deterministic request-assembly tests, process fault injection, cross-platform Chromium Web tests, and macOS package/signature inspection.

Harness 0.1.0-rc.6 exposes no verified `/api/health` route. Integration tests therefore assert child liveness and an HTTP 2xx Web-root response; they also assert that the service binds only to `127.0.0.1`.

Live acceptance is separate: credentials are entered in the Harness UI by the user and are never inspected by automation. The planned 45-minute V4 Flash observation and 20 interactions are recorded only when configured.

## Current Desktop Rendering Contract

The desktop bundle leaves streamed prose and reasoning to the official Harness DOM. It does not install a text mask, glyph copy, particle effect, or DOM-mutation-driven page animation. The only active conversation effect is a non-interactive `ThinkingOrb` rendered at the measured native running-status anchor; completion, navigation, reduced motion, or disposal removes it. The earlier stream-output dissolve controllers are no longer registered by the generated `client.js`, although their historical source and tests remain in the repository. Superpowers 6.2.0 is installed from the packaged resource into the app-owned `DSH_HOME/skills` root at startup; an unmarked same-named skill directory remains untouched.

## Verified on 2026-08-16

- Unit/state/security suite: 27 files, 103 tests covering the desktop host, watchdog, progressive preset installer, Routing Suite assembly/refresh/resolution, Superpowers conflict preservation, bilingual preset metadata, package-runtime closure, and ThinkingOrb lifecycle.
- Routing Suite tests cover idempotent profile assembly, bundle ordering, mode-boost patch insertion, managed router-preset installation, fail-open missing-resource behavior, cache preference, 24-hour refresh cadence, and archive digest recording.
- Vendored Anchored Standard implementation: 108 upstream and local-patch tests.
- Anchored Standard coverage includes exact two-tool bootstrap, both promotion events, automatic-context filtering, explicit unlock recovery, session isolation, subagent residency, compaction epochs, strict missing-tool failures, official rc.6 discovery/session creation, conflict preservation, atomic upgrades, and bilingual display metadata.
- Package contract: 1 file, 4 tests.
- Plugin and real-Harness integration: 3 files, 23 tests covering the official plugin contract, deterministic client build, progressive preset roster/session creation, serialized two-tool and resident five-tool requests, and the real pinned-Harness boot graph. The readiness helper retries only route-level 404 responses because rc.6 can serve the Web root before Cordis registers `agentPreset.list`.
- Playwright browser acceptance currently passes 2 of 5 tests. The desktop-slot test and the localized running-status test pass; three legacy stream-output-animation tests still call the removed `installStreamOutputEffects` hook and must be repaired or removed before a full browser gate can be claimed.
- The historical controller regressions remain available for the dormant stream-output sources, but they do not describe the active client until that feature is reintroduced.
- Runtime closure verifies 12 local artifacts, 32 production dependencies, five critical Harness packages, `thinking-orbs@0.3.1`, plugin license notices, and the absence of unresolved animation-module imports in `client.js`.
- Fault injection recovered a killed Harness in nine seconds. Killing the renderer rebuilt the window while preserving the Electron main and Harness PIDs.
- The 0.2.0 Universal package was mounted and signature-checked; the pinned preset/provenance, Routing Suite, and Superpowers resource sets were present and 49 Mach-O files passed Universal/architecture-qualified inspection. That artifact predates the latest bilingual preset copy, so a clean rebuild is still required.
- A real Electron run verified the grouped preload API, text input and full selection, Standard workspace creation after the compaction-peer repair, permission-menu persistence, localized General settings, official Harness Button/Menu rendering with no raw select/checkbox, close-preference persistence, and `Control+V` paste into the official password field without reading a credential.
- An idle five-second performance sample recorded zero layouts, 1.631 ms total task time, and a 456-byte JS-heap delta. The plugin no longer uses `offsetWidth` or an always-running animation.

Detailed evidence and unexecuted external checks are in the [acceptance report](./acceptance-report.md).

The progressive mechanism and package lifecycle are release gates even without provider credentials. A V4 Pro quality claim is a separate paired experiment: fixed tasks, Standard and Anchored at least ten times each, schema hashes/completion/score/variance only, and no retained reasoning body.
