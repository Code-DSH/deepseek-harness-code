# Agent Context Router

## Header

- schema_version: 3
- single_entry: true
- repository_root: `/Users/trip/TRUE 开发/deepseek/deepseek-harness-desktop`
- updated_at: `2026-08-16T20:36:00+08:00`
- default_freshness: 10d
- docs_entry: [docs/index.md](./docs/index.md)
- project_entry: [docs/project/index.md](./docs/project/index.md)
- intent_entry: [docs/project/intent.md](./docs/project/intent.md)
- knowledge_entry: [docs/knowledge/index.md](./docs/knowledge/index.md)
- plans_entry: [docs/plans/index.md](./docs/plans/index.md)

## Current Project Snapshot

- Goal: ship DeepSeek Harness Code with a cross-platform Electron shell, official-format integrated plugins, an immutable DSH Routing Suite, an optional progressive Anchored Standard Agent Preset, native Harness conversation rendering, and an independent watchdog.
- Current phase: release `0.3.3` packages the complete six-plugin Web set plus managed Skills/presets; the Universal DMG and mounted-artifact verification are complete and PR publication is the remaining release step.
- Primary constraints: macOS Universal local release plus native Windows/Linux CI, no global Node dependency at runtime, loopback-only Harness, unsigned macOS distribution with ad-hoc signing.
- Active branch/worktree: `release/0.3.3-integrated-plugins` in `.worktrees/release-routing-suite`; the earlier plugin snapshot remains at `archive/desktop-plugin-before-app-merge-20260816`.
- Build/test entry: `pnpm test`; release entry: `pnpm dist:mac` then `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg --universal`.
- Current critical risk: the local macOS artifact is ad-hoc signed and not notarized; plugin snapshots update only with reviewed app releases, while user data and unrelated plugins remain outside the application and are never cleared by reinstall.

## User Intent Status

- status: confirmed
- confirmed_at: `2026-08-15T00:00:00+08:00`
- summary: Deliver DeepSeek Harness Code plus a checksum-pinned DSH Routing Suite and optional `anchored-standard` Agent Preset, preserve Standard and official conversation rendering, fix long-stream projection cost, and produce a verified Universal release.
- scope: desktop host, lifecycle recovery, plugin UI, DSH Routing Suite, progressive Agent Preset, managed installation, integrated packaging, performance, branding, verification.
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

| Technology        | Project version | Purpose                   | Status | Verified   | Details                                                    |
| ----------------- | --------------- | ------------------------- | ------ | ---------- | ---------------------------------------------------------- |
| Electron          | 43.4.0          | Desktop Chromium host     | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| DeepSeek Harness  | 0.1.0-rc.6      | Web app and agent runtime | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| electron-builder  | 26.15.3         | App and DMG packaging     | active | 2026-08-15 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| esbuild           | 0.25.12         | Offline plugin bundling   | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |
| DSH Routing Suite | pinned snapshot | Routing bundles/presets   | active | 2026-08-16 | [Upstream baseline](./docs/knowledge/upstream-baseline.md) |

## Knowledge Topic Index

| Topic             | Summary                                                                                    | Status  | Last verified | Revalidate after | Canonical document                            |
| ----------------- | ------------------------------------------------------------------------------------------ | ------- | ------------- | ---------------- | --------------------------------------------- |
| Upstream baseline | Harness, packaging, Routing Suite, preset, and renderer dependency baseline                | current | 2026-08-16    | 2026-08-17       | [Open](./docs/knowledge/upstream-baseline.md) |
| Anchored Standard | Pinned community preset, rc.6 integration contract, local patches, and experiment boundary | current | 2026-08-16    | 2026-08-26       | [Open](./docs/knowledge/anchored-standard.md) |

## Active Plans

| Plan                            | Status     | Current milestone                                      | Updated    | Link                                                                                |
| ------------------------------- | ---------- | ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------- |
| Integrated Plugin Release 0.3.3 | active     | Verified Universal DMG ready; publishing release PR    | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-integrated-plugin-release.md)            |
| Official Harness installation   | active     | Final package closure and documentation gates          | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-official-harness-install.md)             |
| DSH Routing Suite 0.3.0 release | complete   | Verified Universal DMG ready for user installation     | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-routing-suite-release.md)                |
| Merge, release, and install     | superseded | Replaced by the 0.3.0 all-branch release plan          | 2026-08-16 | [Historical](./docs/plans/active/merge-all-branches-release-install.md)             |
| DeepSeek Harness Code 0.2.0     | complete   | Superseded by the verified 0.3.0 artifact              | 2026-08-16 | [Historical](./docs/plans/active/deepseek-harness-desktop.md)                       |
| Streaming output animation      | retired    | Reverted to the official renderer after visual defects | 2026-08-16 | [Historical record](./docs/superpowers/plans/2026-08-16-stream-output-animation.md) |
| Harness Web stream performance  | complete   | Exact-version rc.6 patch and regression gates verified | 2026-08-16 | [Open](./docs/superpowers/plans/2026-08-16-harness-web-performance.md)              |

## Known Risks and Open Questions

| Item                                        | Impact                                                                      | Evidence                                                                              | Next action                                                                    | Link                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Exposed provider key must be rotated        | Blocks safe live-provider soak                                              | Key appeared in chat and was not used or stored                                       | User rotates it and enters the replacement only through official settings      | [Testing](./docs/engineering/testing.md)                   |
| V4 Pro capability improvement is unverified | Mechanism can ship without proving the reported 98/99 score band            | No replacement credentials were entered and the community score is benchmark-specific | Run at least 10 paired Standard/Anchored trials when credentials are available | [Anchored Standard](./docs/knowledge/anchored-standard.md) |
| Preset ID conflict                          | A user-authored `anchored-standard` directory prevents managed installation | Installer deliberately refuses to overwrite unknown or modified content               | Show a bounded conflict notice; Standard remains available                     | [Architecture](./docs/architecture/overview.md)            |
| Pinned conversation patch                   | An rc.6 upgrade can invalidate the turn-tail optimization                   | pnpm patch is guarded by exact package version and lockfile hash                      | Remove/rebase the patch only with the 10,000-delta regression green            | [Upstream](./docs/knowledge/upstream-baseline.md)          |
| Pinned Routing Suite archives               | Upstream releases require an explicit reviewed app update                   | Build rejects digest drift before extraction and runtime auto-update is absent        | Re-audit versions, commits, licenses, and SHA-256 values before changing pins  | [Upstream](./docs/knowledge/upstream-baseline.md)          |

## Mandatory Rules

- Keep this file as the repository's only `AGENTS.md`; never create `agent.md` or nested variants.
- Preserve the official Harness question protocol; do not create a parallel question database or wire format.
- Do not log credentials, authorization headers, cookies, prompt bodies, or response bodies.
- Use test-first changes for runtime behavior and verify before claiming completion.
- Keep detailed facts in `docs/`; this file remains a short router.

## Update Log

Detailed append-only records belong under `docs/knowledge/changelog/` when needed.
