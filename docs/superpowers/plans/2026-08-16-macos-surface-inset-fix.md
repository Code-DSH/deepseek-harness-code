# macOS Full-Height Surface Inset Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the full-width white top band while retaining a safe area for native macOS traffic lights inside the existing sidebar component.

**Architecture:** Delete the global `body` inset from the desktop plugin. Extend the pinned rc.6 sidebar CSS-module rule through an exact-version pnpm patch so the sidebar surface remains full-height while its inner content keeps the same 40-pixel vertical displacement.

**Tech Stack:** CSS, exact-version pnpm patches, Vitest/JSDOM, Electron 43.

## Global Constraints

- Keep native `titleBarStyle: "hiddenInset"` and `{ x: 16, y: 16 }` traffic lights.
- Do not create a Web title bar, header, spacer, or blank strip.
- Do not apply top padding to `html`, `body`, the renderer root, AppFrame, sidebar column, or main column.
- Windows and Linux remain unchanged.

---

### Task 1: Move the safe area into the sidebar component

**Files:**
- Modify: `tests/e2e/plugin-contract.test.ts`
- Modify: `packages/desktop-plugin/src/transitions.css`
- Create: `patches/@deepseek-ai__dsh-client-ui-sidebar@0.1.0-rc.6.patch`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/desktop-plugin/client.js`
- Modify: `docs/engineering/testing.md`

**Interfaces:**
- Consumes: `data-dsh-desktop-platform="macos"` on the renderer root and pinned sidebar classes `.hHd-Xa_root` / `.hHd-Xa_collapsed`.
- Produces: zero `body` top padding, expanded sidebar `padding-top: 46px`, collapsed sidebar `padding-top: 58px` on macOS only.

- [ ] **Step 1: Write the failing geometry contract**

Replace the old assertion expecting `body.paddingTop === "40px"` with a real rc.6 sidebar fixture. Assert `body.paddingTop === ""`, the sidebar surface begins at the viewport top, and its computed top padding is `46px` expanded and `58px` collapsed.

- [ ] **Step 2: Run the focused test and prove RED**

Run: `pnpm vitest run --config tests/e2e/plugin-vitest.config.ts tests/e2e/plugin-contract.test.ts`

Expected: FAIL because `body` still has `40px` top padding and the sidebar component has no macOS rule.

- [ ] **Step 3: Apply the minimal component-style fix**

Delete the `body` padding rule. Add this rule to the pinned sidebar CSS module through a pnpm patch:

```css
:root[data-dsh-desktop-platform="macos"] .hHd-Xa_root {
  padding-top: 46px;
}

:root[data-dsh-desktop-platform="macos"] .hHd-Xa_root.hHd-Xa_collapsed {
  padding-top: 58px;
}
```

Register the patch in `pnpm-workspace.yaml`, refresh the lockfile, perform a frozen clean-install check, and rebuild `packages/desktop-plugin/client.js`.

- [ ] **Step 4: Prove GREEN and inspect the artifact**

Run the focused plugin test and inspect the generated client and installed patched sidebar bundle. Confirm no global `body` inset remains and the component rule survives a frozen install.

- [ ] **Step 5: Update rendering documentation and commit**

Document full-height backgrounds plus sidebar-only inner safe area. Commit the source, patch, lockfile, test, generated client, and docs together.

### Task 2: Package and visually accept the layout

**Files:**
- Modify: `package.json`
- Modify: `docs/engineering/acceptance-report.md`
- Modify: `docs/project/status.md`

**Interfaces:**
- Consumes: fixed component CSS and Electron window chrome.
- Produces: version `0.3.2` Universal macOS DMG with no top blank band.

- [ ] **Step 1: Run repository gates**

Run focused tests, unit/plugin/package suites, typecheck, build, runtime preflight, docs, security, lint/format checks, and record any proven pre-existing failures separately.

- [ ] **Step 2: Build and verify the Universal artifact**

Run `pnpm dist:mac`, `pnpm verify:mac`, mount the DMG, and confirm version, bundle identifier, signatures, Universal/qualified Mach-O layouts, and SHA-256.

- [ ] **Step 3: Perform packaged visual acceptance**

Launch the packaged app on the available macOS host. Confirm the sidebar background reaches the rounded top-left corner, main background reaches the top edge, internal sidebar controls clear the traffic lights, and no full-width white strip exists.

- [ ] **Step 4: Record evidence and commit**

Write the actual test counts, macOS host version, artifact path, checksum, and any external target-host gates into the acceptance/status docs.
