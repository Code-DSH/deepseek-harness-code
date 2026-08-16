---
id: design.stream-output-animation
title: Streaming Output and Thinking Indicator Animation Design
summary: Add layout-neutral dissolve effects to newly streamed assistant prose and reasoning, and replace the active bottom status with a breathing ThinkingOrb through the official desktop plugin.
kind: architecture
status: canonical
content_stage: implementation-backed
scope: [desktop-plugin, conversation, streaming-output, accessibility]
triggers:
  [streaming text, dissolve, generative-loaders, thinking-orbs, ThinkingOrb]
read_when:
  [implementing or validating assistant-output and active-thinking animations]
skip_when: [changing non-conversation desktop chrome or backend lifecycle]
priority: must
freshness_class: project
last_verified: 2026-08-16T13:56:03+08:00
owners: [primary-agent]
source_of_truth:
  [
    user-approved behavior,
    ../../../packages/desktop-plugin,
    pinned Harness rc.6,
  ]
related:
  prerequisites:
    [
      ./2026-08-16-deepseek-harness-code-design.md,
      ../../architecture/overview.md,
    ]
  next: []
supersedes: []
tags: [plugin, animation, streaming, reasoning, accessibility]
---

# Streaming Output and Thinking Indicator Animation Design

## Decision

Extend the existing official-format `deepseek-harness-desktop-plugin`; do not fork or patch the Harness conversation renderer.

While the current assistant step is streaming, newly appended grapheme clusters in assistant prose and reasoning receive a transient dissolve effect. The original Harness DOM remains the semantic and layout authority. The effect copies the rendered glyph's existing font and color, so normal output stays in its current color and reasoning stays in the current DeepSeek gray. It changes only transient paint properties such as opacity, blur, clipping, and particles.

While the conversation's bottom running status exists, its visible treatment becomes the exact bundled `thinking-orbs` component:

```jsx
<ThinkingOrb state="breathing" size={20} speed={2.0} />
```

The orb is removed when generation finishes, is aborted, or the active conversation changes. Completed reasoning continues to use the existing DeepSeek `Think` presentation; no completed-state orb is retained.

## Scope

- Animate only newly streamed assistant prose and reasoning text.
- Include prose nested in headings, lists, emphasis, and links when it is part of the eligible Markdown output region.
- Keep reasoning text gray and ordinary assistant text in its existing theme color.
- Preserve font family, style, weight, feature settings, size, line height, letter spacing, wrapping, and glyph position.
- Replace only the visible bottom running indicator while the model is active.
- Keep the feature inside the shipped official desktop plugin and package all required client code locally.

## Non-goals

- Do not animate user messages, historical content during hydration, code blocks, inline code, tool calls, tool results, terminal output, buttons, inputs, status labels, or other application chrome.
- Do not change Markdown parsing, syntax highlighting, reasoning disclosure behavior, message ordering, scroll anchoring, or selection/copy semantics.
- Do not render the full Markdown response through `TextLoader`.
- Do not add a backend service, network request, telemetry event, or persisted copy of generated text.
- Do not leave an orb or dissolve layer in completed conversations.

## Why `TextLoader` is not the layout renderer

`generative-loaders` `TextLoader` accepts a plain string and creates its own word and character wrappers. Harness output is a rich React/Markdown tree containing links, emphasis, lists, code, math, and interactive or semantic descendants. Replacing that tree with one string component would change markup, selection, accessibility, and potentially line wrapping.

The plugin therefore adapts the `dissolve` visual treatment into a namespaced, non-layout effect layer. It uses the same visual vocabulary—glyph fade, blur, reveal clipping, stagger, and particles—without transferring ownership of response layout to `TextLoader`. Only the minimum effect code and styles are carried, with the upstream MIT attribution recorded. `generative-loaders` is not added as an unused runtime dependency.

## Plugin architecture

The existing client plugin registers one additive controller in the official `shell.overlay` slot. The controller owns two independent services:

1. `StreamTextEffectController` observes eligible text changes under the currently streaming assistant step and manages transient dissolve masks and overlays.
2. `ThinkingStatusController` observes the current conversation's bottom running status and renders a bundled `ThinkingOrb` in the plugin-owned root overlay.

The controller does not shadow `conversation.chat.node`, duplicate the built-in assistant renderer, or depend on a private React component export. Compatibility with the pinned Harness renderer is isolated to a small DOM classifier and status-anchor adapter. If either adapter does not recognize the current DOM, it fails closed and leaves native Harness behavior intact.

## Streaming text data flow

### Eligibility and baseline

- A response is live only while it is inside the current assistant step marked by Harness as streaming.
- On controller startup, navigation, or attachment to an already-rendered stream, existing text becomes the baseline and does not animate retroactively.
- A centralized classifier accepts only text nodes inside renderer regions verified as assistant Markdown prose or reasoning content for pinned Harness rc.6.
- The classifier denies semantic code elements and all tool, terminal, control, live-status, and application-chrome regions before creating any effect.
- Text added after the baseline is segmented with `Intl.Segmenter` across the complete next string. The previous UTF-16 length must be a boundary in that segmentation, so emoji modifiers, ZWJ sequences, combining marks, and composed scripts are never detached from the preceding grapheme.

### Detecting appended output

- A scoped `MutationObserver` reacts to `characterData` and `childList` changes; there is no polling loop.
- Per-text-node snapshots distinguish an appended suffix from a rewrite.
- A strict prefix extension animates only the new suffix.
- A rewrite, Markdown reparse, node move, or shortening cancels effects for the affected node, reveals the canonical text immediately, records the new baseline, and waits for the next append. It never guesses a character mapping across structurally different DOM.
- Newly inserted eligible text during an established stream is treated as appended output. Static UI descendants added with it remain excluded by the classifier.

### Layout-neutral dissolve

1. React commits the canonical Harness text normally.
2. In one animation-frame read phase, the controller measures the appended grapheme ranges and reads their computed typography and color.
3. A CSS Custom Highlight masks only the canonical glyph paint for those ranges. Highlighting changes paint, not DOM structure or layout metrics.
4. An `aria-hidden="true"`, `pointer-events: none` fixed overlay draws the measured glyphs and dissolve particles in viewport coordinates. It copies the canonical computed font and `color`; particles use `currentColor`.
5. The effect removes each range mask as its animation completes. The final frame is the untouched Harness text.

All layout reads are batched before overlay writes. Scroll, resize, navigation, node removal, stream completion, or an animation safety timeout cancels affected overlays and reveals canonical text immediately. The overlay must never become a scroll or hit-test surface.

### Visual contract

- Animation duration and stagger follow the inspected `generative-loaders` dissolve treatment, tuned only if necessary to keep continuous token streams legible.
- Stable prefixes never replay when a new suffix arrives.
- Overlapping updates may share a batch. Under normal token streaming every eligible appended grapheme receives one dissolve reveal; a pathological burst beyond the hard live-node budget fails open by showing excess canonical text immediately.
- The effect does not set `font-family`, `font-size`, `line-height`, or a hard-coded foreground color on canonical content.
- Reasoning and answer output can stream concurrently in separate regions; each overlay samples its own source color.
- A final or cancelled response has no masks, particles, copied glyphs, or persistent animation classes.

## Active thinking indicator lifecycle

The built-in bottom running status is the lifecycle anchor because it already tracks the active generation state and unmounts at completion.

1. When the anchor appears, the plugin creates a non-layout host aligned to the anchor's leading edge and vertically centered on its existing line box. It mounts `ThinkingOrb` with `state="breathing"`, `size={20}`, `speed={2.0}`, and automatic theme behavior.
2. Only after the orb has mounted successfully does the plugin set the original status treatment to transparent. The original box keeps its dimensions, so the orb does not move the message list or change scroll anchoring.
3. The original status remains in the accessibility tree as the existing polite live region; the canvas orb is `aria-hidden` and does not create a duplicate announcement.
4. When the anchor disappears, the controller unmounts the orb, removes its host, and clears any temporary style marker.
5. If the package, portal, anchor, or mount fails, the native `Deep diving...` status stays visible.

The plugin does not infer completion from timers or token inactivity. Aborts, errors, session switches, and ordinary completion all follow the presence of the authoritative running-status anchor.

## Accessibility and user preferences

- Canonical Harness text remains in place for screen readers, copy, selection, find-in-page, and browser semantics.
- All visual duplicates and particles are hidden from assistive technology.
- The existing live-region text remains available while the visual orb is shown.
- With `prefers-reduced-motion: reduce`, appended text appears immediately without dissolve. The orb renders the package's reduced-motion/static presentation rather than continuously animating.
- Theme changes are sampled from the source text and the orb's automatic theme mode; no independent gray palette is introduced.
- Disabling animation through reduced motion requires no reload and cleans up any in-flight effect.

## Performance and cleanup

- Idle cost is zero polling and zero animation frames; observers only enqueue work after relevant mutations.
- Mutation handling observes the dynamic document body so newly mounted chat flows are discoverable, but the classifier rejects nodes outside the active streaming assistant selector before measurement.
- Reads and writes are frame-batched to avoid layout thrashing.
- The overlay has a hard ceiling of 120 live copied-glyph nodes and 24 particle-bearing glyphs (72 particle nodes). Pending visual work is also capped. Backpressure first removes particle density and then shows excess canonical text immediately; it never delays, masks, or alters canonical output.
- Every effect has an abort handle and a hard cleanup deadline.
- Route changes, conversation changes, plugin disposal, and renderer teardown disconnect observers, cancel frames, clear CSS highlights, unmount fixed hosts, and remove plugin-owned DOM.
- The controller never logs, stores, or sends response text.

## Dependencies, packaging, and attribution

| Item                  | Project state            | Design decision                                                                                                                                             |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thinking-orbs`       | Pinned `0.3.1`           | Bundled into `client.js`; React and `react/jsx-runtime` remain Harness-provided externals.                                                                  |
| `generative-loaders`  | Reference `0.1.1`        | Only the dissolve visual behavior is adapted for rich Harness DOM; the plain-string `TextLoader` and package are not bundled.                               |
| Client bundler        | Pinned esbuild `0.25.12` | Produces one deterministic offline client artifact from any working directory; preflight fails on unresolved third-party or local animation-module imports. |
| ReactDOM test runtime | Pinned `18.3.1`          | Development-only dependency used to mount the generated overlay with real React `createRoot`; it is not a plugin runtime external.                          |

The packaged application must not fetch either library from a CDN or resolve it from a developer checkout at runtime. The plugin package's file list and desktop runtime-closure tests must cover the bundled artifact. A third-party notices file records the MIT licenses and upstream project URLs.

## Failure handling and compatibility boundary

- Feature setup is isolated: a text-effect failure must not disable the orb, settings integration, page transitions, or the rest of the plugin.
- Missing CSS Highlight support disables the dissolve effect and leaves canonical text visible. It does not fall back to wrapping or rewriting React-owned text nodes.
- A changed or ambiguous Harness selector disables only the affected adapter and leaves native rendering/status visible.
- An exception during measurement or animation first clears every associated mask and fails open without emitting response content.
- Pinned-Harness integration tests treat a selector mismatch as a compatibility failure before packaging.

## Testing and acceptance

Implementation follows TDD and must cover these layers:

Automated implementation evidence now covers the unit/DOM, plugin contract, pinned-Harness boot, package closure, Chromium geometry/color/reduced-motion, and five-second idle gates below. A credentialed live-model visual pass through the actual Harness conversation renderer remains a separate manual acceptance activity; no provider credential was used for this implementation.

### Unit and DOM tests

1. Appended-suffix detection animates only new complete grapheme clusters, rejects modifier/ZWJ extensions of the previous grapheme, and does not replay stable text or newly attached hydrated streams.
2. Rewrites, shortened text, node replacement, and completion reveal canonical text and clear state.
3. Emoji, combining marks, CJK characters, and mixed scripts segment correctly.
4. The classifier accepts assistant prose and reasoning while rejecting code, inline code, tools, terminal output, controls, user content, and bottom status text.
5. Overlay styles copy computed typography and source color without hard-coded reasoning colors.
6. Reduced motion, scroll, resize, navigation, abort, and disposal clean up masks and overlays.
7. The orb mounts only after a running-status anchor exists, uses the approved props, and unmounts on completion.
8. If orb mounting or anchor recognition fails, the native status remains visible.
9. A 300-grapheme burst preserves all canonical text while keeping copied glyphs and particles within their hard budgets.

### Real Harness browser integration

1. Stream ordinary Markdown and reasoning through the pinned rc.6 renderer and observe dissolve only on newly appended eligible text.
2. Confirm reasoning remains the existing gray and assistant prose retains its existing theme color throughout the animation.
3. Compare message-container geometry before, during, and after the effect; line wrapping and bounding boxes must not move beyond subpixel measurement tolerance.
4. Confirm links, emphasis, lists, code, math, copy, selection, and screen-reader semantics remain owned by the original Harness DOM.
5. Confirm code blocks, tool output, terminal output, user messages, and rehydrated history do not animate.
6. Mount the generated overlay through real ReactDOM `createRoot`; confirm the bundled breathing 20-pixel, 2.0-speed Orb canvas commits before native status paint is hidden and disappears after normal completion, abort, error, session switch, or React unmount.
7. Confirm completed reasoning returns to the existing DeepSeek `Think` presentation.
8. Confirm reduced motion removes the dissolve and prevents continuous orb motion.

### Packaging and regression gates

1. Build the plugin client and assert that no unresolved `thinking-orbs` or animation-library import remains.
2. Boot the real Harness plugin graph from the packaged profile without a runtime network fetch.
3. Run plugin unit/DOM tests, Playwright acceptance, type checking, lint, formatting, documentation-link checks, and the applicable full test suite.
4. Re-run the idle performance probe and verify that this feature adds no perpetual animation frame or polling activity after generation stops.

## Alternatives considered

### Render the full response with `TextLoader`

Rejected because it converts rich Markdown to a plain-string-owned character tree, risking changed layout, lost semantics, duplicated content, and broken code or interactive descendants.

### Replace the official assistant-step renderer

Rejected because it duplicates upstream projection, Markdown, reasoning, and tool-block behavior and creates a large compatibility surface for a visual-only feature.

### Patch or fork Harness

Rejected because the existing official plugin can provide the behavior and a fork would complicate upgrades, packaging, and verification.

## External package evidence

| Retrieved  | Source                                                                                                                                                | Version/date          | Applicable conclusion                                                                                                       | Confidence | Revalidate                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------- |
| 2026-08-16 | [Generative Loaders documentation](https://generativeloaders.com/docs) and [official repository](https://github.com/kasturikhanke/generative-loaders) | npm `0.1.1` inspected | `TextLoader` is a plain-text renderer; its dissolve treatment can guide the plugin-owned visual layer.                      | High       | Before dependency or source update |
| 2026-08-16 | [Thinking Orbs site](https://orbs.jakubantalik.com/) and [official repository](https://github.com/Jakubantalik/thinking-orbs)                         | npm `0.3.1` inspected | `ThinkingOrb` supports the approved breathing state, 20-pixel size, 2.0 speed, theme handling, pausing, and reduced motion. | High       | Before dependency update           |

These facts apply to the pinned target versions only. A version change requires checking package exports, React compatibility, browser behavior, and license metadata again.

## Related documents

- Parent design: [DeepSeek Harness Code desktop design](./2026-08-16-deepseek-harness-code-design.md)
- Architecture: [Architecture overview](../../architecture/overview.md)
- Plugin validation: [Testing strategy](../../engineering/testing.md)
- Documentation map: [Documentation index](../../index.md)

## Change log

- `2026-08-16T13:00:00+08:00` — Recorded the user-approved official-plugin overlay design, dissolve scope, exact active-orb configuration, completion cleanup, and fail-open compatibility behavior.
- `2026-08-16T13:37:00+08:00` — Marked the design implementation-backed after deterministic bundling, TDD controller/status coverage, pinned-Harness boot, runtime closure, and Chromium geometry/idle verification.
