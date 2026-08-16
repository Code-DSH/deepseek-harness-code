---
id: design.harness-web-performance
title: Harness Web Streaming Performance Fix
summary: Patch the pinned Harness rc.6 conversation client so streaming updates preserve every token while avoiding repeated full turn-tail projection and redundant React publication.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [web-ui, electron-renderer, conversation, streaming, performance]
triggers:
  [卡顿, streaming tokens, turn-tail, publish, long task, React rendering]
read_when:
  [implementing or validating the rc.6 Web conversation performance fix]
skip_when: [changing backend model execution or desktop process lifecycle]
priority: must
freshness_class: project
last_verified: 2026-08-16T15:50:00+08:00
owners: [primary-agent]
source_of_truth:
  [Chrome Performance trace, pinned Harness rc.6 package, regression tests]
related:
  prerequisites:
    [../../knowledge/upstream-baseline.md, ../../engineering/testing.md]
  next: [../plans/2026-08-16-harness-web-performance.md]
supersedes: []
tags: [performance, streaming, web, electron, patch]
---

# Harness Web Streaming Performance Fix

## Decision

Apply a version-pinned, reviewable package patch to the official `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.6` Web client. The optimization may coalesce redundant projection and subscriber publication, but it must not throttle, discard, reorder, rewrite, or delay ingestion of stream events.

The same Web bundle runs in the browser and Electron, so one upstream-client fix covers both surfaces. Desktop-only animation work is not the root-cause target.

## Evidence and root cause

Chrome Performance tracing of an active long conversation showed the renderer busy for about 41% of a 23.15-second sample, including 17 long tasks over 50 ms. The first-party application accounted for about 3.96 seconds of JavaScript work; extensions accounted for only about 31 ms.

The dominant chain was:

```text
stream event
  -> handleMessage
  -> session notifier / publish
  -> conversation.flush
  -> applyDirtyLocationData
  -> buildLocationData
  -> tailData
  -> React subscriber work
```

`handleMessage` ran about 115 times per second, `publish` about 38.5 times per second, and `tailData` alone occupied about 1.1 seconds in a 15.2-second steady-state CPU profile. Loading the long session grew the DOM from roughly 554 to 3,073 nodes and the heap from 36.5 MB to 146.3 MB. The evidence identifies repeated full conversation-tail derivation and downstream React publication on small streaming deltas as the primary bottleneck.

The implementation investigation narrowed this further: while a turn is open, the rc.6 `turn-tail` Definition has a valid state object with no `end` member. `tailData()` nevertheless evaluated `context.matches.find(turn/end)` as the nullish fallback on every derived flush, rescanning the complete growing match list even though no end could exist yet. The real installed bundle performed 50,015,000 match inspections for 10,000 ordered deltas.

## Correctness invariants

- Every ordered stream event and token delta is applied to canonical session state exactly once.
- Optimization occurs only after ingestion, at derived projection and notification boundaries.
- Subscribers always receive the exact accumulated assistant and reasoning text, including the last token.
- A forced synchronous publication occurs on semantic completion boundaries: message/block/step/turn completion, disconnect, error, abort, session switch, and initial hydration.
- Projection caches are session-scoped and invalidated by any structural event that can change location/tail data.
- A cache mismatch or unexpected rc.6 shape fails open to the original projection/publication path.
- The official question protocol, message order, tool blocks, history loading, reconnect behavior, and autoscroll semantics remain unchanged.

## Implementation boundary

The shipped patch uses the narrower state-backed hook: when Definition state exists, `tailData()` reads `state.end` directly and returns before scanning matches on an open turn. If state is unexpectedly absent, it executes the original rc.6 match scan as a fail-open fallback. No cache, timer, cross-session mutable state, or new publication scheduler is introduced. A high-frequency text delta still updates the canonical Assistant state and keeps the official animation-frame publication request; assistant/message and turn/end remain synchronous immediate boundaries.

The patch must be durable across clean installs and packaging. Direct edits under `node_modules` are not a deliverable. Use the repository's pinned package manager patch mechanism or an equally deterministic build-time patch with a strict version/source guard.

## Required regression behavior

A synthetic long stream must prove all of the following against the installed patched artifact:

- at least 10,000 ordered deltas produce byte-for-byte exact final text and the expected final token;
- publication/projection work is bounded well below the event count during an open stream;
- completion forces the final snapshot even when no animation frame or timer is subsequently available;
- reasoning and assistant deltas, structural tool/message events, session switching, hydration, and reconnect invalidate or flush correctly;
- no session can reuse another session's derived state;
- the clean packaged dependency closure contains and applies the patch.

## Baseline limitation

At the isolated branch baseline, unit, anchored-preset, real-Harness plugin, and package-contract suites pass. Two pre-existing Playwright stream-animation cases fail because the generated desktop plugin surface does not export `installStreamOutputEffects`; rebuilding the plugin does not change that baseline. This failure is recorded as unrelated evidence and must not be attributed to the performance patch.

## Acceptance

The fix is accepted when focused semantic/performance regressions pass, package installation reproduces the patched artifact from a clean lockfile, type/lint/build/runtime-closure checks pass, and a browser/runtime verification demonstrates materially reduced redundant projection/publication without lost output.

## Verified result

- Exact-version artifact: `patches/@deepseek-ai__dsh-client-ui-conversation@0.1.0-rc.6.patch`, mapped by `pnpm-workspace.yaml` and hashed in `pnpm-lock.yaml`.
- RED: the 4-test focused suite produced one expected failure, reporting 50,015,000 match inspections while all semantic assertions passed.
- GREEN: 4/4 passed with zero open-turn match inspections and byte-for-byte exact 10,000-delta output including `[7pr]`.
- Mutation check: reverting only the installed line restored the 50,015,000 count and failure; restoring the patch returned green.
- Clean install: moving aside `node_modules`, running `pnpm install --frozen-lockfile`, and loading the peer-qualified real bundle reproduced the patch and 4/4 focused pass.
- Integration: unit 27/102, Anchored 108/108, plugin 23/23 (standalone rerun), package 4/4, typecheck, build, runtime preflight, docs links, and security passed. Playwright retained exactly the two known animation-export baseline failures. Full lint/format still report pre-existing vendored/unrelated files; targeted ESLint for the new test passed.

## Related documents

- [Implementation plan](../plans/2026-08-16-harness-web-performance.md)
- [Testing strategy](../../engineering/testing.md)
- [Upstream baseline](../../knowledge/upstream-baseline.md)
- [Documentation index](../../index.md)

## Change log

- `2026-08-16T15:35:00+08:00` — Recorded the user-approved root-cause fix, token-preservation invariants, baseline evidence, and verification boundary.
- `2026-08-16T15:50:00+08:00` — Marked implementation-backed after exact-version patching, RED/GREEN/mutation evidence, clean frozen-lockfile reinstall, and integration gates.
