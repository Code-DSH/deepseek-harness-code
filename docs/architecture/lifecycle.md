# Lifecycle

## Startup

The host shows the packaged local startup page, resolves the official Harness Home, copy-merges allow-listed data from the retired Electron-specific Home without deletion or overwrite, and asks the public plugin CLI to reconcile every bundled Web plugin. It then synchronizes app-owned Skills and Agent Presets, allocates a loopback port, starts `dsh web`, and loads Harness only after the child is alive and the verified Web root responds successfully. Each request has a five-second timeout and readiness has a 30-second outer window. A bind race is retried at most three times and only explicit `EADDRINUSE` evidence is retryable. In Harness 0.1.0-rc.8, `/api/health` and `/api/` return 404, so neither is used.

Every `BrowserWindow` creation path is registered after Electron's `app.whenReady()` promise resolves, including the macOS `activate` recovery path. The Harness child starts with `--expose-internals`, which restores the pinned loader's native bare-package resolution under Electron. Injector, Mode Boost, and `dsh-find-plugin` therefore retain their upstream bare names; the official CLI owns all Web-profile files. A real isolated Electron Node-mode test installs the four actual integrated packages with bundled pnpm, starts rc.8, and serves the desktop client from the resulting boot graph.

## Recovery

The implemented host probes every five seconds without overlapping probes. Three consecutive failed probes or a current-child exit restarts Harness, serializes concurrent recovery, retires the old child first, and reloads the newly allocated origin. Renderer failure rebuilds the window without terminating Harness. An unresponsive renderer must remain unresponsive for 30 seconds before reload; a responsive event cancels it. The implemented Watchdog restarts an abnormally disconnected desktop process after one second for the first crash and two seconds for the second. The third abnormal disconnect within five minutes writes the crash-loop marker and does not perform the otherwise theoretical four-second restart.

## Shutdown

The first window close asks once and persists either minimize-to-tray or quit; General settings can change it later. A persistent native Tray exposes Open, Restart Harness, Open Logs, and Quit on every desktop platform, while macOS keeps its Dock icon. macOS uses a transparent template image generated from the official black mark; Windows and Linux use the complete Code product icon. Quit disables new operations, cancels recovery, awaits the Watchdog `shutdown` → `shutdown-ack` IPC handshake, sends Harness SIGTERM, waits at most eight seconds for disposal, then escalates. A bounded Watchdog handshake timeout disconnects the helper so normal exit cannot remain blocked forever.

Runtime state delivery is an observer only. If the renderer has already been destroyed, its `Object has been destroyed` exception is isolated and cannot interrupt Harness retirement. A real regression run confirmed the former orphan child now exits during normal quit.

## Streaming Stall

Ninety seconds without stream activity surfaces a waiting/connection status. A healthy service is never killed and a model request is never replayed automatically.
