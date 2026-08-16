---
id: plan.stream-output-animation
title: Streaming Output Animation Implementation Plan
summary: Test-first implementation plan for layout-neutral assistant text dissolve effects and the active ThinkingOrb status in the official desktop plugin.
kind: plan
status: canonical
content_stage: goal-only
scope: [desktop-plugin, conversation, animation, packaging, validation]
triggers: [implementation, dissolve, thinking-orbs, streaming output]
read_when: [implementing or reviewing streaming output animations]
skip_when: [unrelated host, watchdog, or packaging work]
priority: must
freshness_class: project
last_verified: 2026-08-16T13:20:00+08:00
owners: [primary-agent]
source_of_truth: [../specs/2026-08-16-stream-output-animation-design.md]
related:
  prerequisites: [../specs/2026-08-16-stream-output-animation-design.md]
  next: [../../engineering/testing.md]
supersedes: []
tags: [execplan, tdd, plugin, animation]
---

# Streaming Output Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add layout-neutral dissolve effects to newly streamed assistant prose and reasoning and show a breathing 20-pixel ThinkingOrb only while the bottom model-running status is active.

**Architecture:** The existing official desktop plugin registers a root-scoped `shell.overlay` component. A DOM controller observes only pinned Harness rc.6 streaming assistant regions, temporarily masks appended grapheme paint with the CSS Custom Highlight API, and draws an accessibility-hidden fixed overlay; a separate status adapter maps the direct bottom running-status element to the bundled `ThinkingOrb`. Harness retains ownership of Markdown, reasoning, layout, semantics, and final text.

**Tech Stack:** JavaScript client plugin, React 18 peer runtime, `thinking-orbs@0.3.1`, `esbuild@0.25.12`, Harness `0.1.0-rc.6` slots, CSS Custom Highlight API, MutationObserver, Vitest/JSDOM, Playwright Chromium, pnpm 11.19.0.

## Global Constraints

- Extend `packages/desktop-plugin`; do not patch or replace the Harness conversation renderer.
- Animate only newly appended assistant prose and reasoning graphemes under `[data-chat-flow-kind="assistant-step"] [data-streaming]`.
- Never animate user text, rehydrated history, code, tools, terminal output, controls, or the bottom status label.
- Canonical Harness DOM remains selectable, accessible, searchable, and responsible for every layout metric.
- Copy computed typography and `color`; never hard-code the reasoning gray or change canonical font family, size, weight, line height, spacing, wrapping, or position.
- Use `ThinkingOrb` with `state="breathing"`, `size={20}`, and `speed={2.0}` only while `[data-chat-flow] > [role="status"][aria-live="polite"]` exists.
- Completion, abort, error, navigation, session switch, disposal, scroll, or resize must reveal canonical text and remove stale plugin-owned visual state.
- Reduced motion disables dissolve and relies on `thinking-orbs`' static reduced-motion frame.
- Bundle all third-party browser code into `packages/desktop-plugin/client.js`; no CDN or runtime developer-checkout resolution.
- Preserve existing question protocol, settings, transitions, and all user changes.

## File structure

- Create `packages/desktop-plugin/src/stream-output-model.js` for grapheme suffix detection and the fail-closed eligible-text classifier.
- Create `packages/desktop-plugin/src/stream-output-controller.js` for mutation observation, CSS Highlight masks, glyph/particle overlays, cancellation, and cleanup.
- Create `packages/desktop-plugin/src/thinking-status.js` for locating/measuring the authoritative bottom status and publishing lifecycle snapshots.
- Create `packages/desktop-plugin/src/conversation-effects.css` for namespaced fixed overlays, dissolve keyframes, transparent status paint, and reduced-motion rules.
- Create `packages/desktop-plugin/THIRD_PARTY_NOTICES.md` for `thinking-orbs` and the dissolve visual reference attribution.
- Create `packages/desktop-plugin/test/stream-output-model.test.ts`, `packages/desktop-plugin/test/stream-output-controller.test.ts`, and `packages/desktop-plugin/test/thinking-status.test.ts` for focused behavior.
- Modify `packages/desktop-plugin/src/client-runtime.js` to mount the root overlay component and compose both controller lifecycles.
- Modify `packages/desktop-plugin/scripts/build-client.mjs` to bundle local modules and `thinking-orbs` while preserving Harness-provided React/primitives as externals.
- Modify `packages/desktop-plugin/package.json` and `pnpm-lock.yaml` for exact dependency/build-tool versions, layout-slot ordering, and packaged notices.
- Modify `tests/e2e/plugin-contract.test.ts` and `tests/e2e/plugin-real-harness.test.ts` for official-slot, bundle-closure, and real boot-graph contracts.
- Create `tests/playwright/stream-output-animation.spec.ts` for browser-native Highlight API, geometry, exclusion, cleanup, and reduced-motion acceptance.
- Modify `AGENTS.md`, `docs/architecture/overview.md`, `docs/engineering/testing.md`, `docs/knowledge/upstream-baseline.md`, the approved design, and this plan only after implementation evidence exists.

---

### Task 1: Offline plugin client bundle and dependency contract

**Files:**

- Modify: `tests/e2e/plugin-contract.test.ts`
- Modify: `packages/desktop-plugin/package.json`
- Modify: `packages/desktop-plugin/scripts/build-client.mjs`
- Create: `packages/desktop-plugin/src/conversation-effects.css`
- Create: `packages/desktop-plugin/THIRD_PARTY_NOTICES.md`
- Modify: `pnpm-lock.yaml`
- Regenerate: `packages/desktop-plugin/client.js`

**Interfaces:**

- Consumes: current CommonJS-shaped `client-runtime.js`, `TRANSITION_STYLES`, and Harness ModuleLoader factory.
- Produces: deterministic `client.js`; compile-time `TRANSITION_STYLES` and `CONVERSATION_EFFECT_STYLES` string constants; exact `thinking-orbs@0.3.1`; exact development bundler `esbuild@0.25.12`.

- [x] **Step 1: Write the failing package and bundle test**

Add assertions to the deterministic bundle test:

```ts
const source = readFileSync(join(pluginRoot, "client.js"), "utf8");
expect(manifest.dependencies?.["thinking-orbs"]).toBe("0.3.1");
expect(manifest.devDependencies?.esbuild).toBe("0.25.12");
expect(manifest.files).toContain("THIRD_PARTY_NOTICES.md");
expect(source).not.toContain('require("thinking-orbs")');
expect(source).not.toContain('require("./stream-output-');
expect(source).toContain("deepseek-harness-desktop-plugin");
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-contract.test.ts
```

Expected: FAIL because the exact dependencies, notice, and bundled module pipeline do not exist.

- [x] **Step 3: Add exact dependencies with the workspace package manager**

Run:

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm --filter deepseek-harness-desktop-plugin add thinking-orbs@0.3.1
npm exec --yes --package=pnpm@11.19.0 -- pnpm --filter deepseek-harness-desktop-plugin add --save-dev esbuild@0.25.12
```

Add `THIRD_PARTY_NOTICES.md` to the plugin `files` list. Record the MIT copyright/license notices and official URLs for `thinking-orbs` and `generative-loaders`; do not copy response data or upstream source bodies into the notice.

- [x] **Step 4: Replace string-only assembly with deterministic esbuild output**

Use `build()` from `esbuild` in `build-client.mjs`:

```js
const result = await build({
  entryPoints: [join(packageRoot, "src", "client-runtime.js")],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: [
    "react",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-ui-primitives",
  ],
  define: {
    TRANSITION_STYLES: JSON.stringify(transitions),
    CONVERSATION_EFFECT_STYLES: JSON.stringify(conversationEffects),
  },
  legalComments: "none",
});
```

Wrap `result.outputFiles[0].text` in the existing `window.__ModuleLoader__.load({ id, factory })` envelope. Keep the factory-local `module`, `exports`, and Harness `require`; throw if esbuild produces other than one JavaScript output file. Create an initially namespaced `conversation-effects.css` with the fixed root contract so the compile-time constant is always defined.

- [x] **Step 5: Build and run the focused contract test**

Run:

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm --dir packages/desktop-plugin build:client
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-contract.test.ts
```

Expected: PASS; the generated client resolves only the three declared Harness externals and contains bundled `thinking-orbs` code.

- [x] **Step 6: Commit the bundle foundation**

```bash
git add packages/desktop-plugin/package.json packages/desktop-plugin/scripts/build-client.mjs packages/desktop-plugin/src/conversation-effects.css packages/desktop-plugin/THIRD_PARTY_NOTICES.md packages/desktop-plugin/client.js pnpm-lock.yaml tests/e2e/plugin-contract.test.ts
git commit -m "build: bundle conversation animation dependencies"
```

### Task 2: Appended-grapheme model and fail-closed classifier

**Files:**

- Create: `packages/desktop-plugin/src/stream-output-model.js`
- Create: `packages/desktop-plugin/test/stream-output-model.test.ts`

**Interfaces:**

- Consumes: pinned selectors `[data-chat-flow-kind="assistant-step"] [data-streaming]` and DOM `Text` nodes.
- Produces: `findAppendedGraphemes(previous, next, segmenter?)`, `isEligibleStreamTextNode(node)`, `eligibleTextNodes(root)`, `STREAMING_ASSISTANT_SELECTOR`, and `EXCLUDED_OUTPUT_SELECTOR`.

- [x] **Step 1: Write failing suffix and Unicode tests**

```ts
expect(findAppendedGraphemes("思考", "思考中🙂")).toEqual([
  { text: "中", start: 2, end: 3, order: 0 },
  { text: "🙂", start: 3, end: 5, order: 1 },
]);
expect(findAppendedGraphemes("answer", "changed")).toBeNull();
expect(findAppendedGraphemes("e", "e\u0301")).toBeNull();
```

The last assertion treats a combining-mark rewrite as structural replacement rather than animating an invalid suffix.

- [x] **Step 2: Write failing DOM classification tests**

Build a JSDOM assistant row containing prose, a gray `[data-variant="think"]` region, `code`, `pre`, a tool descendant, a button, an `aria-hidden` clone, a user row, and history without `[data-streaming]`. Assert that only visible prose/reasoning text nodes inside the streaming assistant root are returned.

- [x] **Step 3: Run the focused test and observe the missing module failure**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/stream-output-model.test.ts
```

Expected: FAIL because `stream-output-model.js` does not exist.

- [x] **Step 4: Implement strict prefix segmentation and classification**

Use UTF-16 offsets returned by `Intl.Segmenter` so DOM Ranges receive valid offsets:

```js
export function findAppendedGraphemes(
  previous,
  next,
  segmenter = graphemeSegmenter,
) {
  if (!next.startsWith(previous)) return null;
  const suffix = next.slice(previous.length);
  const parts = [...segmenter.segment(suffix)];
  if (parts[0]?.index === 0 && /^\p{Mark}/u.test(parts[0].segment)) return null;
  return parts.map((part, order) => ({
    text: part.segment,
    start: previous.length + part.index,
    end: previous.length + part.index + part.segment.length,
    order,
  }));
}
```

Define the exclusion selector as semantic elements and stable attributes only:

```js
export const EXCLUDED_OUTPUT_SELECTOR = [
  "pre",
  "code",
  "kbd",
  "samp",
  "button",
  "input",
  "textarea",
  "select",
  '[role="button"]',
  '[role="status"]',
  '[aria-hidden="true"]',
  "[data-tool-call]",
  "[data-terminal]",
].join(",");
```

Require the streaming assistant ancestor and reject every excluded ancestor. Do not match hashed upstream class names or message text.

- [x] **Step 5: Run the focused model test**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/stream-output-model.test.ts
```

Expected: PASS for append, rewrite, emoji, combining mark, CJK, classifier, and history cases.

- [x] **Step 6: Commit the stream model**

```bash
git add packages/desktop-plugin/src/stream-output-model.js packages/desktop-plugin/test/stream-output-model.test.ts
git commit -m "feat: classify appended assistant graphemes"
```

### Task 3: Layout-neutral dissolve controller

**Files:**

- Create: `packages/desktop-plugin/src/stream-output-controller.js`
- Create: `packages/desktop-plugin/test/stream-output-controller.test.ts`
- Modify: `packages/desktop-plugin/src/conversation-effects.css`
- Modify: `packages/desktop-plugin/src/client-runtime.js`
- Create: `tests/playwright/stream-output-animation.spec.ts`
- Regenerate: `packages/desktop-plugin/client.js`

**Interfaces:**

- Consumes: Task 2 exports plus `document`, `window`, `CSS.highlights`, `Highlight`, `MutationObserver`, `Range`, and requestAnimationFrame.
- Produces: `createStreamOutputEffectController({ document, window })` returning `{ start(), dispose() }`, and `installStreamOutputEffects(document, window)` returning one idempotent disposer.

- [x] **Step 1: Write the failing controller tests**

Use JSDOM plus injected/fake `CSS.highlights`, `Highlight`, range rectangles, animation frames, and timers. Assert:

```ts
controller.start();
text.data = "回答中🙂";
await flushMutationsAndFrame();
expect(highlights.get("dsh-desktop-stream-mask")?.size).toBe(2);
expect(document.querySelectorAll("[data-dsh-stream-glyph]")).toHaveLength(2);
expect(source.getBoundingClientRect()).toEqual(originalBox);
controller.dispose();
expect(highlights.has("dsh-desktop-stream-mask")).toBe(false);
expect(document.querySelector("[data-dsh-stream-overlay]")).toBeNull();
```

Also assert no effect without CSS Highlight support, no replay of the baseline, cleanup after rewrite/completion/scroll/resize, exact copied `color` and font shorthand, no response text in diagnostics, and idempotent disposal.

- [x] **Step 2: Add the failing Playwright browser contract**

Create a streaming assistant fixture with ordinary prose, gray reasoning, a link, inline code, a code block, and a user row. Load the built client, call exported `installStreamOutputEffects`, append text, and assert native Chromium creates only eligible overlay glyphs, preserves source/container bounding boxes, retains link/code DOM, and clears every overlay when `data-streaming` is removed.

- [x] **Step 3: Run both focused tests to verify failure**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/stream-output-controller.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec playwright test tests/playwright/stream-output-animation.spec.ts
```

Expected: FAIL because the controller and generated client export do not exist.

- [x] **Step 4: Implement observation, masks, overlays, and cleanup**

On `start()`, baseline all existing eligible text nodes, create one fixed `aria-hidden`/`pointer-events:none` overlay root, create `new Highlight()`, register it as `dsh-desktop-stream-mask`, and attach a scoped body observer with `{ subtree: true, childList: true, characterData: true, characterDataOldValue: true }`.

For each accepted append:

1. Create a DOM Range for each grapheme's UTF-16 start/end offsets.
2. Batch all `getBoundingClientRect()` and `getComputedStyle(parentElement)` reads in one animation frame.
3. Add non-empty ranges to the Highlight and render one fixed glyph span per range.
4. Copy `font`, `fontKerning`, `fontFeatureSettings`, `fontVariationSettings`, `letterSpacing`, `textTransform`, and `color`; set `white-space: pre` and CSS variables for a maximum 200 ms stagger.
5. Add particles only for non-whitespace graphemes.
6. Delete each range and glyph after 460 ms plus its stagger, with a 700 ms hard cleanup deadline.

Use one cancellation path for rewrite, root completion, scroll, resize, navigation, node removal, and disposal. It must clear masks before removing overlays. Do not wrap or replace a React-owned text node.

- [x] **Step 5: Add namespaced dissolve paint styles**

Define only plugin-owned selectors and paint properties:

```css
::highlight(dsh-desktop-stream-mask) {
  color: transparent;
  -webkit-text-fill-color: transparent;
}

[data-dsh-stream-overlay] {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  contain: strict;
}

[data-dsh-stream-glyph] {
  position: fixed;
  animation: dsh-stream-dissolve 460ms ease-out both;
  animation-delay: var(--dsh-stream-delay);
}
```

Use opacity, blur, clip-path, and `currentColor` particles. Under reduced motion, disable glyph/particle animation and let the controller skip masking entirely.

- [x] **Step 6: Export and build the controller**

Require the local controller from `client-runtime.js`, export `createStreamOutputEffectController` and `installStreamOutputEffects` for deterministic tests, and keep local requires bundled by esbuild.

- [x] **Step 7: Run focused unit and browser tests**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm --dir packages/desktop-plugin build:client
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/stream-output-model.test.ts packages/desktop-plugin/test/stream-output-controller.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec playwright test tests/playwright/stream-output-animation.spec.ts
```

Expected: PASS with no geometry movement, no code/user animation, correct gray/primary sampled colors, and complete cleanup.

- [x] **Step 8: Commit the dissolve controller**

```bash
git add packages/desktop-plugin/src/stream-output-controller.js packages/desktop-plugin/src/conversation-effects.css packages/desktop-plugin/src/client-runtime.js packages/desktop-plugin/test/stream-output-controller.test.ts tests/playwright/stream-output-animation.spec.ts packages/desktop-plugin/client.js
git commit -m "feat: animate appended assistant text without layout changes"
```

### Task 4: Active ThinkingOrb status lifecycle

**Files:**

- Create: `packages/desktop-plugin/src/thinking-status.js`
- Create: `packages/desktop-plugin/test/thinking-status.test.ts`
- Modify: `packages/desktop-plugin/src/client-runtime.js`
- Modify: `packages/desktop-plugin/src/conversation-effects.css`
- Modify: `packages/desktop-plugin/package.json`
- Modify: `tests/e2e/plugin-contract.test.ts`
- Modify: `tests/e2e/plugin-real-harness.test.ts`
- Modify: `tests/playwright/stream-output-animation.spec.ts`
- Regenerate: `packages/desktop-plugin/client.js`

**Interfaces:**

- Consumes: direct status selector `[data-chat-flow] > [role="status"][aria-live="polite"]`, React hooks, bundled `ThinkingOrb`, and `installStreamOutputEffects`.
- Produces: `findRunningStatus(document)`, `installThinkingStatus(document, window, onSnapshot)`, `THINKING_ORB_PROPS = { state: "breathing", size: 20, speed: 2 }`, and `ConversationEffectsOverlay` registered as `deepseek-harness-desktop-conversation-effects` in `shell.overlay`.

- [x] **Step 1: Write failing status-adapter tests**

Assert the adapter ignores unrelated live regions, emits only for the direct bottom child, measures `{ left, top: top + (height - 20) / 2 }`, repositions on captured scroll/resize, emits `null` on status removal, removes all listeners/observers on disposal, and never keys lifecycle from the English `Deep diving...` text.

- [x] **Step 2: Tighten the failing official-plugin contract**

Update the apply test to expect both `settings.general.item` and `shell.overlay`. Assert the layout bundle is present in `dsh.client.inject`, the exact orb props are exported, `thinking-orbs` is absent from runtime `require()` calls, and the overlay registration disposer participates in reference-counted cleanup.

Update fake module loaders to provide:

```ts
if (id === "react/jsx-runtime") {
  return { jsx: createElement, jsxs: createElement };
}
```

The bundled library uses only `react`, `react/jsx-runtime`, and its embedded engine.

- [x] **Step 3: Add failing browser lifecycle assertions**

Extend the Playwright fixture with a direct bottom `role="status"`. Assert the source becomes transparent only after an orb host render, the host is fixed at the approved coordinates with a 20-by-20 canvas contract, the live region remains in the accessibility tree, and removing the status removes the host and marker. Emulate reduced motion and assert text overlays are absent; inspect the bundled orb props/static behavior rather than expecting continuous frames.

- [x] **Step 4: Run focused tests to verify failure**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/thinking-status.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-contract.test.ts tests/e2e/plugin-real-harness.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec playwright test tests/playwright/stream-output-animation.spec.ts
```

Expected: FAIL because no status adapter, shell overlay registration, or orb host exists.

- [x] **Step 5: Implement the status adapter**

Use `querySelectorAll()` and choose the last direct status child without matching text. Batch measurements in requestAnimationFrame. Observe child-list changes for authoritative mount/unmount; attach captured scroll and resize handlers only while active. The callback receives either:

```js
{ anchor, left: rect.left, top: rect.top + (rect.height - 20) / 2 }
```

or `null`. Repeated mutations with the same coordinates and anchor do not emit another snapshot.

- [x] **Step 6: Mount the bundled orb from the official root slot**

In `client-runtime.js`:

```js
const { ThinkingOrb } = require("thinking-orbs");
const THINKING_ORB_PROPS = Object.freeze({
  state: "breathing",
  size: 20,
  speed: 2,
});
```

`ConversationEffectsOverlay` installs the stream controller and status adapter in effects. It renders an `aria-hidden="true"` fixed host containing `React.createElement(ThinkingOrb, THINKING_ORB_PROPS)`. A layout effect adds `data-dsh-desktop-thinking-source` to the current anchor only after the host commit and removes it before anchor change/unmount. CSS sets only that marked source to `opacity: 0 !important`, preserving its 26-pixel layout box and polite live-region semantics.

Register the component in `shell.overlay`, add `@deepseek-ai/dsh-client-ui-layout@^0.1.0-rc.6` to plugin peers and `dsh.client.inject` so the seat exists before registration, and dispose both slot registrations during final release.

- [x] **Step 7: Build and run focused lifecycle tests**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm --dir packages/desktop-plugin build:client
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run packages/desktop-plugin/test/thinking-status.test.ts packages/desktop-plugin/test/stream-output-controller.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-contract.test.ts tests/e2e/plugin-real-harness.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec playwright test tests/playwright/stream-output-animation.spec.ts
```

Expected: PASS for running-only presence, exact props, geometry preservation, accessible fallback, all completion paths, reduced motion, and real Harness boot.

Verified with 9 focused unit tests, 17 official-plugin tests (including the pinned real Harness boot), two Chromium tests, TypeScript, and ESLint. The browser test exercises the real DOM adapter and reduced-motion path; the plugin contract separately executes the React layout-effect boundary to prove the native source is hidden only after host commit. Strict type checking also required colocated declarations for the JavaScript controllers and `@types/jsdom@21.1.7`; these are test/type-only additions and do not enter the runtime bundle.

- [x] **Step 8: Commit the ThinkingOrb lifecycle**

```bash
git add packages/desktop-plugin/src/thinking-status.js packages/desktop-plugin/src/client-runtime.js packages/desktop-plugin/src/conversation-effects.css packages/desktop-plugin/package.json packages/desktop-plugin/test/thinking-status.test.ts tests/e2e/plugin-contract.test.ts tests/e2e/plugin-real-harness.test.ts tests/playwright/stream-output-animation.spec.ts packages/desktop-plugin/client.js
git commit -m "feat: show breathing orb while the model is active"
```

### Task 5: Package closure, performance, and compatibility regression

**Files:**

- Modify: `tests/unit/package-runtime-closure.test.ts`
- Modify: `scripts/check-runtime-closure.mjs`
- Modify: `tests/e2e/package-contract.test.ts`
- Modify: `tests/playwright/stream-output-animation.spec.ts`

**Interfaces:**

- Consumes: final generated `client.js`, Electron package file list, plugin package manifest, and browser controllers from Tasks 3–4.
- Produces: release-gating assertions for offline dependency closure, cleanup, and idle behavior.

- [x] **Step 1: Add failing release-closure assertions before changing the checker**

Assert the plugin notice is a runtime artifact, `thinking-orbs@0.3.1` resolves from the workspace lock, the generated client contains no runtime request for `thinking-orbs` or local effect modules, and the package contract includes the notice.

- [x] **Step 2: Run package checks and capture the expected missing-artifact failure**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run tests/unit/package-runtime-closure.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/package-vitest.config.ts
```

Expected: FAIL until the runtime closure and package assertions include the new notice/bundle contract.

- [x] **Step 3: Extend closure checks and idle browser evidence**

Add `packages/desktop-plugin/THIRD_PARTY_NOTICES.md` to `runtimeArtifacts`. Read the generated client and reject these patterns:

```js
for (const unresolved of [
  'require("thinking-orbs")',
  'require("./stream-output-model.js")',
  'require("./stream-output-controller.js")',
  'require("./thinking-status.js")',
]) {
  if (pluginClient.includes(unresolved)) throw new Error(unresolved);
}
```

In Playwright, instrument requestAnimationFrame after stream completion, wait five seconds, and assert the plugin schedules no new frames, leaves no overlays/highlights/status markers, and does not change message geometry or heap through retained plugin DOM.

- [x] **Step 4: Run package, preflight, and browser gates**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm build:plugin
npm exec --yes --package=pnpm@11.19.0 -- pnpm preflight:runtime
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run tests/unit/package-runtime-closure.test.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm vitest run --config tests/e2e/package-vitest.config.ts
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec playwright test tests/playwright/stream-output-animation.spec.ts
```

Expected: PASS with a self-contained plugin and zero post-generation animation activity.

Verified with five runtime-closure unit tests, four package-contract tests, the preflight checker (12 artifacts, 32 production dependencies, five critical runtime packages, and one bundled plugin package), and three Chromium tests. The five-second idle observation retained no plugin paint DOM or CSS Highlight and scheduled no additional animation frame. Only ordinary compilation was performed; no distributable installer or version artifact was built.

- [x] **Step 5: Commit release gates**

```bash
git add tests/unit/package-runtime-closure.test.ts scripts/check-runtime-closure.mjs tests/e2e/package-contract.test.ts tests/playwright/stream-output-animation.spec.ts
git commit -m "test: gate conversation animation runtime closure"
```

### Task 6: Implementation-backed documentation and final verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/engineering/testing.md`
- Modify: `docs/knowledge/upstream-baseline.md`
- Modify: `docs/superpowers/specs/2026-08-16-stream-output-animation-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-stream-output-animation.md`

**Interfaces:**

- Consumes: verified implementation paths, exact dependency versions, test counts, browser results, and final Git diff.
- Produces: implementation-backed design/architecture/testing facts and a completed recoverable plan record.

- [x] **Step 1: Run the complete verification matrix from a clean generated state**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm build
npm exec --yes --package=pnpm@11.19.0 -- pnpm test
npm exec --yes --package=pnpm@11.19.0 -- pnpm typecheck
npm exec --yes --package=pnpm@11.19.0 -- pnpm lint
npm exec --yes --package=pnpm@11.19.0 -- pnpm format:check
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:docs
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:security
npm exec --yes --package=pnpm@11.19.0 -- pnpm preflight:runtime
```

Expected: every command exits 0. Record exact test file/test counts and distinguish any host-limited manual visual check from automated evidence.

Verified from a clean generated state before review: build, 24 unit files / 86 tests, 3 plugin files / 17 tests, 1 package file / 4 tests, 4 Chromium tests, TypeScript, ESLint, documentation links, security contracts, and runtime closure passed. After review remediation, the current suite passes 24 unit files / 89 tests, 3 plugin files / 17 tests, 1 package file / 4 tests, and 5 Chromium tests; targeted formatting, TypeScript, and ESLint also pass. The repository-wide Prettier command still reports two pre-existing product-story documents that are concurrently modified in the user's local main worktree; every feature and documentation file touched by this plan passes targeted Prettier. Those unrelated user-owned files were intentionally not rewritten. A credentialed live-model visual pass was not run.

- [x] **Step 2: Write back only verified facts**

- Mark the design `content_stage: implementation-backed` and add the actual controller/build/test paths.
- Add the root overlay, DOM compatibility adapter, fail-closed behavior, and no-content-logging boundary to architecture.
- Add exact unit/plugin/Playwright/package counts and the five-second idle result to testing.
- Add `thinking-orbs@0.3.1`, `esbuild@0.25.12`, source URLs, MIT licenses, retrieval date, applicability, and revalidation rule to upstream baseline.
- Add this plan to `AGENTS.md` while active; mark it completed and update the current snapshot only after final verification.
- Check every plan checkbox and record any deviation with its evidence rather than rewriting history.

- [x] **Step 3: Format, link-check, and inspect the final scope**

```bash
npm exec --yes --package=pnpm@11.19.0 -- pnpm exec prettier --write AGENTS.md docs/architecture/overview.md docs/engineering/testing.md docs/knowledge/upstream-baseline.md docs/superpowers/specs/2026-08-16-stream-output-animation-design.md docs/superpowers/plans/2026-08-16-stream-output-animation.md
npm exec --yes --package=pnpm@11.19.0 -- pnpm verify:docs
git diff --check
git status --short
git diff --stat
```

Expected: no formatting/link/diff errors and no unrelated file changes.

- [x] **Step 4: Commit documentation and verified completion evidence**

```bash
git add AGENTS.md docs/architecture/overview.md docs/engineering/testing.md docs/knowledge/upstream-baseline.md docs/superpowers/specs/2026-08-16-stream-output-animation-design.md docs/superpowers/plans/2026-08-16-stream-output-animation.md
git commit -m "docs: record verified conversation animations"
```

- [x] **Step 5: Perform the final clean-tree audit**

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: the feature worktree is clean; all implementation commits are visible; the final report cites commands actually run and any remaining external visual check.

## Rollback

- Remove only the `shell.overlay` registration and controller imports to restore native Harness rendering and status without touching conversation data.
- Rebuild `client.js`; package closure prevents stale third-party runtime requires.
- If pinned Harness DOM contracts change, the classifier and status adapter fail closed, leaving canonical text and `Deep diving...` visible until their compatibility tests are updated.
- Dependency rollback removes `thinking-orbs`, its bundled code, its manifest entry, and the corresponding notice entry together.

## Progress

- 2026-08-16 — User approved the written design and requested implementation; TDD execution plan created.
- 2026-08-16 — Task 1 complete: exact dependencies, MIT notices, warning-free esbuild client bundling, stylesheet composition, and plugin contract are green.
- 2026-08-16 — Task 2 complete: strict appended-grapheme ranges and the semantic prose/reasoning classifier are green for CJK, emoji, combining marks, history, code, tool, status, and user exclusions.
- 2026-08-16 — Task 3 complete: CSS Highlight masking and the fixed dissolve overlay preserve canonical Markdown geometry while copying primary/reasoning typography and clearing on every tested lifecycle boundary.
- 2026-08-16 — Task 4 complete: the official `shell.overlay` renders the exact breathing 20-pixel Orb only for the authoritative direct running status, with commit-ordered native fallback and active-only viewport listeners.
- 2026-08-16 — Task 5 complete: package closure ships MIT notices, rejects unresolved client imports, and proves five seconds of zero-frame post-generation quiescence with no retained paint DOM.
- 2026-08-16 — Task 6 verification complete: all feature tests, build, type, lint, docs, security, and runtime gates pass; the unrelated baseline product-story Prettier exception and unexecuted credentialed visual pass are recorded explicitly.
- 2026-08-16 — Final feature-worktree audit was clean with seven implementation/verification commits above the approved design and plan baseline; cloud PR and local-main integration remain the delivery workflow outside this implementation checklist.
- 2026-08-16 — Pre-merge code review found no critical issues and four important gaps. TDD remediation now baselines newly attached streaming roots, validates full-string emoji grapheme boundaries, caps live DOM at 120 glyphs/72 particles with fail-open overflow, and mounts the bundled Orb through real ReactDOM in Chromium to prove commit ordering, reduced-motion quiescence, and cleanup.
