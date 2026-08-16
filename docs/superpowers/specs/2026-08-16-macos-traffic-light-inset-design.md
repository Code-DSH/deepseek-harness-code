---
id: design.macos-traffic-light-inset
title: macOS Traffic-Light Equal-Inset Design
summary: Keep native macOS traffic lights over full-height Harness surfaces, with only the sidebar's inner content displaced below the controls.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop, macos, window-chrome]
triggers: [traffic lights, title bar, macOS window controls, hiddenInset]
read_when:
  [
    changing macOS BrowserWindow chrome or validating native window-control alignment,
  ]
skip_when: [changing only Harness Web content or non-macOS window chrome]
priority: must
freshness_class: project
last_verified: 2026-08-16T12:20:00+08:00
owners: [primary-agent]
source_of_truth:
  [user-approved geometry, ../../../apps/desktop/src/host-config.ts]
related:
  prerequisites: [./2026-08-16-deepseek-harness-code-design.md]
  next: [../plans/2026-08-16-macos-traffic-light-inset.md]
supersedes: []
tags: [electron, macos, traffic-lights, native-window]
---

# macOS Traffic-Light Equal-Inset Design

## Decision

The macOS red traffic-light button must have the same distance from the window's left edge as from its top edge. Both native-coordinate insets are fixed at 16 points. The green and yellow buttons retain the native macOS group spacing.

The Electron window continues to use `titleBarStyle: "hiddenInset"` and the native traffic-light controls. The Harness sidebar and main-content surfaces extend to the top edge, preserving their own background colors behind the controls. No HTML toolbar, title-bar component, full-width spacer, `body` padding, or Window Controls Overlay is added. Only the sidebar's existing inner content is displaced below the traffic-light safe area so its logo and controls cannot overlap the native buttons.

## Architecture and behavior

- `createWindowChromeOptions("darwin")` remains the single source of BrowserWindow chrome configuration.
- Its `trafficLightPosition` is `{ x: 16, y: 16 }`.
- The position is provided at BrowserWindow construction time. The app does not reapply it after `ready-to-show`, on resize, or after navigation.
- Windows and Linux retain the native default title bar and receive no traffic-light position.
- The renderer root and route surfaces retain full-window geometry. A macOS-only CSS rule may offset the sidebar's existing inner content, but never the `html`, `body`, renderer root, page grid, sidebar surface, or main surface.
- Windows and Linux receive no Web-content offset.

## Compatibility rationale

Electron defines `trafficLightPosition` as a macOS native `Point`. Equal point values express the required geometry independently of Retina backing scale and avoid measuring screenshot pixels. Keeping the native controls and a constructor-time position avoids SDK-specific Web layout compensation.

The project supports macOS 12 through 27. Automated tests validate the platform-independent configuration contract. Native visual acceptance must be recorded separately for representative macOS 15 and macOS 26-or-newer runs; a test executed on one macOS version must not be reported as evidence for another.

## Testing and acceptance

1. A unit test must fail against the current `{ x: 16, y: 6 }` configuration and require `{ x: 16, y: 16 }`.
2. The test must explicitly assert equal horizontal and vertical insets, not only snapshot an object.
3. A renderer contract test must prove that `body` and the page surfaces have no top padding while the sidebar's existing inner content has a macOS-only safe-area offset.
4. Existing non-macOS assertions must remain green.
5. Type checking, the targeted unit test, and the applicable full unit suite must pass.
6. A packaged or development Electron window must be visually inspected on the available macOS host. Acceptance requires the sidebar background to reach the rounded top-left corner, the main surface to reach its top edge, and no full-width blank band.
7. Release acceptance retains an external macOS 15 visual gate if no macOS 15 host is available during implementation.

## Risks and non-goals

- This change does not alter native traffic-light size or inter-button spacing.
- It does not pad or move the sidebar surface, main surface, startup page, or other route surfaces. Only the sidebar's inner content is moved below the native controls.
- It does not claim that an SDK-only build check substitutes for running on the target OS.
- If Apple or Electron changes native point semantics in a future release, the project will revalidate the geometry rather than add an unverified Web offset.

## Related documents

- Parent design: [DeepSeek Harness Code desktop design](./2026-08-16-deepseek-harness-code-design.md)
- Architecture: [Architecture overview](../../architecture/overview.md)
- Engineering validation: [Testing](../../engineering/testing.md)

## Change log

- `2026-08-16T12:20:00+08:00` — Recorded the user-approved equal 16-point native traffic-light inset and the no-Web-title-bar constraint.
- `2026-08-16` — Implemented the 16-point equal inset in the BrowserWindow constructor configuration and added an explicit equality regression assertion.
- `2026-08-16` — Clarified after packaged visual review that renderer backgrounds must reach the top edge; a global 40-pixel `body` inset is forbidden and only sidebar inner content may use the macOS safe area.
