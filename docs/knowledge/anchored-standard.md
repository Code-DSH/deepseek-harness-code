---
id: knowledge.anchored-standard
title: Anchored Standard Progressive Preset
summary: Pinned community Agent Preset whose first request uses the Minimal tool pair and whose later requests use resident discovery plus explicit unlocks.
kind: knowledge
status: canonical
content_stage: implementation-backed
scope: [agent-preset, harness, packaging, experiment]
triggers: [anchored standard, progressive tools, V4 Pro, schema surface]
read_when:
  [
    changing the preset,
    Harness version,
    package lifecycle,
    or capability claims,
  ]
skip_when: [editing unrelated desktop styling]
priority: must
freshness_class: normal
last_verified: 2026-08-16T13:06:11+08:00
revalidate_after: 2026-08-26T13:06:11+08:00
owners: [project]
source_of_truth:
  - ../../packages/anchored-standard-plugin/UPSTREAM.json
  - ../../packages/anchored-standard-plugin/LOCAL-PATCHES.md
  - https://github.com/xiaobright/dsh-anchored-standard
related:
  prerequisites: [./upstream-baseline.md]
  next: [../architecture/overview.md, ../engineering/testing.md]
supersedes: []
tags: [research, agent-preset, progressive-discovery]
---

# Anchored Standard Progressive Preset

## Current conclusion

The mechanism is feasible on pinned `@deepseek-ai/dsh@0.1.0-rc.6` as a per-session Agent Preset. It does not export a warmed model state and does not inspect or replay reasoning text. The useful state is durable Harness session history: the first request is assembled with a two-tool schema, and subsequent schemas are derived from persisted events.

## Pinned source and local integration

- Upstream: [`xiaobright/dsh-anchored-standard`](https://github.com/xiaobright/dsh-anchored-standard), commit `db4527a2a70a9032d3a8525ce3c0ea6ef528d6fc`, MIT.
- Bundled package: `packages/anchored-standard-plugin` version `0.2.0`.
- Local patches are limited to the truthful **Anchored Standard (Progressive)** display copy, rc.6 packaging/lifecycle integration, and strict failure when a phase-required tool is absent.
- Installer provenance includes `LICENSE`, `NOTICE`, `UPSTREAM.json`, `LOCAL-PATCHES.md`, package version, and an app-managed SHA-256 marker.

## Runtime contract

1. A new top-level session exposes only `bash` and `str_replace_editor`, keeps the Minimal persona, and removes automatic workspace-instruction and skill-catalog messages from that request.
2. The first persisted `tool/call` or `assistant/message` promotes the current compaction epoch.
3. Promoted requests expose the two bootstrap tools plus `dev_tool_search`, `skill_search`, and `skill_load`. Other Standard capabilities require an explicit `dev_tool_search` unlock and are reconstructed from durable events after resume.
4. A `compaction/end` boundary returns to a controlled bootstrap-plus-work set until a new durable signal. Subagents start in the resident phase.
5. Missing required tools or an invalid composition rejects the selected preset. Standard is not modified and remains the default.

## Security and privacy boundary

The plugin logs no prompts, responses, credentials, or reasoning. Diagnostics are limited to session identifiers, phase/tool names, and promotion event type inside Harness-owned logging paths. The managed installer never overwrites an unknown or locally modified preset directory. The preset uses the official Harness tool implementations and their existing sandbox/approval policies, except for the upstream Minimal-compatible `str_replace_editor` filesystem realm documented in the composition.

## Evidence

| Retrieved at | Source                                                                                                                                            | Version/date                  | Key evidence                                                                                                                                                         | Confidence                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 2026-08-16   | [Community preset repository](https://github.com/xiaobright/dsh-anchored-standard)                                                                | commit `db4527a2...`          | Preset composition, progressive bootstrap hooks, tests, and MIT license                                                                                              | high for mechanism                                |
| 2026-08-16   | Local pinned rc.6 packages                                                                                                                        | `@deepseek-ai/dsh@0.1.0-rc.6` | Official roster discovers the preset as healthy; Standard remains default; a loopback mock provider captures the two-tool first request and five-tool second request | high                                              |
| 2026-08-16   | [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode) and [context caching](https://api-docs.deepseek.com/guides/kv_cache) | current at plan approval      | Ordinary history/cache is not a portable one-time model warm state                                                                                                   | medium; revalidate before changing product claims |
| 2026-08-16   | [Community modeltest](https://github.com/xiaobright/modeltest)                                                                                    | community benchmark           | Reported 98/99 scores are experiment motivation, not a universal product guarantee                                                                                   | medium                                            |

## Experimental boundary

The request-schema sequence, persistence, isolation, compaction, strict failure, and installer behavior are locally tested. No new V4 Pro credential was available in this implementation run, so the claimed capability or score improvement is **not yet field-verified**. A future paired experiment must run fixed tasks at least ten times per preset and record schema hashes, completion rate, score, and variance without retaining reasoning bodies.

## Related documents

- Parent: [Knowledge index](./index.md)
- Architecture: [System architecture](../architecture/overview.md)
- Testing: [Testing strategy](../engineering/testing.md)
