# Project Status

- Phase: every fetched local/remote branch change is consolidated into `main` — the cloud pull request
  [Code-DSH/deepseek-harness-code#3](https://github.com/Code-DSH/deepseek-harness-code/pull/3) was merged
  (merge commit `dc245bc`), and local `main` is fast-forwarded and fully in sync with `origin/main`.
- Current milestone: first public preview release **DeepSeek Harness Code (DHSC) 0.1.0-BETA1** — macOS
  Universal DMG and Windows NSIS installers; Linux (AppImage/deb) builds now pass in cloud CI and are
  ready for upcoming releases.
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
  (221,144,460 bytes; runs on the auto-detected system official Node.js >=22.13 instead of downloading a portable runtime or bundling node_modules; Windows x64 setup `25eb564b0003a0518ed16f86554fe96976be60fe0f70b8ea7fda130804732fd0`; Windows arm64 setup `aaa2a5ccd3ae52451c394e278eac22ccdc8fed3f0df36a43f1140d118794c878`)
- Build evidence: `pnpm dist:mac` exited 0; `pnpm verify:mac release/DeepSeek-Harness-Code-0.1.0-BETA1-mac-universal.dmg --universal`
  exited 0 after mounted-image plugin/runtime/signature/architecture checks; Windows NSIS installers
  built on native Windows runners through the tag-triggered packaging workflow; Linux AppImage/deb
  jobs also pass on ubuntu-latest runners in the tag-triggered packaging workflow
- Test scope: the previously completed full suite plus packaging build, runtime closure, six-plugin
  package closure, documentation links, formatting, and mounted-DMG verification
- Plugin snapshots: the earlier desktop state remains at `archive/desktop-plugin-before-app-merge-20260816`;
  release `0.1.0-BETA1` vendors the exact installed UI Motion and Model2 compiled closures under `packages/`
- Historical artifact: any earlier `0.3.x` DMG predates this complete integrated-plugin snapshot and must
  not be presented as the new build
- External limits: native Linux visual gates, live-provider soak, and paired V4 Pro capability validation
  remain pending; this macOS release is unsigned and not notarized
