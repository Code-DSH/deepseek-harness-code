# Testing Strategy

Use TDD for runtime behavior. Required layers are unit tests for state and security contracts, plugin DOM tests, real Harness integration with a mock provider, process fault injection, cross-platform Chromium Web tests, and macOS package/signature inspection.

Harness 0.1.0-rc.6 exposes no verified `/api/health` route. Integration tests therefore assert child liveness and an HTTP 2xx Web-root response; they also assert that the service binds only to `127.0.0.1`.

Live acceptance is separate: credentials are entered in the Harness UI by the user and are never inspected by automation. The planned 45-minute V4 Flash observation and 20 interactions are recorded only when configured.

## Verified on 2026-08-16

- Unit/state/security behavior: 21 files, 76 tests.
- Official plugin contract, anchored safe fallback, and real pinned-Harness boot graph: 3 files, 15 tests.
- Package contract: 1 file, 4 tests.
- Playwright browser acceptance: 1 Chromium test covering desktop setting registration, route-transition commit, and cleanup.
- TypeScript, ESLint, Prettier, documentation links, and static security contract are release gates.
- Fault injection recovered a killed Harness in nine seconds. Killing the renderer rebuilt the window while preserving the Electron main and Harness PIDs.
- The 0.2.0 Universal package was mounted and signature-checked; 49 Mach-O files passed Universal/architecture-qualified inspection.
- A real Electron run verified the grouped preload API, text input and full selection, Standard workspace creation after the compaction-peer repair, permission-menu persistence, localized General settings, official Harness Button/Menu rendering with no raw select/checkbox, close-preference persistence, and `Control+V` paste into the official password field without reading a credential.
- An idle five-second performance sample recorded zero layouts, 1.631 ms total task time, and a 456-byte JS-heap delta. The plugin no longer uses `offsetWidth` or an always-running animation.

Detailed evidence and unexecuted external checks are in the [acceptance report](./acceptance-report.md).
