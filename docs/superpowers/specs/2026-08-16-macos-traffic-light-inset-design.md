---
id: design.macos-traffic-light-inset
title: macOS Traffic-Light Equal-Inset Design
summary: Keep native macOS traffic lights in the underlay title bar with equal 16-point left and top insets, without adding a Web title bar.
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

The Electron window continues to use `titleBarStyle: "hiddenInset"` and the native traffic-light controls. Harness Web content continues to extend to the top of the window. No HTML, CSS, toolbar, title-bar spacer, or Window Controls Overlay is added to create the alignment.

## Architecture and behavior

- `createWindowChromeOptions("darwin")` remains the single source of BrowserWindow chrome configuration.
- Its `trafficLightPosition` is `{ x: 16, y: 16 }`.
- The position is provided at BrowserWindow construction time. The app does not reapply it after `ready-to-show`, on resize, or after navigation.
- Windows and Linux retain the native default title bar and receive no traffic-light position.
- Startup and Harness renderer layouts are unchanged; this change affects native window chrome only.

## Compatibility rationale

Electron defines `trafficLightPosition` as a macOS native `Point`. Equal point values express the required geometry independently of Retina backing scale and avoid measuring screenshot pixels. Keeping the native controls and a constructor-time position avoids SDK-specific Web layout compensation.

The project supports macOS 12 through 27. Automated tests validate the platform-independent configuration contract. Native visual acceptance must be recorded separately for representative macOS 15 and macOS 26-or-newer runs; a test executed on one macOS version must not be reported as evidence for another.

## Testing and acceptance

1. A unit test must fail against the current `{ x: 16, y: 6 }` configuration and require `{ x: 16, y: 16 }`.
2. The test must explicitly assert equal horizontal and vertical insets, not only snapshot an object.
3. Existing non-macOS assertions must remain green.
4. Type checking, the targeted unit test, and the applicable full unit suite must pass.
5. A packaged or development Electron window must be visually inspected on the available macOS host. The report records the actual OS and Electron binary SDK rather than extrapolating them.
6. Release acceptance retains an external macOS 15 visual gate if no macOS 15 host is available during implementation.

## Risks and non-goals

- This change does not alter native traffic-light size or inter-button spacing.
- It does not move or pad the Harness wordmark, sidebar, startup page, or other Web surfaces.
- It does not claim that an SDK-only build check substitutes for running on the target OS.
- If Apple or Electron changes native point semantics in a future release, the project will revalidate the geometry rather than add an unverified Web offset.

## Related documents

- Parent design: [DeepSeek Harness Code desktop design](./2026-08-16-deepseek-harness-code-design.md)
- Architecture: [Architecture overview](../../architecture/overview.md)
- Engineering validation: [Testing](../../engineering/testing.md)

## Change log

- `2026-08-16T12:20:00+08:00` — Recorded the user-approved equal 16-point native traffic-light inset and the no-Web-title-bar constraint.
- `2026-08-16` — Implemented the 16-point equal inset in the BrowserWindow constructor configuration and added an explicit equality regression assertion.
