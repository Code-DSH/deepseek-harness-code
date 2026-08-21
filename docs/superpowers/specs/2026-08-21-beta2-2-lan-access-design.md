# Beta2-2 LAN Access, Startup, and Workspace Boundary Design

- Date: 2026-08-21
- Status: confirmed by user
- Scope: `0.1.0-BETA2-2`

## Goal

Make ordinary Windows launches fast, keep model work scoped to its selected
workspace, and let a desktop user deliberately enable or disable LAN access
from a bundled Harness settings plugin.

## Decisions

- The default stays private: Harness remains bound to `127.0.0.1` and LAN
  access is disabled until the user turns it on.
- LAN mode starts a separate Electron-owned reverse proxy on `0.0.0.0` while
  keeping the Harness origin and the Electron renderer on loopback. The proxy
  creates a cryptographically random session token, accepts it once through a
  LAN URL, converts it into a strict HttpOnly cookie, then forwards HTTP and
  WebSocket traffic to loopback only. Disabling LAN mode closes the listener
  and invalidates the token.
- `dsh-lan-access` is an official-format bundled Web plugin. Its General
  settings row uses a deliberately narrow preload bridge to show LAN status,
  enable/disable access, and request a native copy action. The full
  token-bearing URL stays in the Electron main process: the renderer receives
  only redacted listener addresses and cannot read the token. It cannot invoke
  arbitrary IPC.
- Plugin reconciliation receives an app-owned success marker. The marker is
  valid only when this release's complete managed package identity and the
  expected managed pnpm store remain present. A cold install, release update,
  missing profile dependency, or foreign store still executes the official
  CLI reconciliation. A warm unchanged launch executes none of the serial
  `dsh plugin add` commands.
- The Windows Git-Bash compatibility tool must no longer bypass DSH's sandbox
  policy. It resolves the current session policy, submits exact argv through
  `ctx.sandbox`, and rejects a `workdir` outside the session workspace after
  canonicalization. The local `str_replace_editor` filesystem shadow is
  removed so edits use DSH's sandboxed provider. DSH rc.8 permits reads beyond
  the workspace by design; this release blocks the app-created bypass and
  broad-scan prompt path but does not make an unsupported claim of OS-level
  read confidentiality for arbitrary user shell code.

## Data Flow

```text
Settings → dsh-lan-access client → preload lanAccess bridge → fixed IPC
  → Electron LAN proxy start/stop + persisted setting
  → 0.0.0.0:ephemeral-port (token gate) → 127.0.0.1:Harness-port
```

The Electron renderer remains at `http://127.0.0.1:<Harness-port>` in both
modes, so its navigation allow-list is unchanged. The LAN URL is local-network
HTTP and therefore only appropriate for a trusted LAN; the UI makes that
boundary explicit and never stores the bearer token on disk.

## Verification

- Unit-test warm plugin reconciliation, cache invalidation, and foreign-store
  recovery.
- Unit/integration-test token-gated proxy forwarding, rejected unauthenticated
  requests, WebSocket upgrade forwarding, close/invalidation, and `0.0.0.0`
  listener configuration.
- Unit-test desktop IPC schemas and the client plugin's enabled/disabled UI
  behavior.
- Run the full project suite, structural checks, runtime closure checks, and
  platform package CI after the version/tag release.
- Launch the built macOS app with isolated Harness/App data, use Computer Use
  to verify the installed LAN plugin row, enable it, authenticate through the
  reported LAN URL, disable it, and confirm the listener is gone.

## Non-goals

- No unauthenticated direct binding of the Harness server.
- No internet exposure, NAT traversal, TLS certificate management, or
  persistent LAN credentials.
- No claim that the upstream Windows ACL sandbox confines all reads; that
  requires an upstream kernel-grade read isolation backend.
