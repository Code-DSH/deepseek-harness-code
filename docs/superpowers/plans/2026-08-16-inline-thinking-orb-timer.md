# Inline Thinking Orb and Elapsed Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a rotating 20-pixel ThinkingOrb in the native running-status row and show the official elapsed clock from zero seconds.

**Architecture:** The desktop plugin detects the authoritative direct running-status row and returns a React portal into that row; no fixed visual is created in `shell.overlay`. The pinned Harness conversation patch keeps the official timer but removes its 15-second visibility delay and text shimmer.

**Tech Stack:** React 18, `react-dom@18.3.1`, `thinking-orbs@0.3.1`, esbuild 0.25.12, exact-version pnpm patching, Vitest/JSDOM, Playwright Chromium.

## Global Constraints

- Use `ThinkingOrb` with exactly `state="working"`, `size={20}`, and `speed={2}`.
- Keep Harness as owner of the live region, turn timestamp, elapsed formatting, layout box, scrolling, and cleanup.
- Do not mask, duplicate, delay, or replace response Token DOM.
- Do not restore the retired stream dissolve, glyph copies, particles, or fixed thinking overlay.
- Fail open to the complete native status.

---

### Task 1: Restore the inline Orb lifecycle test-first

**Files:**
- Create: `packages/desktop-plugin/src/thinking-status.js`
- Create: `packages/desktop-plugin/src/thinking-status.d.ts`
- Create: `packages/desktop-plugin/test/thinking-status.test.ts`
- Modify: `packages/desktop-plugin/src/client-runtime.js`
- Modify: `packages/desktop-plugin/src/transitions.css`
- Modify: `packages/desktop-plugin/scripts/build-client.mjs`
- Modify: `packages/desktop-plugin/package.json`
- Modify: `tests/e2e/plugin-contract.test.ts`
- Modify: `tests/e2e/plugin-real-harness.test.ts`
- Modify: `tests/playwright/desktop-plugin-browser.spec.ts`

**Interfaces:**
- Consumes: direct status selector `[data-chat-flow] > [role="status"][aria-live="polite"]`, React, `createPortal`, and the desktop plugin `shell.overlay` lifecycle seat.
- Produces: `findRunningStatus(document)`, `installThinkingStatus(document, window, onAnchor)`, `THINKING_ORB_PROPS`, and `InlineThinkingStatus`.

- [ ] **Step 1: Write focused failing tests**

Test direct-child matching, last-status selection, attach/detach/session-switch cleanup, no whole-flow rescan while the anchor remains connected, exact Orb props, portal target identity, inline non-fixed CSS, and slot disposal.

- [ ] **Step 2: Run the focused tests and prove RED**

Run: `pnpm vitest run packages/desktop-plugin/test/thinking-status.test.ts --config tests/e2e/plugin-vitest.config.ts`

Expected: FAIL because the controller, dependency, portal component, styles, and slot registration were retired.

- [ ] **Step 3: Add exact dependencies and the bounded detector**

Add exact `thinking-orbs@0.3.1` and `react-dom@18.3.1` to the desktop plugin. Bundle both while keeping React and Harness primitives external. Implement a child-list observer that publishes the direct status anchor and avoids a global query while the current anchor remains connected.

- [ ] **Step 4: Implement the inline portal**

Register a lifecycle component through `shell.overlay`; return only `createPortal(...)` into the detected native row. Render:

```js
React.createElement(ThinkingOrb, {
  state: "working",
  size: 20,
  speed: 2,
  "aria-hidden": "true",
});
```

Wrap it in `[data-dsh-desktop-thinking-inline]` with inline-flex geometry, `order: -1`, `position: relative`, `z-index: 1`, no pointer events, and no fixed/absolute positioning.

- [ ] **Step 5: Prove GREEN and build closure**

Run focused unit, plugin-contract, real-Harness, and browser tests. Rebuild the generated client and assert no unresolved `thinking-orbs`, `react-dom`, or local controller import remains.

### Task 2: Show the official clock immediately and remove text shimmer

**Files:**
- Modify: `patches/@deepseek-ai__dsh-client-ui-conversation@0.1.0-rc.6.patch`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/unit/harness-web-stream-performance.test.ts`
- Modify: `tests/e2e/plugin-real-harness.test.ts`

**Interfaces:**
- Consumes: pinned rc.6 `TurnStatus`, `formatRunDuration`, and the existing performance `tailData` patch.
- Produces: immediate native timer paint and static status copy without changing turn/session ingestion.

- [ ] **Step 1: Add RED assertions against the real installed bundle**

Execute the real patched conversation definition and assert the clock exists at zero seconds, advances from the official start time, and the status CSS has no shimmer animation. Preserve the 10,000-delta performance/canonical-text assertions.

- [ ] **Step 2: Extend the existing exact-version patch**

Change `const showClock = elapsedMs >= 15e3` to unconditional clock rendering, and replace the `turnStatus` gradient/shimmer declarations with stable label color. Keep the existing `tailData` optimization hunk intact.

- [ ] **Step 3: Verify clean install and behavior**

Refresh the patch hash, reinstall with `--frozen-lockfile`, rerun the real-bundle performance/status tests, and confirm both patch hunks remain applied.

### Task 3: Document, package, and visually accept

**Files:**
- Modify: `packages/desktop-plugin/THIRD_PARTY_NOTICES.md`
- Modify: `build/THIRD-PARTY-NOTICES.md`
- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/engineering/testing.md`
- Modify: `docs/engineering/acceptance-report.md`
- Modify: `docs/knowledge/upstream-baseline.md`
- Modify: `docs/project/status.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: passing inline status and surface-layout implementations.
- Produces: documented dependency/license closure and the same `0.3.2` Universal macOS release.

- [ ] **Step 1: Restore license and runtime-closure records**

Record the `thinking-orbs@0.3.1` MIT notice and require its bundled code while rejecting unresolved imports. Record the verified API and retrieval date in the upstream baseline.

- [ ] **Step 2: Update architecture and tests**

Describe the inline portal boundary, immediate native timer, fail-open cleanup, and explicit non-restoration of stream-output effects.

- [ ] **Step 3: Run release gates and packaged visual acceptance**

Verify light/dark Orb contrast, immediate seconds, correct scrolling/clipping, no overlap with Token output/composer/menus, cleanup after completion, reduced-motion behavior, and no idle retained plugin work.

- [ ] **Step 4: Record results and commit**

Commit implementation, generated artifacts, exact lock/patch hashes, tests, notices, and final documentation after verification.
