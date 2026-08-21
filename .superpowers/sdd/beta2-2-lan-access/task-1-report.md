# Task 1 Report

## Status

Implemented warm-start reconciliation skipping with an app-owned marker under `DSH_HOME`.

## Changes

- Added two RED/GREEN tests covering unchanged warm startup and managed package identity changes.
- Added marker payload digesting, validation, profile dependency validation, and managed pnpm store validation.
- `ensureOfficialHarnessInstall()` now returns `status: "unchanged"` only when all marker, package identity, profile dependency, and store checks pass.
- Missing or invalid markers continue through the official `dsh plugin --profile web add` command.
- Removed desktop-side profile manifest mutation; profile reconciliation remains owned by the official CLI.

## Verification

- Focused Vitest: `11 tests passed` via the local Vitest binary.
- TypeScript: no new errors; the repository still has the pre-existing missing module `@deepseek-ai/schemastery` in `packages/prompt-principles-plugin/src/index.ts`.
- `git diff --check`: passed.
- Required pnpm command could not complete because the sandbox could not reach the npm registry while pnpm attempted to materialize the workspace dependency store; the direct local Vitest invocation passed.

## Concerns

- The full workspace typecheck remains blocked by the unrelated missing dependency above.

## Review follow-up

- Added direct regression coverage for a missing profile dependency and a mismatched
  `link:` dependency. Both invalidate the marker and rerun the official CLI.
- Added direct regression coverage for a foreign pnpm store in `.modules.yaml`.
  The marker is invalidated and official reconciliation reruns.
- RED/GREEN: the focused suite was run after adding the regression tests; the existing
  implementation already contained the invalidation branches, so the new tests passed
  immediately rather than exposing a remaining implementation failure.
- Focused Vitest result after the follow-up: `14 tests passed`.

## Runtime regression follow-up

- Added filesystem fixtures proving successful reconciliation removes only
  explicitly `linkOnly: true` names from `dsh.profile.bundles`, while preserving
  dependencies, unrelated bundles, and unrelated profile fields.
- Added a warm-start fixture proving a marker is invalid when a link-only name is
  reintroduced into `dsh.profile.bundles`; the official CLI reruns and the bundle
  is de-duplicated before returning `installed`.
- RED: the new fixtures failed 2 tests before the production change (`bundles`
  was not cleaned and the warm marker incorrectly returned `unchanged`).
- GREEN: focused Vitest `16 tests passed` after restoring the narrow rc.8 cleanup.
- TypeScript `--noEmit` and `git diff --check` passed.

The cleanup is deliberately limited to the rc.8 compatibility exception:
only string entries whose names are explicitly marked `linkOnly: true` are
removed from `dsh.profile.bundles`; dependencies, unrelated bundles, and all
other profile fields are retained. Malformed profile reads remain non-fatal and
force a fresh official reconciliation rather than trusting the marker.

## Review gap follow-up

- Updated the normal post-reconcile fixture so the synchronous official-command
  runner writes the profile manifest containing the duplicate link-only bundle
  during command processing, matching the real root-cause timing.
- Added real filesystem fixtures for both a missing and malformed
  `profiles/web/package.json`. After a healthy marker is created, each mutation
  resolves non-fatally, attempts the official CLI again, and returns `installed`.
- No production change was needed: the existing fail-open marker validation and
  non-fatal cleanup paths passed the new cases immediately.
- Focused Vitest: `18 tests passed`; TypeScript `--noEmit` and `git diff --check`
  passed.
