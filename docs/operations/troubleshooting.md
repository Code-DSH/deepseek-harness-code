# Troubleshooting

Use the application menu's **Open Logs** action. Logs are stored in the app user-data directory (`app.getPath('userData')/logs` + `watchdog/`), rotate at 10 MB, retain at most five files, and redact authentication material and request bodies. Search for `[DeepSeek Harness Code]` prefixed lines for startup diagnostics.

The desktop application installs native Edit roles for Undo, Cut, Copy, Paste, and Select All. Use `Cmd+V` on macOS or `Ctrl+V` on Windows/Linux. macOS also accepts `Control+V` through a fixed internal preload-to-main paste event; it accepts only a trusted keyboard event, rejects synthetic page-script events, is not exposed on `window.deepseekDesktop`, and cannot run arbitrary clipboard or shell operations.

If automatic desktop recovery reaches three abnormal exits in five minutes, the watchdog writes a crash-loop marker (`watchdog/crash-loop.json`) and stops. Launch the app manually after inspecting the Electron, Harness, and watchdog logs. Remove the marker after fixing the root cause to re-enable auto-restart.

Harness rc.8 does not expose a working `/api/health` endpoint. A 404 there is expected; desktop readiness is the live child plus an HTTP 2xx response from the loopback Web root (`127.0.0.1:<port>`). Three consecutive failed 5 s probes or a child exit triggers serialized recovery.

Routing Suite and bundled Skills installation is optional and fail-open. A `routing-suite-unavailable` or `routing-suite-conflict` notice means Standard Harness startup continued without replacing user-owned presets; inspect the log lines prefixed `[DeepSeek Harness Code]`. Background routing refresh does not exist — routing is immutable per app release.

Vision-router issues: ensure a `+ Auto Vision` model group is selected before sending images; pure-text `opencode-go` routes reject images before the vision chain runs. Check **Settings → Plugins → Plugin config → 视觉路由** for chain order and proxy settings. Pixel tools require `sharp`/`potrace`/`tesseract`/Chrome; missing `sharp` in a profile produces a runtime guidance message.

Better-sidebar: external plugins register via `ctx.betterSidebar`; if the sidebar fails to mount, check `pnpm test:mount` and verify no `client-editor.js` chunk is missing.

The packaged app intentionally does not use ASAR (`asar: false`). Re-enabling ASAR without also changing rc.8 package discovery can produce an empty `window.__DSH_BOOT__.entries` list and a blank or incomplete UI. The app requires system Node >=22.13; missing Node surfaces a guided dialog at startup.

If the Harness child exits immediately with a missing bare package (e.g., `dsh-super-injector`), confirm `build/routing-suite/versions.json` SHA-256 pins match and that `pnpm build:routing-suite` passed before `pnpm dist:mac`.
