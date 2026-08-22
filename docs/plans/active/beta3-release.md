---
id: plan.beta3-release
title: BETA3 Upstream Upgrade and Release
summary: Upgrade the packaged Harness to 0.1.1-rc.2, preserve local patches, verify CI, and publish BETA3 through the existing updater channel.
kind: plan
status: canonical
content_stage: partial-implementation
scope: [dependencies, runtime, packaging, updater, release]
freshness_class: project
last_verified: 2026-08-22T11:15:00+08:00
owners: [project]
source_of_truth:
  [
    ../../../package.json,
    ../../../pnpm-lock.yaml,
    ../../../.github/workflows/package.yml,
  ]
---

# BETA3 Upstream Upgrade and Release

## Goal

Ship `deepseek-harness-code@0.1.0-BETA3` with official `@deepseek-ai/dsh@0.1.1-rc.2`, then expose it to previous DHSC installations through the existing Latest `update-manifest.json` check.

## Execution

- [x] Verify npm latest and official release tag/commit.
- [x] Rebase the exact-version locale, sidebar and persistent-Bash patches.
- [x] Refresh root and packaged first-launch runtime locks.
- [x] Add BETA3/updater version contracts and complete a local build.
- [x] Run `pnpm check` and the complete `pnpm test` chain.
- [x] Run `pnpm preflight:runtime` (56 artifacts, 35 production dependencies, 8 critical runtime packages, 10 bundled plugins).
- [ ] Submit PR, merge only after cloud CI is green, and sync local/remote `main`.
- [ ] Tag `v0.1.0-BETA3`; require the full native package matrix before Release publication.
- [ ] Verify GitHub Latest, published asset digests/sizes, and updater manifest.

## Rollback

Do not move Latest if native packaging fails. The previous verified BETA2-2 Release and source tag remain intact.
