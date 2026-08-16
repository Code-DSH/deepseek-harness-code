# Agent Context Router

## Header

- schema_version: 3
- single_entry: true
- repository_root: `/Users/trip/TRUE 开发/deepseek/deepseek-harness-desktop`
- updated_at: `2026-08-16T19:17:07+08:00`
- default_freshness: 10d
- docs_entry: [docs/index.md](./docs/index.md)
- project_entry: [docs/project/index.md](./docs/project/index.md)
- intent_entry: [docs/project/intent.md](./docs/project/intent.md)
- knowledge_entry: [docs/knowledge/index.md](./docs/knowledge/index.md)
- plans_entry: [docs/plans/index.md](./docs/plans/index.md)

## Current Project Snapshot

- Goal: ship DeepSeek Harness Code with a cross-platform Electron shell, official-format integrated plugins, a bundled offline DSH Routing Suite, the Superpowers 6.2.0 skill collection, an optional progressive Anchored Standard Agent Preset, native-status ThinkingOrb feedback, and an independent watchdog.
- Current phase: `feat/routing-suite` source integration is committed and unit/integration gates are green; the browser layer and a clean package rebuild are being aligned before a final release claim.
- Primary constraints: macOS Universal local release plus native Windows/Linux CI, no global Node dependency at runtime, loopback-only Harness, unsigned macOS distribution with ad-hoc signing.
- Active branch/worktree: primary worktree is `feat/routing-suite`; related worktrees retain `feat/anchored-standard-progressive`, `fix/harness-web-performance`, and `feat/official-harness-install`.
- Build/test entry: `npm exec --yes --package=pnpm@11.19.0 -- pnpm test`.
- Current critical risk: the committed browser gate still contains three legacy stream-output-animation tests that target the removed `installStreamOutputEffects` hook, so `pnpm test` is not fully green until those tests are repaired; V4 Pro quality gain also remains unverified without user-entered credentials.

## User Intent Status

- status: confirmed
- confirmed_at: `2026-08-15T00:00:00+08:00`
- summary: Deliver DeepSeek Harness Code plus the auto-assembled DSH Routing Suite, bundled Superpowers skills, and an optional `anchored-standard` Agent Preset. The preset starts each session with the Minimal tool pair, then progressively exposes resident discovery and explicitly unlocked tools without changing the Standard default.
- scope: desktop host, lifecycle recovery, plugin UI, DSH Routing Suite, bundled Skills, progressive Agent Preset, managed installation, integrated packaging, performance, branding, verification.
- non_goals: auto-update, Apple notarization, cross-device warm state, reasoning-text capture/replay, private-wire mutation, or benchmark guarantees.
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

| Technology         | Project version | Purpose                     | Status | Verified   | Details                                                    |
| ------------------ | --------------- | --------------------------- | ------ | ---------- | ---------------------------------------------------------- |
| Electron           | 43.4.0          | Desktop Chromium host       | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| DeepSeek Harness   | 0.1.0-rc.6      | Web app and agent runtime   | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| electron-builder   | 26.15.3         | App and DMG packaging       | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| thinking-orbs      | 0.3.1           | Native running-status Orb   | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| esbuild            | 0.25.12         | Offline plugin bundling     | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| DSH Routing Suite  | pinned snapshot | Routing bundles and presets | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| Superpowers Skills | 6.2.0           | Bundled skill collection    | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |

## Knowledge Topic Index

| Topic             | Summary                                                                                    | Status  | Last verified | Revalidate after | Canonical document                            |
| ----------------- | ------------------------------------------------------------------------------------------ | ------- | ------------- | ---------------- | --------------------------------------------- |
| Upstream baseline | Harness, packaging, Routing Suite, Skills, preset, and Orb dependency baseline             | current | 2026-08-16    | 2026-08-17       | [Open](./docs/knowledge/upstream-baseline.md) |
| Anchored Standard | Pinned community preset, rc.6 integration contract, local patches, and experiment boundary | current | 2026-08-16    | 2026-08-26       | [Open](./docs/knowledge/anchored-standard.md) |

## Active Plans

| Plan                        | Status     | Current milestone                                                      | Updated    | Link                                                                         |
| --------------------------- | ---------- | ---------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| Merge, release, and install | active     | Branch integration and clean release verification                      | 2026-08-16 | [Open](./docs/plans/active/merge-all-branches-release-install.md)            |
| DeepSeek Harness Code 0.2.0 | active     | Final Universal packaging and acceptance                               | 2026-08-16 | [Open](./docs/plans/active/deepseek-harness-desktop.md)                      |
| Bundled preset localization | complete   | Bilingual names/descriptions for all three managed presets             | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-localize-agent-presets.md)        |
| Streaming output animation  | superseded | Text dissolve removed; the localized native-status ThinkingOrb remains | 2026-08-16 | [Historical](./docs/superpowers/plans/2026-08-16-stream-output-animation.md) |

## Known Risks and Open Questions

| Item                                        | Impact                                                                           | Evidence                                                                              | Next action                                                                           | Link                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Exposed provider key must be rotated        | Blocks safe live-provider soak                                                   | Key appeared in chat and was not used or stored                                       | User rotates it and enters the replacement only through official settings             | [Testing](./docs/engineering/testing.md)                   |
| V4 Pro capability improvement is unverified | Mechanism can ship without proving the reported 98/99 score band                 | No replacement credentials were entered and the community score is benchmark-specific | Run at least 10 paired Standard/Anchored trials when credentials are available        | [Anchored Standard](./docs/knowledge/anchored-standard.md) |
| Preset ID conflict                          | A user-authored `anchored-standard` directory prevents managed installation      | Installer deliberately refuses to overwrite unknown or modified content               | Show a bounded conflict notice; Standard remains available                            | [Architecture](./docs/architecture/overview.md)            |
| Routing preset refresh follows mutable main | A background refresh can install unreviewed upstream router-preset changes       | `routing-suite-update.ts` fetches `dsh-router-standard/main` once per day at most     | Replace the mutable-main refresh with reviewed pinned updates before a public release | [Upstream](./docs/knowledge/upstream-baseline.md)          |
| Legacy browser tests are stale              | `pnpm test` is not fully green and acceptance claims must stay qualified         | 3 Playwright tests still call the removed `installStreamOutputEffects` hook           | Repair or remove the three legacy stream-animation tests, then rerun `pnpm test`      | [Testing](./docs/engineering/testing.md)                   |
| Nested worktree outputs pollute lint        | A clean repository-wide `pnpm lint` claim is not reproducible from this worktree | ESLint reports generated `dist/` and vendored files under `.worktrees/*`              | Scope lint to owned sources or remove worktree outputs before the release gate        | [Testing](./docs/engineering/testing.md)                   |

## Mandatory Rules

- Keep this file as the repository's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve the official Harness question protocol; do not create a parallel question database or wire format.
- Do not log credentials, authorization headers, cookies, prompt bodies, or response bodies.
- Use test-first changes for runtime behavior and verify before claiming completion.
- Keep detailed facts in `docs/`; this file remains a short router.

## Update Log

Detailed append-only records belong under `docs/knowledge/changelog/` when needed.
