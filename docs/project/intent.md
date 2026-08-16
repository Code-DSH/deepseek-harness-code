---
id: project.intent
title: DeepSeek Harness Code Intent
summary: Confirmed scope and acceptance baseline for the desktop app, immutable DSH Routing Suite, and optional progressive Anchored Standard Agent Preset.
kind: product
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, routing-suite, watchdog, packaging]
triggers: [scope, acceptance, product intent]
read_when: [starting or changing implementation]
skip_when: [performing an isolated test with unchanged scope]
priority: must
freshness_class: project
last_verified: 2026-08-16T17:35:00+08:00
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

Deliver an all-in-one, modernized DeepSeek Harness Code desktop distribution that embeds the complete official Harness Web experience, plugin and Skills foundation, agent tools, a two-capability Electron host bridge, and an independent watchdog. V4 Pro is one improved capability within this wider Harness modernization, not the product's center.

## Required Deliverables

- `DeepSeek Harness Code.app` and DMG for x64 and arm64 as one verified Universal artifact.
- Native Windows NSIS and Linux AppImage/deb build definitions with platform-native CI production.
- Chromium UI, Harness, Node runtime, plugin, and watchdog inside the app bundle.
- Safe close behavior, menu recovery, health checks, crash recovery, log rotation, and official session restoration.
- Official question UI/protocol compatibility across macOS, Linux, and Windows Web environments.
- System light/dark monochrome startup UI with one centered spinner, underlay title bar, real tray, page transitions without forced layout, official-component desktop settings integration, tests, operations guidance, and an accessible SVG system diagram.
- Integrated desktop Web bundle plus the optional `anchored-standard` Agent Preset in every installer. Standard remains the official default.
- Integrated DSH Routing Suite injector, mode boost, and router presets as a checksum-pinned offline app resource with ownership-safe startup assembly and no runtime code updater.
- First-class official V4 Pro/Flash model selection and reasoning controls, with the literal `We need` intent trigger tracked as the next public-seam implementation requirement.
- One packaged Harness toolchain covering Skills, tools, Goal, Plan, Workflow, Todo, Jobs, user questions/approval, and subagents.

## Non-goals

- Apple notarization or claims of an official DeepSeek release.
- Automatic updates in the first community release.
- Replaying, logging, or matching hidden reasoning text such as `we need`.
- One-time or cross-device model warm state, private-wire request mutation, and immediate full-catalog reinjection.
- Guarantees about benchmark scores or hidden chain-of-thought wording.
- Representing the literal `We need` trigger as shipped before its public per-request implementation and tests exist.
- A second session store or a replacement user-question protocol.

## Constraints

- App and product display name `DeepSeek Harness Code`; package name `deepseek-harness-code`; startup-recovery release version `0.3.1` with the checksum-pinned Routing Suite retained.
- Baseline versions: `@deepseek-ai/dsh@0.1.0-rc.6`, Electron `43.4.0`, electron-builder `26.15.3`, Node build baseline `24.18.0`, pnpm `11.19.0`.
- macOS 12-27 x64/arm64, Windows and Linux x64 native CI; fail closed rather than mislabel an architecture.
- Harness binds only to `127.0.0.1`; user data remains outside `.app`.
- No credential collection or logging by the desktop layer.
- `anchored-standard` starts a new top-level session with exactly `bash` and `str_replace_editor`, promotes on the first durable tool call or assistant message, and then keeps only resident discovery plus explicitly unlocked tools.
- Invalid preset configuration or missing required tools fails that selected preset; it never silently expands to Standard. Standard sessions stay operational.
- Routing archives must match reviewed exact SHA-256 values before extraction; missing or conflicting optional routing resources must not block Standard startup or overwrite user-owned presets.

## Acceptance

Code, tests, package artifacts, signatures, architecture SVG, installation guide, runtime evidence, and project documentation must agree. Live DeepSeek validation uses credentials entered by the user in Harness settings; lack of credentials may block only that external-provider observation, not mock and fault-injection validation.

## Confirmed Assumptions

Architecture A remains approved. The user explicitly approved the progressive preset plan. rc.6 session hooks (`system-prompt/assemble`, `session/event`, and `agent/pre-step`) can shape the visible tool schema within one preset without using `AgentPresets.recompose()` or private request interception. The implementation does not treat historical reasoning as transferable model state and does not promise the community benchmark score.

## Related Documents

- Parent: [Project index](./index.md)
- Next: [Architecture](../architecture/overview.md)
- Plan: [Active implementation plan](../superpowers/plans/2026-08-16-deepseek-harness-code.md)
