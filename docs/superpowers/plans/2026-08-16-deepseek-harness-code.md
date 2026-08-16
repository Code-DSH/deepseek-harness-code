---
id: plan.deepseek-harness-code
title: DeepSeek Harness Code Implementation Plan
summary: Test-first execution plan for the renamed cross-platform integrated release and UI/runtime repairs.
kind: plan
status: canonical
content_stage: implementation-backed
scope: [desktop, plugin, anchored-standard, packaging, validation]
triggers: [implementation, resume, DeepSeek Harness Code]
read_when: [executing or reviewing this scope]
skip_when: [unrelated documentation]
priority: must
freshness_class: project
last_verified: 2026-08-16T13:06:11+08:00
owners: [primary-agent]
source_of_truth: [../../../apps, ../../../packages, ../../../tests]
related:
  prerequisites: [../specs/2026-08-16-deepseek-harness-code-design.md]
  next: [../../engineering/testing.md]
supersedes: []
tags: [execplan, tdd]
---

# DeepSeek Harness Code Implementation Plan

## Goal

Ship a self-contained DeepSeek Harness Code desktop release that repairs the currently unusable renderer path, implements the requested loading/title-bar/settings experience, bundles the experimental anchored tool plugin, and has reproducible macOS/Windows/Linux packaging definitions.

## Read Set

- [Confirmed intent](../../project/intent.md) — original boundary and new user-authorized scope.
- [Design](../specs/2026-08-16-deepseek-harness-code-design.md) — chosen architecture and security boundaries.
- [Lifecycle](../../architecture/lifecycle.md) — process recovery and close behavior.
- [Testing](../../engineering/testing.md) — required verification layers.
- Pinned Harness rc.6 package source — preset composition and supported Cordis/session hooks.

## Milestones

1. Reproduce and lock failures: sandbox preload unresolved dependency; Standard preset missing workflow dependency; workspace selection fallback.
2. Repair host path: self-contained preload, dependency closure, two validated APIs, tray, platform title-bar configuration, migration-safe product rename.
3. Repair Web experience: monochrome system-matched loading spinner, top-edge layout, official-component General settings, route transition performance, copy/input/workspace regression tests.
4. Add `dsh-anchored-standard` as an optional Agent Preset: Minimal-pair bootstrap, event-derived progressive discovery, strict failure, managed lifecycle, and no desktop preference toggle. Standard remains default.
5. Brand and package: composed icon, integrated plugins, macOS Universal DMG, Windows NSIS, Linux AppImage/deb/CI definitions, unsigned install guide.
6. Verify and clean: unit/plugin/integration/E2E/security/package tests, performance trace, Computer Use, secret scan, obsolete installed app moved to Trash, GitHub repository creation and push.

## Risks and rollback

- Harness upgrades can change preset assembly hooks. Keep rc.6 pinned, rerun request-schema/event/package compatibility tests before upgrading, and leave Standard independent.
- Cross-platform native artifacts may require OS-native CI. Commit deterministic configurations and a build matrix; do not label unbuilt artifacts as delivered.
- Rename must not orphan existing sessions. Keep a documented legacy user-data migration and verify before removing the old installed app.
- The exposed key is considered compromised and excluded from all execution. Live provider acceptance requires a newly rotated key entered by the user through official settings.

## Progress

- 2026-08-16 — Reproduced workspace selection flashback and disabled composer.
- 2026-08-16 — Captured sandbox preload failure (`zod` left external) and Standard preset mount failure (missing workflow dependency) through Chromium diagnostics.
- 2026-08-16 — Chose the two-capability bridge and safe experimental promotion design under the user's autonomous-decision instruction.
- 2026-08-16 — Implemented the grouped preload bridge, native tray/menu lifecycle, monochrome system-matched startup spinner, title-bar safe inset, and official General settings integration.
- 2026-08-16 — Fixed the packaged preload dependency closure, missing Standard workflow peer, Cordis client injection, route-transition forced layout, and close-time observer failure with regression coverage.
- 2026-08-16 — Built both official-format plugins and the Code-branded macOS/Windows/Linux package definitions. Final artifact verification and repository publication remain release gates.
- 2026-08-16 — Restored native Edit commands and added a macOS `Control+V` fixed-channel fallback; the installed App pasted a non-secret placeholder into the official password field and then cleared it.
- 2026-08-16 — Final Universal DMG passed ad-hoc signature, quarantine, and 49-file architecture inspection; the obsolete 0.1.0 application was moved to Trash and 0.2.0 installed.
- 2026-08-16 — Rejected synthetic Control+V before clipboard IPC, made the anchored setting conditionally update the profile and restart Harness, replaced the generic tray glyph with official brand assets, and moved the product mark closer to the Code wordmark. Final artifact rebuild is in progress.
- 2026-08-16 — Added the missing compaction/invariants peers, proved Standard workspace switching and session restoration in the real Electron renderer, migrated every visible plugin control to official Harness primitives, verified Chinese/English locale switching and dropdown alignment, and added a mandatory runtime-closure preflight. The repository will be public after secret scanning.
- 2026-08-16 — Secret scanning found no credential patterns; created the public `Open-Less/deepseek-harness-code` repository and prepared the initial `main` branch publication.
- 2026-08-16 — Superseded the safe-fallback bundle with the audited community Agent Preset at commit `db4527a2...`; implemented atomic managed installation, progressive tool phases, official rc.6 roster/session creation, packaging provenance, and strict conflict/failure behavior. Live V4 Pro quality gain remains unverified.

## Completion

All behavior is implementation-backed, the package dependency closure passes, macOS artifact is locally verified, cross-platform definitions/CI are validated as far as the host permits, no secret is present, docs/SVG match code, and the GitHub repository exists under the authorized organization.
