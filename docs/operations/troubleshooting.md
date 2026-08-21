# Troubleshooting

Use the application menu's **Open Logs** action. Logs are stored in the app user-data directory (`app.getPath('userData')/logs` + `watchdog/`), rotate at 10 MB, retain at most five files, and redact authentication material and request bodies. Search for `[DeepSeek Harness Code]` prefixed lines for startup diagnostics.

The desktop application installs native Edit roles for Undo, Cut, Copy, Paste, and Select All. Use `Cmd+V` on macOS or `Ctrl+V` on Windows/Linux. macOS also accepts `Control+V` through a fixed internal preload-to-main paste event; it accepts only a trusted keyboard event, rejects synthetic page-script events, is not exposed on `window.deepseekDesktop`, and cannot run arbitrary clipboard or shell operations.

If automatic desktop recovery reaches three abnormal exits in five minutes, the watchdog writes a crash-loop marker (`watchdog/crash-loop.json`) and stops. Launch the app manually after inspecting the Electron, Harness, and watchdog logs. Remove the marker after fixing the root cause to re-enable auto-restart.

Harness rc.8 does not expose a working `/api/health` endpoint. A 404 there is expected; desktop readiness is the live child plus an HTTP 2xx response from the loopback Web root (`127.0.0.1:<port>`). Three consecutive failed 5 s probes or a child exit triggers serialized recovery.

LAN access is disabled by default. When the user enables **LAN access** in its plugin settings, the separate Electron-owned proxy may listen on `0.0.0.0` while Harness and the desktop renderer stay on loopback. Treat its token-gated HTTP URL as trusted-LAN-only: it does not provide Internet exposure or TLS. Use the native **Copy** action rather than expecting the renderer to display the full token-bearing URL. Disable the setting to close the listener and invalidate the token.

If an unchanged warm launch unexpectedly reruns every official plugin addition, inspect the startup diagnostics for an invalid reconciliation marker. The expected fallback is intentional when the marker is absent, a managed package root or identity changed, a profile dependency is missing, or the detected store is foreign; the host then repeats the official reconciliation rather than trusting stale state.

Routing Suite and bundled Skills installation is optional and fail-open. A `routing-suite-unavailable` or `routing-suite-conflict` notice means Standard Harness startup continued without replacing user-owned presets; inspect the log lines prefixed `[DeepSeek Harness Code]`. Background routing refresh does not exist — routing is immutable per app release.

Vision-router issues: ensure a `+ Auto Vision` model group is selected before sending images; pure-text `opencode-go` routes reject images before the vision chain runs. Check **Settings → Plugins → Plugin config → 视觉路由** for chain order and proxy settings. Pixel tools require `sharp`/`potrace`/`tesseract`/Chrome; missing `sharp` in a profile produces a runtime guidance message.

Better-sidebar: external plugins register via `ctx.betterSidebar`; if the sidebar fails to mount, check `pnpm test:mount` and verify no `client-editor.js` chunk is missing.

The packaged app intentionally does not use ASAR (`asar: false`). Re-enabling ASAR without also changing rc.8 package discovery can produce an empty `window.__DSH_BOOT__.entries` list and a blank or incomplete UI. The app requires system Node >=22.13; missing Node surfaces a guided dialog at startup.

If first-launch package installation reports `ENOENT ... packages/patches/.mimosa/hook-state/sess_*.json`, the installed resources contain local tool-session state from an older build rather than a missing Node.js installation. Current builds exclude `.mimosa` from packaged patch/vendor resources and remove stale copies before invoking pnpm; reinstall the current build and retry detection.

If the Harness child exits immediately with a missing bare package (e.g., `dsh-super-injector`), confirm `build/routing-suite/versions.json` SHA-256 pins match and that `pnpm build:routing-suite` passed before `pnpm dist:mac`.

On Windows, custom Bash now follows the DSH session policy and rejects a canonicalized working directory outside the session workspace; `str_replace_editor` uses the host sandboxed filesystem. This narrows the app-created bypass but does not turn rc.8 into a universal read-isolation boundary: arbitrary user shell reads remain outside that promise, and a filesystem TOCTOU residual risk remains between canonical preflight and use.
