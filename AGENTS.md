# Agent Context Router

## Header

- schema_version: 3
- single_entry: true
- repository_root: `/Users/trip/TRUE 开发/deepseek/deepseek-harness-desktop`
- updated_at: `2026-08-16T13:20:00+08:00`
- default_freshness: 10d
- docs_entry: [docs/index.md](./docs/index.md)
- project_entry: [docs/project/index.md](./docs/project/index.md)
- intent_entry: [docs/project/intent.md](./docs/project/intent.md)
- knowledge_entry: [docs/knowledge/index.md](./docs/knowledge/index.md)
- plans_entry: [docs/plans/index.md](./docs/plans/index.md)

## Current Project Snapshot

- Goal: ship DeepSeek Harness Code with a cross-platform Electron shell, official-format integrated plugins, and independent watchdog.
- Current phase: implementing the approved streaming-output dissolve and active ThinkingOrb behavior in the official desktop plugin.
- Primary constraints: macOS Universal local release plus native Windows/Linux CI, no global Node dependency at runtime, loopback-only Harness, unsigned macOS distribution with ad-hoc signing.
- Active branch/worktree: `main` in this standalone repository, published at `Open-Less/deepseek-harness-code`.
- Build/test entry: `npm exec --yes --package=pnpm@11.19.0 -- pnpm test`.
- Current critical risk: rc.6 does not safely permit post-tool preset recomposition; anchored mode must remain a visible Standard fallback when enabled.

## User Intent Status

- status: confirmed
- confirmed_at: `2026-08-15T00:00:00+08:00`
- summary: Deliver the renamed DeepSeek Harness Code desktop application with repaired input/workspace behavior, system light/dark monochrome startup UI, a two-capability settings plugin built from official Harness primitives, tray/close behavior, integrated plugins, macOS Universal DMG, and Windows/Linux native packaging definitions.
- scope: desktop host, lifecycle recovery, plugin UI, integrated packaging, performance, branding, verification.
- non_goals: auto-update, Apple notarization, private-wire tool mutation, claims of controlling hidden chain-of-thought.
- acceptance: [Project intent](./docs/project/intent.md)

## Documentation Route Index

| Domain       | Read when                                                 | Entry                                        | Status |
| ------------ | --------------------------------------------------------- | -------------------------------------------- | ------ |
| Project      | Goal, scope, status, or acceptance changes                | [Project](./docs/project/index.md)           | active |
| Architecture | Process boundaries, IPC, or lifecycle changes             | [Architecture](./docs/architecture/index.md) | active |
| Engineering  | Tests, dependencies, or build conventions change          | [Engineering](./docs/engineering/index.md)   | active |
| Operations   | Packaging, installation, diagnostics, or recovery changes | [Operations](./docs/operations/index.md)     | active |
| Plans        | Multi-stage implementation work                           | [Plans](./docs/plans/index.md)               | active |
| Knowledge    | Upstream versions and official behavior                   | [Knowledge](./docs/knowledge/index.md)       | active |

## Technology Stack Index

| Technology       | Project version | Purpose                   | Status | Verified   | Details                                                    |
| ---------------- | --------------- | ------------------------- | ------ | ---------- | ---------------------------------------------------------- |
| Electron         | 43.4.0          | Desktop Chromium host     | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| DeepSeek Harness | 0.1.0-rc.6      | Web app and agent runtime | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| electron-builder | 26.15.3         | App and DMG packaging     | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |

## Knowledge Topic Index

| Topic             | Summary                                         | Status  | Last verified | Revalidate after | Canonical document                            |
| ----------------- | ----------------------------------------------- | ------- | ------------- | ---------------- | --------------------------------------------- |
| Upstream baseline | Official Harness and packaging version baseline | current | 2026-08-15    | 2026-08-16       | [Open](./docs/knowledge/upstream-baseline.md) |

## Active Plans

| Plan                        | Status | Current milestone                        | Updated    | Link                                                                   |
| --------------------------- | ------ | ---------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Streaming output animation  | active | Offline client bundle and TDD model      | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-stream-output-animation.md) |
| DeepSeek Harness Code 0.2.0 | active | Native CI and final release verification | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-deepseek-harness-code.md)   |

## Known Risks and Open Questions

| Item                                         | Impact                                                           | Evidence                                                                  | Next action                                                               | Link                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Exposed provider key must be rotated         | Blocks safe live-provider soak                                   | Key appeared in chat and was not used or stored                           | User rotates it and enters the replacement only through official settings | [Testing](./docs/engineering/testing.md)                                      |
| Dynamic anchored promotion is unsafe on rc.6 | Experimental mode cannot change a live catalog after a tool call | Public `AgentPresets.recompose` requires an agent with no produced output | Fail closed to Standard and show the limitation in General settings       | [Design](./docs/superpowers/specs/2026-08-16-deepseek-harness-code-design.md) |

## Mandatory Rules

- Keep this file as the repository's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve the official Harness question protocol; do not create a parallel question database or wire format.
- Do not log credentials, authorization headers, cookies, prompt bodies, or response bodies.
- Use test-first changes for runtime behavior and verify before claiming completion.
- Keep detailed facts in `docs/`; this file remains a short router.

## Update Log

Detailed append-only records belong under `docs/knowledge/changelog/` when needed.
