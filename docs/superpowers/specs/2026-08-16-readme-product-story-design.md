---
id: spec.readme-product-story
title: Product README Story and Layout
summary: Defines the bilingual, product-led README structure and evidence boundaries for DeepSeek Harness Code.
kind: product
status: canonical
content_stage: goal-only
scope: [readme, positioning, community]
triggers: [README, vision, positioning, comparison]
read_when: [changing the repository landing page or public product claims]
skip_when: [changing runtime behavior without public documentation impact]
priority: must
freshness_class: project
last_verified: 2026-08-16T12:55:00+08:00
owners: [primary-agent]
source_of_truth: [../../../README.md, ../../../README.zh-CN.md, ../../architecture/lifecycle.md, ../../engineering/acceptance-report.md]
related:
  prerequisites: [../../project/intent.md, ../../architecture/overview.md]
  next: [../plans/2026-08-16-readme-product-story.md]
supersedes: []
tags: [readme, product, vision]
---

# Product README Story and Layout

## Goal

Turn the GitHub landing page into a bilingual product narrative that explains why DeepSeek Harness Code exists, how it differs from a basic Web wrapper, and which long-running reliability mechanisms are implemented.

## Audience and language

- `README.md` is the complete English edition.
- `README.zh-CN.md` is the complete Simplified Chinese edition.
- Both documents link to each other near the top and remain structurally equivalent.
- The primary audience is developers and high-frequency DeepSeek users who need a durable coding workspace rather than a browser shortcut.

## Narrative

The central vision is: **turn DeepSeek from a browser page into a dependable desktop coding environment for long-running work**.

The README may state that the project is not a simple Web wrapper. It must compare product categories and capabilities rather than insult or name individual community maintainers. The comparison should distinguish:

- a remote Web page embedded in a window;
- an integrated Harness runtime with app-owned lifecycle management;
- DeepSeek Harness Code's official-format plugins, recovery, diagnostics, desktop controls, and packaged runtime.

## Landing-page structure

1. Centered hero with product icon, name, one-sentence vision, language switch, navigation links, and badges.
2. Vision statement and concise explanation of why the project exists.
3. “Beyond a wrapper” capability comparison table.
4. Long-running reliability and memory-pressure section.
5. Modern desktop experience and integrated Harness capabilities.
6. Architecture image and security boundary.
7. Supported platforms and release state.
8. Installation, source build, verification, documentation, roadmap, contribution, license, and disclaimer.

The existing product icon at `build/deepseek-harness-code.png` and architecture diagram at `docs/architecture/system.svg` are reused. No speculative screenshots, download links, release badges, or community links are invented.

## Claim boundaries

The README may describe implemented mechanisms:

- five-second non-overlapping health probes;
- recovery after three consecutive failed probes or child exit;
- serialized bounded recovery and safe origin reload;
- renderer replacement without terminating a healthy Harness process;
- a 30-second unresponsive-renderer threshold;
- an independent IPC-only Watchdog with crash-loop protection;
- bounded graceful shutdown and log rotation;
- packaged Chromium, Node, Harness, and plugins;
- a narrow two-capability preload bridge and loopback-only service.

The memory statement must be mechanism-based: the application controls long-session memory pressure by bounding log growth, avoiding overlapping probes, replacing failed renderers, and owning process retirement. It must not claim a measured percentage reduction or universal elimination of leaks until a reproducible memory benchmark exists.

The freeze statement may say the application detects and recovers from defined Web/Harness failure modes. It must not promise that every possible hang is impossible.

## Tone

- Confident, modern, technically specific, and community-friendly.
- Prefer “not merely a wrapper” and “built for long-running work” over attacks on another project.
- Clearly state that this is a community project and not an official DeepSeek release.
- Avoid unverifiable superlatives such as “fastest,” “zero memory leak,” or “never crashes.”

## Validation

- Both READMEs render as valid GitHub Markdown and contain reciprocal language links.
- Every local link passes `pnpm verify:docs`.
- Security-sensitive wording remains consistent with `pnpm verify:security`.
- Public claims are traceable to architecture, lifecycle, tests, or acceptance evidence.

## Related documents

- Parent: [Product intent](../../project/intent.md)
- Architecture: [System overview](../../architecture/overview.md)
- Lifecycle evidence: [Lifecycle](../../architecture/lifecycle.md)
- Verification evidence: [Acceptance report](../../engineering/acceptance-report.md)

## Change log

- `2026-08-16T12:55:00+08:00` — Approved bilingual product-led README design, including evidence-bounded memory and freeze claims.
