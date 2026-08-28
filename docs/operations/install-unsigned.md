# Installing the Unsigned macOS Build

This is a community distribution and is not an official DeepSeek release. DeepSeek Harness Code `0.1.0-BETA6` is ad-hoc signed, not Apple-notarized. Verify the DMG source and checksum before proceeding.

## Prerequisite: official Node.js

The app runs on system-installed Node.js and does not download a portable runtime. Install Node.js 22.19 or newer in the 22.x line, or Node.js 24+, from [nodejs.org](https://nodejs.org/en/download). Node 23 is explicitly unsupported. Common install locations are detected automatically: the nodejs.org installer, Homebrew (`/opt/homebrew/bin`, `/usr/local/bin`), nvm, Volta, fnm, mise, and copies in standard bin directories. Version-manager roots with custom locations are honored through `NVM_DIR`, `VOLTA_HOME`, and `FNM_DIR`. If no usable Node is found, the app offers a guided dialog with a download link and a retry button.

The app's private `PATH` prepends the detected Node's bin directory and the bundled pnpm runtime, so native-module postinstall scripts find `node` even when the GUI launch PATH is minimal.

The Universal artifact follows `release/DeepSeek-Harness-Code-<version>-mac-universal.dmg` (for example, `0.1.0-BETA6`). Its checksum is published only after the final package verification succeeds. The same release also publishes a Universal `.zip` consumed by the user-confirmed updater.

After copying the app to Applications, remove quarantine only from this app:

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

Do not disable Gatekeeper globally and do not use `spctl --master-disable`.

Files downloaded or transferred by another application can receive quarantine again, which is why the targeted command remains part of the installation instructions.

## User-confirmed updates

From an installed app in `/Applications`, use 设置 → 通用 → 检查更新. The app fetches the GitHub `update-manifest.json`, verifies the selected platform artifact's SHA-256, then asks before downloading and replacing the app. It refuses DMG-mounted or Gatekeeper-translocated paths. Updates are never silently forced in the background.

The replacement target is platform-specific: macOS uses the installed `.app` bundle and its Universal ZIP; Windows invokes the NSIS installer with the running executable's directory so custom install locations remain selected; Linux AppImage uses the persistent `$APPIMAGE` path instead of the temporary mount, while `.deb` packages require a manual package-manager update. The downloader also rejects any manifest or ranged/streamed installer larger than 512 MiB. Native Windows/Linux replacement and macOS post-update launch validation still require their respective platform runners.

## First launch

On its first successful startup, the app keeps the shared DSH Home (`$DSH_HOME` when explicitly set, otherwise `~/.dsh`). It copy-merges supported data from the retired Electron-specific Home, installs the complete Code-DSH maintained family from bundled local tarballs, and reconciles bundled Web plugins through the public DSH CLI using the pnpm runtime inside the app. LAN access remains off until the user explicitly enables it in General settings. The app synchronizes Superpowers 6.2.0 under `<DSH_HOME>/skills`, installs the bundled Global Agent Operating Protocol as `<DSH_HOME>/AGENTS.md` when no global prompt exists yet, and atomically installs `anchored-standard` / `router-standard` / `router-spec` presets. Startup does not install or modify a global `dsh`. Existing target files, unrelated plugins, unmarked user-owned Skills or Agent Presets, and a user-authored global prompt are never overwritten; the app menu's "Use Bundled Global Prompt…" switches an existing prompt to the bundled one with a timestamped backup. See the [migration runbook](./harness-home-migration.md).

## Verify installation

```bash
node scripts/verify-macos-artifact.mjs release/DeepSeek-Harness-Code-*.dmg --universal
```

The verifier mounts the DMG read-only and checks the maintained Harness provenance and local tarball hashes, runtime and plugin closure, Anchored Standard provenance, SHA-256 routing digests, ad-hoc signature, and Universal Mach-O architecture.
