# Troubleshooting

Use the application menu's **Open Logs** action. Logs are stored in the app user-data directory, rotate at 10 MB, retain at most five files, and redact authentication material and request bodies.

The desktop application installs native Edit roles for Undo, Cut, Copy, Paste, and Select All. Use `Cmd+V` on macOS or `Ctrl+V` on Windows/Linux. macOS also accepts `Control+V` through a fixed internal preload-to-main paste event; it accepts only a trusted keyboard event, rejects synthetic page-script events, is not exposed on `window.deepseekDesktop`, and cannot run arbitrary clipboard or shell operations.

If automatic desktop recovery reaches three abnormal exits in five minutes, the watchdog writes a crash-loop marker and stops. Launch the app manually after inspecting the Electron, Harness, and watchdog logs.

Harness rc.6 does not expose a working `/api/health` endpoint. A 404 there is expected; desktop readiness is the live child plus an HTTP 2xx response from the loopback Web root.

The packaged app intentionally does not use ASAR. Re-enabling ASAR without also changing rc.6 package discovery can produce an empty `window.__DSH_BOOT__.entries` list and a blank or incomplete UI.
