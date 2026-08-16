# Agent Preset Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the three bundled custom Agent Presets clear bilingual names and short bilingual descriptions without changing their IDs or reducing the available modes.

**Architecture:** Keep the Harness preset contract unchanged and store bilingual display copy in each preset's existing `preset.yml` metadata. Apply the same copy when generating the offline routing snapshot and when installing/refreshed routing presets, so background updates cannot reintroduce raw IDs or empty descriptions.

**Tech Stack:** TypeScript, Node.js ESM scripts, YAML metadata, Vitest.

## Global Constraints

- Preserve preset IDs: `anchored-standard`, `router-standard`, and `router-spec`.
- Do not remove or merge modes.
- Do not change agent tools, routing behavior, session state, or installation ownership semantics.
- Keep Chinese and English copy short enough for the existing selector layout.

### Task 1: Add regression coverage for bilingual preset metadata

**Files:**

- Modify: `tests/unit/routing-suite.test.ts`
- Modify: `tests/unit/anchored-standard-preset.test.ts`

- [x] Add assertions that installed routing presets contain bilingual names and descriptions.
- [x] Add assertions that the packaged Anchored Standard metadata contains both languages.
- [x] Run the focused tests and confirm the new assertions fail against the current metadata.

### Task 2: Implement one bilingual copy contract across all sources

**Files:**

- Modify: `packages/anchored-standard-plugin/preset/preset.yml`
- Modify: `scripts/fetch-routing-suite.mjs`
- Modify: `apps/desktop/src/lifecycle/routing-suite-link.ts`
- Modify: `apps/desktop/src/lifecycle/routing-suite-update.ts`

- [x] Define the three short bilingual display strings.
- [x] Make the offline snapshot generator write localized `preset.yml` files after fetching upstream presets.
- [x] Make startup installation normalize both bundled and refreshed routing presets before digesting and installing them.
- [x] Preserve managed-marker digest and conflict behavior.

### Task 3: Verify source and package-facing metadata

**Files:**

- Modify: `build/routing-suite/preset/router-standard/preset.yml`
- Modify: `build/routing-suite/preset/router-spec/preset.yml`

- [x] Update the checked-out offline snapshot used by local development and packaging.
- [x] Run focused tests, typecheck, and formatting checks for touched files.
- [x] Inspect the final diff and confirm no preset IDs or mode behavior changed.
