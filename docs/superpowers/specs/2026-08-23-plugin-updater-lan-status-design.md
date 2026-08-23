---
id: superpowers.specs.plugin-updater-lan-status
title: Plugin-owned updater UI and LAN status stream
summary: Keep the official Harness source untouched while moving update UI into dsh-updater-check and exposing only read-only, authenticated LAN progress.
kind: architecture
status: draft
content_stage: goal-only
scope:
  - desktop updater
  - dsh-updater-check plugin
  - trusted LAN proxy
triggers:
  - 更新弹窗
  - 下载进度
  - 内网 HTTP 更新状态
read_when:
  - 修改更新 UI 或远端状态展示
skip_when:
  - 只修改安装器平台替换实现
priority: must
freshness_class: project
last_verified: 2026-08-23T12:20:00+08:00
owners:
  - DeepSeek Harness Code contributors
source_of_truth:
  - apps/desktop/src/updater/
  - packages/dsh-updater-check/
related:
  prerequisites:
    - ./2026-08-18-auto-updater-design.md
  next:
    - ../plans/2026-08-23-plugin-updater-lan-status.md
supersedes: []
tags:
  - updater
  - plugin
  - lan
  - electron
---

# Plugin-owned updater UI and LAN status stream

## Goal

Keep `@deepseek-ai/dsh` and its official Harness source unchanged. The
`dsh-updater-check` official-format plugin owns all user-facing update UI,
while the Electron host owns the smallest privileged capability needed to
check, download, verify, replace, and restart the desktop application.

## Contract

- Desktop Electron UI uses the fixed preload `updater` capability.
- The preload capability includes `getStatus()` and `subscribe()` so a newly
  mounted plugin can render the current state before the next event.
- LAN browsers receive read-only status from the Electron-owned proxy:
  - `GET /__dsh/update/status` returns one JSON `UpdaterStatus` snapshot.
  - `GET /__dsh/update/events` returns an authenticated `text/event-stream`.
    The first event is the current snapshot; later events are emitted whenever
    the host status changes.
- LAN status routes use exactly the existing proxy authentication. Empty
  password means trusted-LAN direct access; configured password means browser
  Basic Auth. No new token or credential is returned to the plugin.
- LAN clients cannot invoke update, replace, or restart actions. Their UI says
  to confirm the update on the host desktop.
- The proxy never forwards the two status routes to Harness. They are
  no-store, same-origin read-only routes handled before upstream forwarding.

## State flow

```text
UpdaterHost
  -> status store (current snapshot + subscribers)
      -> Electron preload updater.getStatus/subscribe
          -> dsh-updater-check desktop panel
      -> LAN proxy status JSON/SSE
          -> dsh-updater-check remote read-only panel
```

The update state remains the existing finite set: `idle`, `checking`,
`up-to-date`, `available`, `downloading`, `verifying`, `ready-to-restart`, and
`failed`. Download progress carries `downloadedBytes` and `totalBytes` from the
verified manifest asset; the UI displays both percentage and byte counts when
the values are available.

## UI behavior

- The plugin injects the General settings update row.
- The plugin also mounts one update panel/overlay, with no duplicate preload
  overlay.
- Desktop mode supports check, download, and restart actions through the
  preload bridge.
- Remote HTTP mode subscribes to SSE (with a polling fallback) and displays
  progress, verification, ready-to-restart, and failure states. It never shows
  an actionable remote restart button.
- Closing the panel only hides it; it does not cancel an in-progress download.

## Security and compatibility

- The official Harness package, its question/session protocol, and its source
  rendering remain unchanged.
- Update bytes still come only from the allow-listed HTTPS updater flow and
  must pass size and SHA-256 checks before the ready state.
- Status payloads contain phase, version, release notes, byte counts, and a
  bounded error message only. Passwords, bearer tokens, cookies, prompts, and
  Harness responses are excluded.
- LAN remains trusted-LAN HTTP, not public Internet exposure or TLS.

## Acceptance

1. A desktop user can check, see the plugin-owned update panel, observe live
   download progress, see verification, and choose restart after the verified
   asset is ready.
2. A LAN browser can see the same read-only live state through the authenticated
   proxy without receiving Electron IPC or update mutation capabilities.
3. Status subscribers receive the current snapshot immediately and do not miss
   the state that was published before the UI mounted.
4. Unit, plugin, LAN browser, type, lint, format, documentation, security, and
   Universal DMG verification gates pass.

## Non-goals

- No changes to official DeepSeek Harness source or private wire protocols.
- No silent/background update or remote update trigger.
- No public Internet/TLS service.
- No differential download or cross-device update coordination.

## Related documents

- Parent: [Superpowers specs](../index.md)
- Existing updater design: [Auto-updater design](./2026-08-18-auto-updater-design.md)
- LAN design: [LAN access design](./2026-08-21-beta2-2-lan-access-design.md)

## Change log

- 2026-08-23 — Design approved in chat: plugin-owned UI, host-only mutation, and authenticated read-only LAN status.
