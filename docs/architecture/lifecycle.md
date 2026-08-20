# Lifecycle

## Startup

The host shows the packaged local startup page (`apps/desktop/src/startup.html`), resolves the official Harness Home (`$DSH_HOME` or `~/.dsh` via `@deepseek-ai/dsh-home-paths@0.1.0-rc.8`), copy-merges allow-listed data from the retired Electron-specific Home without deletion or overwrite, and asks the public plugin CLI (`dsh plugin --profile web add`) to reconcile every bundled Web plugin (desktop, ui-motion, model2, ui-polish, updater-check, prompt-principles, vision-router, better-sidebar, composition, superpowers, injector, mode-boost, find-plugin) using the auto-detected system Node (>=22.13) and bundled pnpm runtime. It then synchronizes app-owned Skills (Superpowers 6.2.0) and Agent Presets (`anchored-standard`, `router-standard`, `router-spec`) plus the Global Agent Prompt, provisions the global `dsh` CLI via `npm install -g` (fail-open), allocates a loopback port, starts `dsh web --host 127.0.0.1 --port <port> --expose-internals`, and loads Harness only after the child is alive and the verified Web root responds 2xx. Each request has a five-second timeout and readiness has a 30-second outer window. A bind race is retried at most three times and only explicit `EADDRINUSE` evidence is retryable. In Harness 0.1.0-rc.8, `/api/health` and `/api/` return 404, so neither is used.

Every `BrowserWindow` creation path is registered after Electron's `app.whenReady()` promise resolves, including the macOS `activate` recovery path. The Harness child starts with `--expose-internals`, which restores the pinned loader's native bare-package resolution under Electron. Injector, Mode Boost, and `dsh-find-plugin` therefore retain their upstream bare names; the official CLI owns all Web-profile files. A real isolated Electron Node-mode test installs the actual integrated packages with bundled pnpm, starts rc.8, and serves the desktop client from the resulting boot graph (39+ entries).

## System Node Resolution

The host resolves the system official Node.js (>=22.13, no upper bound) by scanning PATH, common install locations (nodejs.org installer `/usr/local/bin`, Homebrew `/opt/homebrew/bin` + `/usr/local/bin`, nvm default/latest, Volta, fnm, mise, `n`, Scoop, nvm-windows, Chocolatey), and version-manager roots (`NVM_DIR`, `VOLTA_HOME`, `FNM_DIR`), including GUI launches whose PATH excludes them. Parsing uses `node --version` and rejects below-floor versions. The resolved Node's bin directory is prepended to the child's private `PATH` together with the bundled pnpm runtime, so native-module postinstall scripts find `node` even under a minimal GUI `PATH`.

## Recovery

The implemented host probes every five seconds without overlapping probes. Three consecutive failed probes or a current-child exit restarts Harness, serializes concurrent recovery, retires the old child first, and reloads the newly allocated origin. Renderer failure rebuilds the window without terminating Harness. An unresponsive renderer must remain unresponsive for 30 seconds before reload; a responsive event cancels it. The implemented Watchdog (`packages/watchdog`, `apps/desktop/src/lifecycle/watchdog-host.ts`) restarts an abnormally disconnected desktop process after five seconds for the first crash and ten seconds for the second, then exits its own process to avoid leaking a detached helper. The third abnormal disconnect within five minutes writes the crash-loop marker (`crash-loop.json`) and does not perform the otherwise theoretical twenty-second restart.

## Shutdown

The first window close asks once and persists either minimize-to-tray or quit; General settings can change it later. A persistent native Tray exposes Open, Restart Harness, Open Logs, and Quit on every desktop platform, while macOS keeps its Dock icon. macOS uses a transparent template image generated from the official black mark; Windows and Linux use the complete Code product icon. Quit disables new operations, cancels recovery, awaits the Watchdog `shutdown` → `shutdown-ack` IPC handshake (bounded timeout), sends Harness SIGTERM, waits at most eight seconds for disposal, then escalates to SIGKILL. A bounded Watchdog handshake timeout disconnects the helper so normal exit cannot remain blocked forever.

Runtime state delivery is an observer only. If the renderer has already been destroyed, its `Object has been destroyed` exception is isolated and cannot interrupt Harness retirement. A real regression run confirmed the former orphan child now exits during normal quit.

## Streaming Stall

Ninety seconds without stream activity surfaces a waiting/connection status. A healthy service is never killed and a model request is never replayed automatically.

## Related

- [System overview](./overview.md) · [Project intent](../project/intent.md) · [Testing](../engineering/testing.md) · [Troubleshooting](../operations/troubleshooting.md)
