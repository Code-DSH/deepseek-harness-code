---
id: plan.beta3-release
title: BETA3 Upstream Upgrade and Release
summary: Upgrade the packaged Harness to 0.1.1-rc.2, preserve local patches, verify CI, and publish BETA3 through the existing updater channel.
kind: plan
status: canonical
content_stage: final-verified
scope: [dependencies, runtime, packaging, updater, release]
freshness_class: project
last_verified: 2026-08-22T12:20:00+08:00
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
- [x] Submit PRs [#30](https://github.com/Code-DSH/deepseek-harness-code/pull/30) and [#31](https://github.com/Code-DSH/deepseek-harness-code/pull/31), merge only after all 18 cloud checks are green, and sync local/remote `main` to `9762f8e`.
- [x] Tag `v0.1.0-BETA3`; full native package Run [32550253496](https://github.com/Code-DSH/deepseek-harness-code/actions/runs/32550253496) passed before Release publication.
- [x] Verify GitHub Latest, all nine published assets, and all five updater targets against GitHub asset SHA-256 digests and byte sizes.

## Rollback

Do not move Latest if native packaging fails. The previous verified BETA2-2 Release and source tag remain intact.

## Findings

- Initial tag Run `32548884725` correctly blocked publication: the packaged runtime workspace omitted the newly published `@deepseek-ai/dsh-authorization@0.1.1-rc.2` from `minimumReleaseAgeExclude`, so bundled pnpm 11 rejected the first-launch install while the root workspace passed.
- Mirroring that one policy entry removes the violation. An exact empty-store install with the bundled pnpm 11.19.0 then completed 724 production packages and native postinstalls in 234 seconds, below the 600-second packaged smoke deadline.
- Final Run `32550253496` passed macOS Intel/Apple Silicon, Windows x64/arm64, and Linux x64/arm64 native runtime plus no-Node gates. GitHub published [BETA3](https://github.com/Code-DSH/deepseek-harness-code/releases/tag/v0.1.0-BETA3) as non-prerelease Latest with eight installers and `update-manifest.json`.
