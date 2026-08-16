# Installing the Unsigned macOS Build

This is a community wrapper and is not an official DeepSeek release. DeepSeek Harness Code is ad-hoc signed, not Apple-notarized. Verify the DMG source and checksum before proceeding.

The renamed Universal artifact follows `release/DeepSeek-Harness-Code-<version>-mac-universal.dmg`. Its checksum is published only after the final package verification succeeds.

After copying the app to Applications, remove quarantine only from this app:

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

Do not disable Gatekeeper globally and do not use `spctl --master-disable`.

Files downloaded or transferred by another application can receive quarantine again, which is why the targeted command remains part of the installation instructions.

## First launch

On its first successful startup, the app uses the official Harness Home (`$DSH_HOME` when explicitly set, otherwise `~/.dsh`). It copy-merges supported data from the retired Electron-specific Home, installs all bundled plugins through the official CLI using the pnpm runtime inside the app, and synchronizes Superpowers 6.2.0 under `<DSH_HOME>/skills`. Existing target files, unrelated plugins, and unmarked user-owned Skills or Agent Presets are never overwritten. See the [migration runbook](./harness-home-migration.md).
