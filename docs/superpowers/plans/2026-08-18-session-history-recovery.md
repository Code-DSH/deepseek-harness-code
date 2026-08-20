# Session History Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely restore the three sessions with committed sequence gaps after isolating competing DSH writers.

**Architecture:** Preserve the original compressed logs in a timestamped backup. Decode only the three selected logs, keep each log's first contiguous logical prefix, discard the first conflicting storage row and its suffix, then atomically publish a fresh checksummed Zstandard artifact containing the original header and valid prefix. Validate the repaired artifacts with the same sequence and frame rules used by the shipped reader; do not touch the two additional anomalous sessions.

**Tech Stack:** Node.js 26 built-in Zstandard API, `@deepseek-ai/dsh-session` storage decoder, JSONL/Zstandard session format, POSIX atomic rename.

## Global Constraints

- Only repair `session-84bed445-8659-4ded-8832-22b21c7de37d`, `session-8e85cc2f-85ff-4b82-a655-9708fcab76d4`, and `session-d17eb46b-0b95-4f1f-a22a-b89b2af0b573`.
- Preserve the original files before any replacement.
- Keep the original session header and every storage row before the first seq conflict.
- Drop the first conflicting storage row and all later rows; do not renumber or merge events.
- Do not modify `session-fb0e98f3-a589-4ebc-bc9d-60b853fce378` or `session-2a8889ca-0408-4f33-9ff5-85685c815a8a`.
- Do not delete workspace metadata or the whole DSH home.
- Do not claim recovery until frame validation, contiguous-seq validation, and post-repair history loading succeed.

---

### Task 1: Isolate competing writers

**Files:**

- Runtime processes only: VS Code DSH ports `30800` and `3080`.

- [x] Stop the two VS Code DSH runtimes and verify that only the desktop Harness on `127.0.0.1:52572` remains.

### Task 2: Back up and decode the selected logs

**Files:**

- Create: `session-history-recovery.mjs`
- Create: `/Users/trip/.dsh/recovery-backups/20260818T013452Z-session-history/`

**Interfaces:**

- Consumes: three `.jsonl.zstd` files under the project session directory.
- Produces: a manifest containing original SHA-256 values, first-gap details, and backup paths; an in-memory repaired artifact for each selected session.

- [x] Implement frame scanning using the shipped Zstandard frame layout and decode rows with `decodeStorageRecord`.
- [x] Validate each header id and detect the first row whose expanded event seq differs from the expected cursor.
- [x] Refuse to proceed if any selected log has no valid header, no gap, a torn frame, or a non-contiguous prefix before the reported gap.
- [x] Copy all three originals plus `workspace.json` and `session_projcache.json` into the timestamped backup directory before replacement.

### Task 3: Atomically publish prefix-only repairs

**Files:**

- Modify: the three selected `session.jsonl.zstd` files only.

- [x] Re-encode each original header and valid prefix as checksummed Zstandard frames.
- [x] Write a temporary artifact beside the target with mode `0600`, fsync it, then rename it over the target.
- [x] Preserve raw valid storage rows; do not renumber events or rewrite the retained semantic content.
- [x] Record original and repaired SHA-256 values in the backup manifest.

### Task 4: Verify the repaired artifacts

**Files:**

- Read: repaired session logs and backup manifest.

- [x] Run Zstandard frame/checksum validation on all three repaired files.
- [x] Decode every retained row and assert `event.seq === index` across the complete logical prefix.
- [x] Confirm the first conflicting seq and all conflicting suffix rows are absent from the repaired artifact.
- [x] Re-open the three sessions through the single desktop Harness API and confirm all three `session.history` calls return HTTP 200 with `result.ok=true`.

### Task 5: Report residual risk

- [x] Report that two other sessions have different seq anomalies and were intentionally not modified.
- [x] Report the backup path and the exact number of retained/dropped rows per session.
- [x] Recommend a permanent single-writer or per-client `DSH_HOME` configuration before reopening VS Code DSH.
