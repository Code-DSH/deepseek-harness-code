# Project Status

- Phase: every fetched local/remote branch change is consolidated into `release/0.3.3-integrated-plugins`; official single-Home and public plugin-CLI integration now includes the complete installed Web plugin set
- Current milestone: the two installed local plugin closures are frozen; release preflight, Universal DMG construction, and mounted-artifact verification all complete with exit code 0
- Repository: `https://github.com/Open-Less/deepseek-harness-code` (public)
- Verified deliverables: official Harness Home resolution, copy-only legacy migration, application-bundled pnpm launcher, six-package public `dsh plugin --profile web add` coordination, bare-package loader restoration, checksum-pinned Routing Suite resources, `dsh-ui-motion@1.0.0`, `dsh-model2-selector@1.0.0`, bilingual managed presets, Superpowers Skills, sandboxed desktop host, independent Watchdog, and current APP build outputs
- Release artifact: `release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg` (289,838,445 bytes; SHA-256 `21835867dc474d39ad04b0de5f0825d1a409ccb2105c055e423e65e919a65cd8`)
- Build evidence: `pnpm dist:mac` exited 0; `pnpm verify:mac release/DeepSeek-Harness-Code-0.3.3-mac-universal.dmg --universal` exited 0 after mounted-image plugin/runtime/signature/architecture checks
- Test scope: per user direction, the previously completed full suite was not rerun; this release freshly passed the packaging build, 35-artifact runtime closure, six-plugin package closure, documentation links, formatting, and mounted-DMG verification
- Plugin snapshots: the earlier desktop state remains at `archive/desktop-plugin-before-app-merge-20260816`; release `0.3.3` additionally vendors the exact installed UI Motion and Model2 compiled closures under `packages/`
- Historical artifact: any `0.3.0` or `0.3.2` DMG predates this complete installed-plugin snapshot and must not be presented as the new build
- External limits: native Windows/Linux visual gates, live-provider soak, and paired V4 Pro capability validation remain pending; this local macOS release is unsigned and not notarized
