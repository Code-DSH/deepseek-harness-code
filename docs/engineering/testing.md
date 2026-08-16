# Testing Strategy

Use TDD for runtime behavior. Required layers are unit tests for state and security contracts, plugin DOM tests, real Harness roster/session integration, deterministic request-assembly tests, process fault injection, cross-platform Chromium Web tests, and macOS package/signature inspection.

Harness 0.1.0-rc.6 exposes no verified `/api/health` route. Integration tests therefore assert child liveness and an HTTP 2xx Web-root response; they also assert that the service binds only to `127.0.0.1`.

Live acceptance is separate: credentials are entered in the Harness UI by the user and are never inspected by automation. The planned 45-minute V4 Flash observation and 20 interactions are recorded only when configured.

## Verified on 2026-08-16

- Unit/state/security behavior: 22 files, 84 tests.
- Vendored Anchored Standard implementation: 108 upstream and local-patch tests.
- Anchored Standard coverage includes exact two-tool bootstrap, both promotion events, automatic-context filtering, explicit unlock recovery, session isolation, subagent residency, compaction epochs, strict missing-tool failures, official rc.6 discovery/session creation, conflict preservation, and atomic upgrades.
- Package contract: 1 file, 4 tests.
- Plugin and real-Harness integration: 3 files, 20 tests. A loopback mock provider captures real serialized agent requests and verifies request one has only the bootstrap pair while request two has only the resident five-tool set. The real API readiness helper retries only route-level 404 responses because rc.6 can serve the Web root before Cordis registers `agentPreset.list`; six consecutive diagnostic repetitions verified the condition-based wait.
- Playwright browser acceptance: 1 Chromium test covering desktop setting registration, route-transition commit, and cleanup.
- TypeScript, ESLint, Prettier, 24-file documentation link validation, and the 7-control static security contract are release gates.
- Fault injection recovered a killed Harness in nine seconds. Killing the renderer rebuilt the window while preserving the Electron main and Harness PIDs.
- The 0.2.0 Universal package was mounted and signature-checked; the pinned preset/provenance resource set was present and 49 Mach-O files passed Universal/architecture-qualified inspection.
- A real Electron run verified the grouped preload API, text input and full selection, Standard workspace creation after the compaction-peer repair, permission-menu persistence, localized General settings, official Harness Button/Menu rendering with no raw select/checkbox, close-preference persistence, and `Control+V` paste into the official password field without reading a credential.
- An idle five-second performance sample recorded zero layouts, 1.631 ms total task time, and a 456-byte JS-heap delta. The plugin no longer uses `offsetWidth` or an always-running animation.

Detailed evidence and unexecuted external checks are in the [acceptance report](./acceptance-report.md).

The progressive mechanism and package lifecycle are release gates even without provider credentials. A V4 Pro quality claim is a separate paired experiment: fixed tasks, Standard and Anchored at least ten times each, schema hashes/completion/score/variance only, and no retained reasoning body.
