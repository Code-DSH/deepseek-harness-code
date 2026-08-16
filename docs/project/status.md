# Project Status

- Phase: every fetched local/remote branch change is consolidated into `main` — the cloud pull request
  [Code-DSH/deepseek-harness-code#3](https://github.com/Code-DSH/deepseek-harness-code/pull/3) was merged
  (merge commit `dc245bc`), and local `main` is fast-forwarded and fully in sync with `origin/main`.
- Current milestone: first public preview release **DeepSeek Harness Code (DHSC) 0.1.0-BETA1** — macOS
  Universal DMG and Windows NSIS installers; Linux (AppImage/deb) builds follow in a later release.
- Repository: `https://github.com/Code-DSH/deepseek-harness-code` (public)
- Release: tagged `v0.1.0-BETA1` as a GitHub pre-release (see `docs/releases/v0.1.0-BETA1.md`)
- Integrated surface: official Harness Home resolution, copy-only legacy migration, application-bundled
  pnpm launcher, six-package public `dsh plugin --profile web add` coordination, bare-package loader
  restoration, checksum-pinned Routing Suite resources (`dsh-ui-motion@1.0.0`,
  `dsh-model2-selector@1.0.0`, Super Injector, Mode Boost), `dsh-find-plugin@0.3.6`, bilingual managed
  presets (`anchored-standard`, `router-standard`, `router-spec`), Superpowers Skills, sandboxed desktop
  host, and independent Watchdog
- Built-in modes: Standard (default), progressive `anchored-standard`, managed `router-standard` and
  `router-spec` presets; plus native two-level model selector and UI-motion integration
- Release artifact: `release/DeepSeek-Harness-Code-0.1.0-BETA1-mac-universal.dmg`
  (221,134,518 bytes; SHA-256 `b1afaa874d00f1254c8d5542c64bc80969a804ad44d3ce96284c0ad73fcf25ce`; portable Node.js 24 downloaded on first launch instead of bundling node_modules; Windows x64 setup `f827a7a0e07f527a49019b09097356e67cbb0571db369034f8507729004ffd3c`; Windows arm64 setup `223c301a5d55d4032a08871e1e78673f44017f85a9eae2ccfb0c416ff6143f5d`)
- Build evidence: `pnpm dist:mac` exited 0; `pnpm verify:mac release/DeepSeek-Harness-Code-0.1.0-BETA1-mac-universal.dmg --universal`
  exited 0 after mounted-image plugin/runtime/signature/architecture checks; Windows NSIS installers
  built on native Windows runners through the tag-triggered packaging workflow
- Test scope: the previously completed full suite plus packaging build, runtime closure, six-plugin
  package closure, documentation links, formatting, and mounted-DMG verification
- Plugin snapshots: the earlier desktop state remains at `archive/desktop-plugin-before-app-merge-20260816`;
  release `0.1.0-BETA1` vendors the exact installed UI Motion and Model2 compiled closures under `packages/`
- Historical artifact: any earlier `0.3.x` DMG predates this complete integrated-plugin snapshot and must
  not be presented as the new build
- External limits: native Linux visual gates, live-provider soak, and paired V4 Pro capability validation
  remain pending; this macOS release is unsigned and not notarized
