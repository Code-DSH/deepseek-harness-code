---
id: design.inline-thinking-orb-timer
title: Inline Thinking Orb and Elapsed Timer Design
summary: Restore a rotating ThinkingOrb inside the native Harness running-status row and show the official elapsed timer immediately.
kind: architecture
status: canonical
content_stage: goal-only
scope: [desktop-plugin, conversation-status, web-ui]
triggers: [Deep diving, ThinkingOrb, rotating status, elapsed seconds]
read_when: [changing the active model-running indicator]
skip_when: [changing streamed token rendering or settled Think disclosures]
priority: must
freshness_class: project
last_verified: 2026-08-16T18:00:00+08:00
owners: [primary-agent]
source_of_truth: [user correction, ../../../packages/desktop-plugin, pinned Harness rc.6 conversation bundle]
related:
  prerequisites: [./2026-08-16-deepseek-harness-code-design.md]
  next: [../plans/2026-08-16-inline-thinking-orb-timer.md]
supersedes: [./2026-08-16-stream-output-animation-design.md#active-thinking-indicator-lifecycle]
tags: [thinking-orbs, conversation, timer, layering]
---

# Inline Thinking Orb and Elapsed Timer Design

## Decision

Restore the active model-running visual with the pinned `thinking-orbs@0.3.1` component. Use `state="working"`, `size={20}`, and `speed={2}`: `working` is the package's rotating tilted-orbits animation, while the previously used `breathing` state is a morphing ring.

The Orb appears inside the official direct Harness running-status row, before the native “Deep diving...” label. The official Harness turn clock remains the single elapsed-time source and becomes visible from zero seconds instead of waiting 15 seconds. The status row therefore reads visually as rotating Orb, native status copy, and tabular elapsed seconds.

## Layering and ownership

- Harness continues to own the status row, live-region semantics, turn start timestamp, elapsed-time formatting, scrolling, clipping, and cleanup.
- The desktop plugin uses its React lifecycle seat only to create a portal into the current direct status row. It creates no fixed-position visual and does not hide or replace the native status.
- The portal host is an inline-flex child with `order: -1`, `position: relative`, and `z-index: 1`. It is non-interactive and cannot cover messages, the composer, menus, or modal overlays.
- The exact-version Harness conversation patch makes the existing timer unconditional and removes the status text shimmer, leaving the Orb as the only active motion.
- Streamed prose, reasoning text, Token publication, Markdown, code blocks, questions, and settled Think rows are untouched.

## Lifecycle and failure behavior

- Match only the last direct `[data-chat-flow] > [role="status"][aria-live="polite"]` element.
- Observe child additions/removals without rescanning the whole conversation while the active anchor remains connected.
- Mount once per active anchor; move the portal if a session switch replaces the anchor.
- Remove the portal immediately on completion, cancellation, error, navigation, or plugin disposal.
- If detection, portal creation, or Orb rendering fails, leave the complete native status visible.
- Respect `prefers-reduced-motion`; `thinking-orbs` supplies its deterministic static frame.

## Acceptance

1. `thinking-orbs@0.3.1` is bundled into the offline client with no unresolved runtime import.
2. The rendered Orb uses exactly `{ state: "working", size: 20, speed: 2 }`.
3. The native elapsed clock is visible at `0s` and continues from the official turn start time.
4. The Orb is a child of the status row in the effective DOM, not a fixed child of `shell.overlay`.
5. Completion and plugin disposal leave no Orb host, observer, interval, status marker, or animation frame owned by the plugin.
6. A packaged macOS run confirms visibility in light and dark mode, correct scroll/clipping behavior, and no overlap with output, composer, menus, or native traffic lights.

## Evidence

- `2026-08-16` — The user supplied the Thinking Orbs site and requested restoration, a rotating treatment, visible seconds, and corrected layering.
- `2026-08-16` — The official `thinking-orbs@0.3.1` package declares `working` as tilted-orbits motion and `breathing` as a morphing ring; Harness rc.6 already owns the turn-start clock but delays its paint until 15 seconds.

## Related documents

- Parent design: [DeepSeek Harness Code](./2026-08-16-deepseek-harness-code-design.md)
- Previous historical design: [Stream output animation](./2026-08-16-stream-output-animation-design.md)
- Architecture: [System architecture](../../architecture/overview.md)

## Change log

- `2026-08-16` — Recorded the user-approved restoration as an inline native-row enhancement rather than the retired fixed overlay.
