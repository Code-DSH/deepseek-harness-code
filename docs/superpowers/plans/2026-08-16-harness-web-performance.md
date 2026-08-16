# Harness Web Streaming Performance Implementation Plan

> **For the implementer:** Read the generated Task 1 brief first. Follow strict TDD: observe the focused regression fail before changing the pinned package artifact.

**Goal:** Make long, actively streaming Harness conversations responsive in both Web and Electron while preserving every token and all completion/session semantics.

**Architecture:** Apply a persistent, exact-version patch to the rc.6 conversation client. Optimize derived turn-tail projection and redundant publication only after canonical event ingestion. Structural and final events invalidate/flush synchronously; unexpected states fall back to official behavior.

**Tech stack:** pnpm 11.19.0 patched dependencies or deterministic guarded build patch, Vitest/Node integration tests, TypeScript repository tests, pinned DeepSeek Harness 0.1.0-rc.6.

## Global Constraints

- Do not modify, throttle, sample, batch, reorder, or drop the canonical `handleMessage`/stream ingestion path.
- Final accumulated assistant and reasoning text must be byte-for-byte exact, including the final token.
- Initial hydration, message/block/step/turn completion, abort, error, disconnect, reconnect, and session switch force a correct publication and invalidate stale session state.
- Cache or coalescing state is isolated per session and bounded; unexpected upstream shapes fail open to the original rc.6 behavior.
- Patch only the exact pinned upstream package/version and make the patch reproducible after deleting `node_modules` and reinstalling from the lockfile.
- Do not alter the official question protocol, tool/message ordering, renderer semantics, or the desktop-only visual animation implementation.
- Preserve unrelated user work. Make all changes only inside the isolated `fix/harness-web-performance` worktree.
- Use `apply_patch` for manual file edits, run focused RED before production changes, then GREEN and relevant repository gates.

---

### Task 1: Persistent rc.6 turn-tail and publication optimization

**Files:**

- Create: `tests/unit/harness-web-stream-performance.test.ts` or the closest behavior-level equivalent
- Create: `patches/<exact-pnpm-generated-conversation-patch>.patch` (preferred) or a deterministic guarded patch artifact
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify if required for artifact verification: `scripts/check-runtime-closure.mjs`
- Modify after evidence exists: `AGENTS.md`, `docs/engineering/testing.md`, `docs/engineering/acceptance-report.md`, `docs/knowledge/upstream-baseline.md`, `docs/project/status.md`, and this design/plan

**Interfaces:**

- Consumes: pinned `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.6`, its `tailData` projection, rc.6 conversation/session event shapes, and notifier subscription boundary.
- Produces: a clean-install reproducible patched client, exact token/session semantics, a bounded projection/publication rate under a 10,000-delta synthetic stream, and an explicit final flush.

- [x] **Step 1: Characterize the installed rc.6 behavior and choose the narrow hook**

Inspect the package manifest, lockfile peer key, `tailData`, `conversation.flush`, and notifier/publication call sites. Record the smallest durable patch point. Do not assume that reducing React publishes alone is safe; identify which values are canonical state versus derived snapshots.

- [x] **Step 2: Write behavior-level failing regressions**

Build a deterministic harness around the real installed patched target or an extracted production module that exercises the real projection/coalescing logic. The tests must independently construct expected text and cover: 10,000 ordered deltas, reasoning plus answer text, final-token flush, structural invalidation, hydration, reconnect, two interleaved session IDs, and fail-open fallback. Assert an explicit upper bound on expensive projection/publication count rather than elapsed wall time.

- [x] **Step 3: Run focused RED**

Run only the new test and capture the expected failure caused by current rc.6 recomputing/publishing on the high-frequency path. A test that merely greps patch text or cannot fail on a lost last token is not acceptable.

- [x] **Step 4: Implement the minimal persistent patch**

Use pnpm's patch mechanism if compatible with the peer-qualified package. Keep canonical event ingestion unchanged. Reuse unchanged finalized-step/location derivations, suppress only semantically identical snapshots, and force a synchronous final/structural publication. Scope cache/coalescing state per session; bound and clear it on teardown. Wrap the optimization so an invariant failure executes the unoptimized official path.

- [x] **Step 5: Reinstall and run focused GREEN**

Delete only the isolated worktree's installed dependency tree if needed, reinstall with `pnpm install --frozen-lockfile`, and prove the patch is applied from repository artifacts. Run the new regression and mutate/disable the optimization locally to confirm the performance-count test would fail.

- [x] **Step 6: Run integration gates**

Run the new focused test, `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm preflight:runtime`, `pnpm verify:docs`, and the passing real-Harness/package suites. Run `pnpm test:e2e`; report the known baseline animation-export failures separately unless the patch changes them.

- [x] **Step 7: Document measured evidence and commit**

Update the listed project documents with actual implementation, commands, counts, limitations, and rollback (remove the exact patch mapping and lock entry). Mark design/plan `implementation-backed` only after the checks pass. Review the full diff for generated/package noise, then commit the isolated branch.

## Execution record

- Root cause: `tailData()` used `context.state?.end ?? context.matches.find(turn/end)`, so every open-turn flush linearly searched a growing match list.
- Hook: exact rc.6 `turn-tail.tailData()` in the packaged conversation client. Normal state reads `state.end` in O(1); only absent state falls back to the official scan.
- RED/GREEN: 50,015,000 match inspections before, zero after, with exact 10,000-delta Assistant output and the final `[7pr]` token.
- Correctness: reasoning plus answer blocks, assistant/message and turn/end immediate publication, tool structural invalidation, hydration/reconnect immediate replacement, two interleaved session assemblers, and fail-open fallback all pass against the real installed bundle.
- Reproduction: a clean `pnpm install --frozen-lockfile` applies the peer-qualified patch from repository artifacts.
- Gates: focused 4/4, unit 27 files/102, Anchored 108, plugin 23, package 4, typecheck, build, runtime preflight, docs, and security pass. Playwright remains 3/5 with only the two documented animation-export failures. Full-repository lint/format remain non-green solely on pre-existing vendored/unrelated files; changed TypeScript passes targeted ESLint.
- Rollback: remove the exact `patchedDependencies` mapping from `pnpm-workspace.yaml`, regenerate `pnpm-lock.yaml`, and delete the patch file only after the replacement upstream bundle passes the focused regression.
