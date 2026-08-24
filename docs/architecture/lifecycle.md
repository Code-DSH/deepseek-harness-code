# Lifecycle

## Startup

The host shows the packaged local startup page, resolves `DSH_HOME` or `~/.dsh`, copy-merges allow-listed data from the retired Electron-specific Home without deletion or overwrite, and validates its app-owned reconciliation marker. When the app-owned runtime is absent or its lock changes, bundled pnpm installs the complete local Code-DSH family and exactly locked external dependencies while the startup window remains responsive. The public `dsh plugin --profile web add` command reconciles bundled Web plugins; the complete runtime supplies subagent packages, so no `linkOnly` manifest cleanup is performed. Skills, presets, and the global prompt retain ownership-safe synchronization. Startup never executes a global npm install, then launches `dsh web --host 127.0.0.1 --port <port> --no-open --expose-internals`.

LAN access stays disabled until the user enables the `dsh-lan-access` setting. Opt-in starts a separate Electron-owned, authenticated reverse proxy on `0.0.0.0`; every native Copy action signs a fresh one-time URL token in Electron main and invalidates any prior unredeemed token. Redeeming that URL yields an HttpOnly cookie, which forwards only authenticated HTTP/WebSocket traffic to the unchanged loopback Harness. The Electron renderer remains at the loopback origin in both modes. The token-bearing URL is never returned through the renderer bridge. Disabling LAN access closes the listener and invalidates its credentials. The setting warns that this is HTTP for a trusted LAN only, not Internet exposure or TLS.

Every `BrowserWindow` creation path is registered after `app.whenReady()`. One lifecycle authority owns readiness, launch, updater scheduling, and shutdown; startup is single-flight. The maintained Harness child starts with `--expose-internals`, retaining native bare-package resolution. A real isolated Electron Node-mode test installs the integrated packages with bundled pnpm, starts the maintained family, and serves the desktop client from the resulting boot graph.

## System Node Resolution

The host scans PATH, common installer locations, Homebrew, nvm, Volta, fnm, mise, `n`, Scoop, nvm-windows, Chocolatey, and configured version-manager roots. Every candidate is queried with `node --version`; Node 22.19+ and 24+ are accepted, Node 23 and older 22.x releases are rejected before package installation. The resolved Node bin and bundled pnpm runtime are prepended only to the child environment.

## Recovery

The implemented host probes every five seconds without overlapping probes. Three consecutive failed probes or a current-child exit restarts Harness, serializes concurrent recovery, retires the old child first, and reloads the newly allocated origin. Renderer failure rebuilds the window without terminating Harness. An unresponsive renderer must remain unresponsive for 30 seconds before reload; a responsive event cancels it. The implemented Watchdog (`packages/watchdog`, `apps/desktop/src/lifecycle/watchdog-host.ts`) restarts an abnormally disconnected desktop process after five seconds for the first crash and ten seconds for the second, then exits its own process to avoid leaking a detached helper. The third abnormal disconnect within five minutes writes the crash-loop marker (`crash-loop.json`) and does not perform the otherwise theoretical twenty-second restart.

## Shutdown

The first window close asks once and persists either minimize-to-tray or quit; General settings can change it later. A persistent native Tray exposes Open, Restart Harness, Open Logs, and Quit on every desktop platform, while macOS keeps its Dock icon. macOS uses a transparent template image generated from the official black mark; Windows and Linux use the complete Code product icon. Quit disables new operations, cancels recovery, awaits the Watchdog `shutdown` → `shutdown-ack` IPC handshake (bounded timeout), sends Harness SIGTERM, waits at most eight seconds for disposal, then escalates to SIGKILL. A bounded Watchdog handshake timeout disconnects the helper so normal exit cannot remain blocked forever.

Runtime state delivery is an observer only. If the renderer has already been destroyed, its `Object has been destroyed` exception is isolated and cannot interrupt Harness retirement. A real regression run confirmed the former orphan child now exits during normal quit.

The updater publishes host-owned status through the fixed `updater:changed` bridge and renders an in-app overlay for update availability, byte progress, SHA-256 verification, and the final restart choice. Downloaded assets are not handed to the platform replacement helper until the user selects “Restart and complete update”; the helper then performs the verified replacement and relaunch.

Opt-in LAN access keeps Harness on loopback and uses the Electron proxy on all local interfaces. With an empty password the proxy forwards reachable same-LAN requests directly; with a password it challenges HTTP and WebSocket requests using browser Basic Auth and verifies a salted password hash. The proxy rewrites upstream absolute loopback redirects back to the requesting LAN origin, so a second device stays on the copied LAN URL through navigation and authentication. This remains trusted-LAN HTTP only: the host firewall must allow the selected port, both devices must be on the same reachable network, and guest Wi-Fi/client isolation can still block peer access.

## Streaming Stall

Ninety seconds without stream activity surfaces a waiting/connection status. A healthy service is never killed and a model request is never replayed automatically.

## Related

- [System overview](./overview.md) · [Project intent](../project/intent.md) · [Testing](../engineering/testing.md) · [Troubleshooting](../operations/troubleshooting.md)
