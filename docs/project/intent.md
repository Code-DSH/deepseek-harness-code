---
id: project.intent
title: DeepSeek Harness Code Intent
summary: Confirmed scope and acceptance baseline for the desktop app, official single Harness Home, public plugin installation flow, immutable DSH Routing Suite, and progressive Agent Presets.
kind: product
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, routing-suite, watchdog, packaging]
triggers: [scope, acceptance, product intent]
read_when: [starting or changing implementation]
skip_when: [performing an isolated test with unchanged scope]
priority: must
freshness_class: project
last_verified: 2026-08-20T00:00:00+08:00
owners: [project]
source_of_truth: [user-approved implementation plan]
related:
  prerequisites: []
  next:
    [
      ../architecture/overview.md,
      ../superpowers/plans/2026-08-16-deepseek-harness-code.md,
    ]
supersedes: []
tags: [intent, confirmed]
---

# DeepSeek Harness Code Intent

## Goal

Deliver an all-in-one coding desktop distribution around the Code-DSH maintained Harness family while preserving public DSH protocols, shared Home semantics, and provider boundaries. The desktop owns packaging, lifecycle, plugins, and verification; core DSH changes belong in the maintained submodule.

## Required Deliverables

- `DeepSeek Harness Code.app` and DMG for x64 and arm64 as one verified Universal artifact (`deepseek-harness-code@0.1.0-BETA2-1`), plus architecture-specific Windows/Linux installers and a verified update manifest.
- Native Windows NSIS and Linux AppImage/deb build definitions with platform-native CI production.
- Chromium UI, complete maintained DSH family `0.1.1-rc.2.code.1`, integrated plugins, and watchdog inside the app bundle, running on supported system Node.
- Safe close behavior, menu recovery, health checks, crash recovery, log rotation, and official session restoration.
- Official question UI/protocol compatibility across macOS, Linux, and Windows Web environments.
- System light/dark monochrome startup UI with one centered spinner, underlay title bar, real tray, page transitions without forced layout, official-component desktop settings integration, tests, operations guidance, and an accessible SVG system diagram.
- Integrated desktop Web bundle plus the optional `anchored-standard` Agent Preset in every installer. Standard remains the official default.
- Integrated DSH Routing Suite injector `0.3.3`, mode boost `0.1.0`, and router presets `0.2.0` (`eff787e`) as a checksum-pinned offline app resource with ownership-safe startup assembly and no runtime code updater (SHA-256: `355238fa...391f48`, `72836d64...ca12b`, `a8f3616f...126676`).
- First-class official V4 Pro/Flash model selection and reasoning controls, with the literal `We need` intent trigger tracked as the next public-seam implementation requirement.
- One packaged Harness toolchain covering Skills (Superpowers 6.2.0 + Coding Mode), tools, Goal, Plan, Workflow, Todo, Jobs, user questions/approval, and subagents.
- One shared DSH Home resolved by the maintained `@deepseek-ai/dsh-home-paths` package: `DSH_HOME` when set, otherwise `~/.dsh`, with copy-only migration from the retired app-specific Home.
- Public `dsh plugin --profile web add` reconciliation for bundled Web plugins through system Node `^22.19.0 || >=24.0.0` and bundled pnpm; Node 23 is unsupported.
- Global Agent Operating Protocol (`AGENTS.md`) remains ownership-safe; the application never installs or modifies a global `dsh` CLI.

## Non-goals

- Apple notarization or claims of an official DeepSeek release.
- Silent or background-forced application replacement; updates must remain user-confirmed after manifest and checksum verification.
- Replaying, logging, or matching hidden reasoning text such as `we need`.
- One-time or cross-device model warm state, private-wire request mutation, and immediate full-catalog reinjection.
- Guarantees about benchmark scores or hidden chain-of-thought wording.
- Representing the literal `We need` trigger as shipped before its public per-request implementation and tests exist.
- A second session store or a replacement user-question protocol.

## Constraints

- App and product display name `DeepSeek Harness Code`; package name `deepseek-harness-code`; integration release `0.1.0-BETA2-1` (successor to `0.1.0-BETA2`, `0.1.0-BETA1`, and the `0.3.3` integrated-plugin snapshot) with the checksum-pinned Routing Suite retained.
- Baseline versions: maintained DSH family `0.1.1-rc.2.code.1`, Electron `43.4.0`, electron-builder `26.15.3`, Node `^22.19.0 || >=24.0.0`, pnpm `11.19.0`, and `dsh-find-plugin@0.3.6`.
- macOS 12-27 x64/arm64, Windows and Linux x64 native CI; fail closed rather than mislabel an architecture.
- Harness binds only to `127.0.0.1`; user data remains outside `.app`.
- Existing Harness data and unrelated plugins are preserved; migration never deletes the legacy Home or overwrites target conflicts.
- No credential collection or logging by the desktop layer.
- `anchored-standard` starts a new top-level session with exactly `bash` and `str_replace_editor`, promotes on the first durable tool call or assistant message, and then keeps only resident discovery plus explicitly unlocked tools.
- Invalid preset configuration or missing required tools fails that selected preset; it never silently expands to Standard. Standard sessions stay operational.
- Routing archives must match reviewed exact SHA-256 values before extraction; missing or conflicting optional routing resources must not block Standard startup or overwrite user-owned presets. No runtime routing updater.

## Acceptance

Code, tests, package artifacts, signatures, architecture SVG, installation guide, runtime evidence, and project documentation must agree. Live DeepSeek validation uses credentials entered by the user in Harness settings; lack of credentials may block only that external-provider observation, not mock and fault-injection validation.

## Confirmed Assumptions

Architecture A remains approved. The user explicitly approved the progressive preset plan. 0.1.1-rc.2 session hooks (`system-prompt/assemble`, `session/event`, and `agent/pre-step`) can shape the visible tool schema within one preset without using `AgentPresets.recompose()` or private request interception. The implementation does not treat historical reasoning as transferable model state and does not promise the community benchmark score.

On 2026-08-16 the user additionally confirmed architecture A for official installation: embed the Harness and pnpm runtimes in the desktop application, reconcile bundled plugins through the public CLI on first launch, use the official single Home, and preserve all existing data and unrelated plugins.

On 2026-08-17 the user redirected the Node.js strategy: the app must use the system-installed official Node.js on macOS, Windows, and Linux instead of downloading a portable runtime, auto-detecting common install locations (including GUI launches whose PATH excludes them) and accepting any version >=22.13. The first-launch download flow, its dialogs, and the nodejs.org archive pinning were removed accordingly.

The same day, the user confirmed that every plugin currently installed in the local Harness Web profile must ship in the integrated installer. The release freezes only public plugin code and package metadata; credentials, sessions, settings, logs, prompts, and private profile state remain outside the application.

On 2026-08-20 the project advanced to `0.1.0-BETA2` / `0.1.0-rc.8`: 8 integrated plugins (including vision-router, ui-polish, updater-check, better-sidebar service, prompt-principles, code-brand), immutable routing snapshot, and system-Node auto-detection became baseline. BETA3 subsequently upgrades that baseline to Harness `0.1.1-rc.2`; prior `0.3.x` versioning remains archived.

On 2026-08-20 the project advances to `0.1.0-BETA2-1`: the persistent Bash PTY prompt patch is carried through the packaged runtime, and the existing updater gains user-confirmed download, SHA-256 verification, platform replacement, and restart with architecture-aware release assets.

## Related Documents

- Parent: [Project index](./index.md)
- Next: [Architecture](../architecture/overview.md)
- Plan: [Active implementation plan](../superpowers/plans/2026-08-16-deepseek-harness-code.md)
