# Design: Auto-Download and Install Node at First Launch

**Date:** 2026-08-18
**Status:** Draft — awaiting user approval
**Classification:** Bounded (enhances existing Node detection + dialog flow)

## Revised Scope

**Node is NOT bundled in the installer.** The installer size stays as-is. The Electron app detects whether Node is available; if not, it downloads and installs Node for the user at first launch. Only the Electron app code and dialog styling change — no build/packaging changes, no DSH source changes, no repo linking (assigned to another agent).

## Requirements (from user)

1. **Detection:** (a) Check if Node exists in the user directory. (b) If not, perform a global Node installation for the user.
2. **Installation flow:**
   - (a) App opens → show a dialog.
   - (b) If the check fails → show a Node download interface; user can choose to download.
   - (c) Download succeeds → app auto-installs Node for the user.
   - (d) Download fails → user must install manually. Give them the **direct installer link** (`.pkg`/`.msi`), NOT the installer package itself. This link is **different** from the auto-download link (which is the binary archive `.tar.gz`/`.zip`).
3. Only change frontend (Electron app) code and styles.

## Architecture

### 1. Detection — user-directory Node

**Current:** `resolveSystemNode()` in `system-node.ts` checks PATH → known locations → version-manager dirs. It does NOT check the app's own user-local install location.

**Change:** Add the app-managed Node install location (`~/.local/share/dsh-node/<version>/bin/node` on macOS/Linux, `%LOCALAPPDATA%\dsh-node\<version>\node.exe` on Windows) to the detection order, checked after version-manager dirs. This way, a Node installed by the app in a previous session is detected and reused.

**Resolution order (updated):**

1. PATH entries (existing)
2. Known install locations — Homebrew, nodejs.org installer paths (existing)
3. Version-manager dirs — nvm, fnm, mise, Volta, n (existing)
4. **App-managed user-local install** (new) — `~/.local/share/dsh-node/<version>/bin/node`
5. **Bundled Node** — N/A (not bundled, per revised scope)

### 2. Download flow

**New file: `apps/desktop/src/lifecycle/node-downloader.ts`**

- Determines the correct Node binary archive URL for the current `process.platform` + `process.arch`:
  - macOS arm64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-arm64.tar.gz`
  - macOS x64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-x64.tar.gz`
  - Windows x64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-win-x64.zip`
  - Windows arm64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-win-arm64.zip`
  - Linux x64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-x64.tar.xz`
  - Linux arm64: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-arm64.tar.xz`
- Downloads to a temp file with progress reporting (passed to the dialog via IPC).
- Verifies SHA-256 checksum against the official `SHASUMS256.txt` from `https://nodejs.org/dist/v22.13.0/SHASUMS256.txt`.
- **Security:** Validates the host is `nodejs.org` (or `nodejs.org` CDN); rejects localhost, loopback, private, and reserved addresses before any request. Only `https` allowed.

### 3. Install flow

**New file: `apps/desktop/src/lifecycle/user-node-installer.ts`**

- Extracts the downloaded archive to `~/.local/share/dsh-node/<version>/` (macOS/Linux) or `%LOCALAPPDATA%\dsh-node\<version>\` (Windows).
- On macOS/Linux: extracts the `node` binary, `npm`, `npx`, and supporting files from the archive.
- On Windows: extracts the zip contents.
- Updates the user's shell profile to add the bin directory to PATH:
  - macOS/Linux: appends `export PATH="$HOME/.local/share/dsh-node/<version>/bin:$PATH"` to `.zshrc` (zsh) or `.bashrc` (bash). Backs up the file before modifying.
  - Windows: writes to `HKCU\Environment\Path` via `reg` command (avoids the 1024-char `setx` limit).
- Returns the path to the installed `node` binary.

### 4. Dialog UI

**Updated: `apps/desktop/src/main.ts` — `showNodeRequiredDialog()`**

Current dialog: "Retry detection" / "Open nodejs.org download page" / "Quit".

**New dialog flow:**

1. App opens → `resolveSystemNode()` runs.
2. If Node found → proceed normally (no dialog).
3. If Node NOT found → show dialog:
   - **Message:** "Node.js is required. The app can download and install it for you."
   - **Button 1 — "Download and install Node"**: triggers the download flow (with progress bar). On success → auto-install → retry detection → proceed. On failure → switch to the failure view (below).
   - **Button 2 — "Install manually"**: shows the **direct installer link**:
     - macOS: `https://nodejs.org/dist/v22.13.0/node-v22.13.0.pkg` (the `.pkg` installer)
     - Windows: `https://nodejs.org/dist/v22.13.0/node-v22.13.0-x64.msi` (or arm64 `.msi`)
     - **Note:** This link is DIFFERENT from the auto-download link (which is the `.tar.gz`/`.zip` binary archive). The auto-download link is for programmatic extraction; the manual link is the installer package the user runs themselves.
   - **Button 3 — "Retry detection"**: re-runs detection (in case the user installed Node externally).
   - **Button 4 — "Quit"**: exits the app.

4. **Download progress view:** Shows a progress bar and "Downloading Node.js v22.13.0..." text. Updates via IPC from the main process.

5. **Download failure view:** Shows: "Download failed. Please install Node.js manually." + the direct installer link (clickable, opens in browser) + "Retry" button.

### 5. Global DSH provisioning

**No changes to `global-cli-link.ts`.** The existing `ensureGlobalDshCli()` already uses the resolved Node's npm for `npm install -g @deepseek-ai/dsh@<pinned>`. Once the app-installed Node is on the PATH (via shell profile update), the global `dsh` command works in new terminal sessions.

### 6. Node version

Pinned to **v22.13.0** (the current minimum supported version). The version and SHA-256 checksums are pinned in the code (hardcoded for now; can be externalized to a config file later).

## Files Touched

| File                                                | Change                                                        |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `apps/desktop/src/lifecycle/system-node.ts`         | Add app-managed Node location to detection                    |
| `apps/desktop/src/lifecycle/node-downloader.ts`     | **New** — download + verify Node binary archive               |
| `apps/desktop/src/lifecycle/user-node-installer.ts` | **New** — extract + install to user dir + update PATH         |
| `apps/desktop/src/main.ts`                          | Enhance `showNodeRequiredDialog()` with download/install flow |
| `apps/desktop/src/startup.html`                     | Update dialog styling (if dialog is HTML-based)               |
| `tests/unit/system-node.test.ts`                    | Add tests for app-managed Node detection                      |
| `tests/unit/node-downloader.test.ts`                | **New** — URL selection, checksum verification                |
| `tests/unit/user-node-installer.test.ts`            | **New** — extraction, PATH update                             |

## Testing

- **Unit:** URL selection per platform/arch, SHA-256 verification logic, PATH update logic (shell profile modification), app-managed Node detection.
- **Integration:** Download → extract → detect → launch flow end-to-end (mocked download for CI).
- **Manual:** Test on a clean macOS/Windows/Linux machine without Node.

## Security Constraints

- Download URLs are `https` only.
- Host validation: only `nodejs.org` and its CDN (`d29vzt9me.com` or similar Node.js CDN) are allowed.
- Reject localhost, loopback (127.0.0.0/8), private (10/8, 172.16/12, 192.168/16), and reserved addresses before any HTTP request.
- SHA-256 checksum verification of the downloaded archive against the official `SHASUMS256.txt`.

## Risks

| Risk                                      | Mitigation                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Shell profile modification is intrusive   | Only done when user clicks "Download and install." Back up profile before modifying. |
| Download fails (network issues)           | Fallback to manual installer link.                                                   |
| Node version gets stale                   | Pinned to v22.13.0; can be updated in a future release.                              |
| PATH conflict with existing Node installs | App-managed Node is prepended to PATH; existing system Node still works.             |
| Windows PATH update via registry          | Use `reg add HKCU\Environment` (not `setx` which has 1024-char limit).               |
