# Task 1 Report — Harness Web Streaming Performance

## Status

`DONE_WITH_CONCERNS`

Implementation commit: `303d28df376bbb14f668c67248eab7167053ea1e`

## Root cause and actual hook

The pinned `@deepseek-ai/dsh-client-ui-conversation@0.1.0-rc.6` browser bundle implements `turn-tail.tailData()` as:

```js
const end =
  context.state?.end ??
  context.matches.find((match) => match.event.type === "turn/end");
```

An open turn has a valid Definition state (`{ turn }`) but intentionally has no `end`. Therefore the nullish fallback scans the complete, growing match list on every post-ingestion derived flush. Across a long stream this is quadratic work. The canonical `handleMessage`/stream event path is not the source changed by this task.

The actual hook is the derived `turn-tail.tailData()` projection in `lib/client.js` of the exact rc.6 conversation package. Normal operation now distinguishes “state exists without an end” from “state is absent”: it reads `context.state.end` in O(1), while an unexpectedly absent state executes the original `matches.find` path as a fail-open fallback.

## RED evidence

Before changing the dependency, the new behavior-level suite loaded the actual installed runtime and conversation browser bundles through their real `window.__ModuleLoader__` factories. The focused command was:

```text
pnpm vitest run tests/unit/harness-web-stream-performance.test.ts
```

Original rc.6 result: 1 failed / 3 passed. The 10,000-delta case expected the expensive match inspection count to remain at most 1 but measured `50,015,000`. Its independently accumulated assistant text and final-token assertions already passed, separating the performance defect from canonical token correctness.

Mutation evidence repeated RED after implementation: reverting only the installed optimized line reproduced `50,015,000` inspections and the focused failure; restoring it returned 4/4 green.

## Implementation summary

- Added an exact-version pnpm patch at `patches/@deepseek-ai__dsh-client-ui-conversation@0.1.0-rc.6.patch`.
- Added the pnpm 11 `patchedDependencies` mapping to `pnpm-workspace.yaml`; `pnpm-lock.yaml` records patch hash `f721cf954e54868d6d58a566be4dcecb92e159231e6f10da90ac9c01288231cb` throughout the peer-qualified dependency graph.
- Changed only the post-ingestion turn-tail derived projection. Canonical event ingestion, Assistant chunk updates, event order, official animation-frame publication for deltas, and immediate structural/final publication are unchanged.
- Added a real-bundle Vitest regression. It exercises the production rc.6 Definitions and `ConversationNodeAssembler`, not a copied algorithm or patch-text assertion.
- No cache, timer, new scheduler, global state, or cross-session mutable state was introduced. State remains inherently session-local and bounded, and missing Definition state fails open to the official scan.
- Moved the worktree `node_modules` aside, ran `pnpm install --frozen-lockfile`, and verified the peer-qualified installed bundle and focused suite to prove clean-lockfile reproduction. The moved backup is outside the repository under `/tmp` and is not a deliverable.

## Token and boundary correctness evidence

The 4 focused tests prove:

- 10,000 ordered text deltas equal an independently accumulated byte-for-byte string, ending with the expected final token `[7pr]`.
- Reasoning and answer blocks remain exact.
- `assistant/message` and `turn/end` still request immediate publication, so the last token and completed turn do not depend on another animation frame.
- Tool/structural events still invalidate the branch surface correctly.
- Initial hydration and reconnect use `replaceWindow` and publish immediately with identical snapshots.
- Two interleaved assemblers retain isolated session text and reasoning.
- Missing Definition state takes the original scan and correctly projects an error-ending turn.

## Performance operation counts

| Scenario                                                         |   Before rc.6 patch |  After patch |
| ---------------------------------------------------------------- | ------------------: | -----------: |
| 10,000 open-turn deltas, `turn-tail` match predicate inspections |          50,015,000 |            0 |
| Focused test result                                              | 1 failed / 3 passed | 4 passed / 4 |

This is an operation-count assertion rather than a wall-clock threshold. It directly measures the formerly quadratic predicate work while still checking canonical accumulated output.

## Commands and results

### RED, mutation, and clean reproduction

| Command / action                                                                     | Result                                                         |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm vitest run tests/unit/harness-web-stream-performance.test.ts` on original rc.6 | RED: 1 failed / 3 passed; 50,015,000 inspections               |
| Temporarily revert the installed optimized line, rerun focused suite                 | RED reproduced: 50,015,000 inspections                         |
| Restore installed line, rerun focused suite                                          | 4/4 passed                                                     |
| Move aside worktree `node_modules`; `pnpm install --frozen-lockfile`                 | Passed; 976 packages; patch reapplied from workspace artifacts |
| Focused suite after clean reinstall                                                  | 4/4 passed; exact output; zero open-turn inspections           |

### Final passing gates

| Command                                                                            | Result                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm vitest run tests/unit/harness-web-stream-performance.test.ts`                | 1 file / 4 tests passed                                                                                                                                               |
| `pnpm test:unit`                                                                   | 27 files / 102 tests passed                                                                                                                                           |
| `pnpm test:anchored`                                                               | 108 tests passed                                                                                                                                                      |
| `pnpm test:plugin`                                                                 | 3 files / 23 tests passed                                                                                                                                             |
| `pnpm test:package`                                                                | 1 file / 4 tests passed                                                                                                                                               |
| `pnpm typecheck`                                                                   | Passed                                                                                                                                                                |
| `pnpm exec eslint tests/unit/harness-web-stream-performance.test.ts`               | Passed                                                                                                                                                                |
| Targeted `pnpm exec prettier --check` over every changed source/doc/workspace file | Passed                                                                                                                                                                |
| `pnpm build`                                                                       | Passed: desktop, watchdog, desktop plugin, Anchored plugin                                                                                                            |
| `pnpm preflight:runtime`                                                           | Passed: 18 runtime artifacts, 32 production dependencies, 5 critical packages, 1 bundled plugin package                                                               |
| `pnpm verify:docs`                                                                 | Passed: 33 documentation files, no broken local links                                                                                                                 |
| `pnpm verify:security`                                                             | Passed: 7 required controls and 3 forbidden patterns                                                                                                                  |
| `git diff --check` excluding the generated pnpm patch context                      | Passed; the patch's unchanged tab-indented context produces Git's standard space-before-tab warning only because unified diff context lines begin with a marker space |

### Known/pre-existing non-green gates

| Command                                                                       | Result and attribution                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:e2e`                                                               | 3/5 passed. Exactly the two briefed baseline failures remain: `animates only appended assistant prose...` and `becomes quiescent...`, both `installStreamOutputEffects is not a function`. Rebuilding the plugin did not change them, and this diff does not touch that surface. |
| `pnpm lint`                                                                   | Non-green with 77 errors in tracked vendored `packages/superpowers-skills/skills/brainstorming/scripts/helper.js` and `server.cjs`; neither file is changed by this task. The changed TypeScript passes targeted ESLint.                                                         |
| `pnpm format:check`                                                           | Non-green on 44 pre-existing vendored/unrelated files, including Superpowers content and unrelated desktop/plugin tests. All files changed by this task pass targeted Prettier.                                                                                                  |
| First resource-contention run of `pnpm test:plugin` in a broad parallel batch | One real-Harness test timed out; immediate standalone rerun and the final standalone gate both passed 23/23.                                                                                                                                                                     |

## Modified files

- `AGENTS.md`
- `docs/engineering/acceptance-report.md`
- `docs/engineering/testing.md`
- `docs/index.md`
- `docs/knowledge/upstream-baseline.md`
- `docs/plans/index.md`
- `docs/project/status.md`
- `docs/superpowers/plans/2026-08-16-harness-web-performance.md`
- `docs/superpowers/specs/2026-08-16-harness-web-performance-design.md`
- `patches/@deepseek-ai__dsh-client-ui-conversation@0.1.0-rc.6.patch`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tests/unit/harness-web-stream-performance.test.ts`
- `.superpowers/sdd/2026-08-16-harness-web-performance/task-1-report.md` (this report; report-only follow-up commit)

## Unresolved items and concerns

- The two known Playwright animation-export failures remain unchanged and are outside this root-cause fix.
- Full-repository lint and formatting are still non-green only on pre-existing vendored/unrelated files; this task does not reformat or repair those surfaces.
- The patch is intentionally exact-version guarded. Any Harness conversation package upgrade must rebase or remove the patch and rerun the 10,000-delta real-bundle suite before acceptance.
- This fix removes the measured quadratic turn-tail scan. It does not claim to eliminate every other long-session renderer cost from the original browser trace.
