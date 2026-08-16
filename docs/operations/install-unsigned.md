# Installing the Unsigned macOS Build

This is a community wrapper and is not an official DeepSeek release. DeepSeek Harness Code is ad-hoc signed, not Apple-notarized. Verify the DMG source and checksum before proceeding.

The renamed Universal artifact follows `release/DeepSeek-Harness-Code-<version>-mac-universal.dmg`. Its checksum is published only after the final package verification succeeds.

After copying the app to Applications, remove quarantine only from this app:

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"
```

Do not disable Gatekeeper globally and do not use `spctl --master-disable`.

Files downloaded or transferred by another application can receive quarantine again, which is why the targeted command remains part of the installation instructions.
