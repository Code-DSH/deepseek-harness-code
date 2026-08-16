# DeepSeek Harness Code

Community desktop packaging for DeepSeek Harness with an Electron host, official-format Harness plugins, and an independent watchdog. This project is not an official DeepSeek release.

## Release targets

- macOS 12+ Universal App and unsigned/ad-hoc-signed DMG (`x86_64` + `arm64`)
- Windows NSIS configuration on native CI
- Linux AppImage and deb configuration on native CI

The application bundles Chromium, the Node runtime, Harness, and both local plugins. User settings, credentials, sessions, and logs remain in the operating system's user-data directory.

## Build and verify

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@11.19.0 -- pnpm test
npm exec --yes --package=pnpm@11.19.0 -- pnpm dist:mac
node scripts/verify-macos-artifact.mjs \
  release/DeepSeek-Harness-Code-0.2.0-mac-universal.dmg --universal
```

## Unsigned macOS installation

After copying the App to `/Applications`, a recipient who trusts the artifact can remove quarantine from this App only:

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

Do not disable Gatekeeper globally. See [the full unsigned installation guide](./docs/operations/install-unsigned.md), [architecture](./docs/architecture/overview.md), and [acceptance evidence](./docs/engineering/acceptance-report.md).

## Security boundary

The renderer has no Node integration. The public preload bridge exposes only `preferences` and `runtime` capability groups with validated payloads. Credentials are entered only through official Harness settings and must never be committed, logged, or pasted into issue reports.

The experimental Anchored Standard setting fails closed to Standard on the pinned Harness rc.6 public API; it does not intercept private model traffic or claim to control hidden chain-of-thought.
