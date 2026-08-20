// dsh-ui-polish — client half (界面焕新).
//
// Purely additive, injection-style visual overhaul for the DeepSeek Harness
// web frontend. It never touches official files: everything is delivered as
// one stylesheet + tiny DOM guards + one settings page, all registered
// through the official client module/slot APIs and cleaned up on unload.
//
// Feature groups (each can be toggled live under 设置 → 界面焕新):
//   anim     — global smooth motion: message entrance, menu item stagger,
//              dialog rise, press feedback, hover transitions. Always on by
//              design (restrained amplitudes), never gated by the OS
//              reduce-motion setting.
//   menu     — two-level model selector: adaptive flyout placement (right by
//              default, flips left when the viewport edge would clip), a
//              hard anti-flicker gate (hidden + animation paused until the
//              guard has chosen a side), spring entrance curves, and a
//              re-armed close-animation lifecycle under reduce-motion.
//   sidebar  — session tree polish: rounded rows, hover feedback, accent
//              selection wash, footer button transitions.
//   settings — settings dialog overhaul: structured nav rail (tinted,
//              separated, denser cells), unified page metrics (720px content
//              column, official typography rhythm), one shared component spec
//              for every plugin page (cards / inputs / buttons mapped onto
//              official --dsw-* tokens), and consistent popup surfaces.
//
// All colors come from the app's own design tokens (--dsw-*) so light/dark
// themes both work. NOTE: --dsw-alias-button-business-fill does NOT exist in
// the official token set — the real business-blue tokens are
// --dsw-alias-button-info-fill / --dsw-alias-state-business-primary.
window.__ModuleLoader__.load({
  id: "dsh-ui-polish",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];

    // ── preferences (live-toggleable, persisted locally) ─────────────────────
    const PREFS_KEY = "dsh-ui-polish:prefs";
    const DEFAULTS = { anim: true, menu: true, sidebar: true, settings: true };

    const loadPrefs = () => {
      try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        const parsed = raw === null ? {} : JSON.parse(raw);
        return {
          ...DEFAULTS,
          ...(parsed && typeof parsed === "object" ? parsed : {}),
        };
      } catch (_) {
        return { ...DEFAULTS };
      }
    };
    const savePrefs = (prefs) => {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch (_) {
        /* storage unavailable — session-only prefs */
      }
    };
    // Off-state is encoded as an attribute so CSS gates react instantly:
    //   :root:not([data-uip-anim="off"]) …  (absence = on)
    const applyAttrs = (prefs) => {
      const root = document.documentElement;
      for (const key of Object.keys(DEFAULTS)) {
        if (prefs[key] === false) root.setAttribute("data-uip-" + key, "off");
        else root.removeAttribute("data-uip-" + key);
      }
    };

    // ── stylesheet ────────────────────────────────────────────────────────────
    // Selector conventions used below:
    //   $dlg  ≈ :root:not([data-uip-settings="off"]) [role="dialog"][aria-modal="true"][class*="_panel"]
    //          (the settings dialog shell; the _panel class is the official
    //          SettingsRoot module class, stable for @deepseek-ai/dsh rc.6)
    //   $scope ≈ :where([role="dialog"][class*="_panel"]) [data-slot="settings.section"] > *:not([class*="_section"])
    //          (plugin-rendered settings pages only — official section roots
    //          are all named *_section by their CSS modules, so the :not()
    //          excludes them; :where() keeps specificity at the gate level so
    //          later per-plugin rules win ties by source order)
    const CSS = `
/* ═══════════ 0. motion + color tokens (upgrade the design-system curves) ═══ */
:root:root {
  --ds-ease-in-out: cubic-bezier(0.32, 0.04, 0.18, 1);
  --ds-transition-duration: 0.26s;
  --ds-transition-duration-fast: 0.16s;
  --ds-transition-duration-slow: 0.4s;
}
:root {
  --uip-accent: var(--dsw-alias-button-info-fill, var(--dsw-alias-state-business-primary, #4176e6));
  --uip-accent-soft: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 12%, transparent);
  --uip-accent-ring: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 38%, transparent);
  --uip-ease: var(--ds-ease-in-out);
  --uip-spring: cubic-bezier(0.22, 0.61, 0.21, 1);
  --uip-spring-pop: cubic-bezier(0.2, 0.9, 0.28, 1.06);
  --uip-nav-w: 204px;
  --uip-page-w: 720px;
}

/* macOS desktop: keep the sidebar below the traffic-light zone. The official
   sidebar root (.hHd-Xa_root) sits at y=0 by default, so on macOS the window
   controls overlap the logo row + collapse toggle. This restores the rc.6
   sidebar inset (the rc.6 pnpm patch's context moved in rc.7, so it is
   delivered here as a stable additive rule). Unconditional on macOS — a
   layout fix, not a toggleable polish. */
:root[data-dsh-desktop-platform="macos"] .hHd-Xa_root { padding-top: 46px; }
:root[data-dsh-desktop-platform="macos"] .hHd-Xa_root.hHd-Xa_collapsed { padding-top: 58px; }

/* ═══════════ 1. foundations: selection, scrollbars, interactive transitions ═ */
::selection {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 24%, transparent);
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.32));
  border: 3px solid transparent;
  border-radius: 8px;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l2, rgba(127, 127, 127, 0.5));
  border: 3px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }

:root:not([data-uip-anim="off"]) button,
:root:not([data-uip-anim="off"]) a[href],
:root:not([data-uip-anim="off"]) [role="button"],
:root:not([data-uip-anim="off"]) [role="menuitem"],
:root:not([data-uip-anim="off"]) [role="tab"],
:root:not([data-uip-anim="off"]) [role="switch"],
:root:not([data-uip-anim="off"]) [role="treeitem"] {
  transition:
    background-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    box-shadow var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    opacity var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}
/* tactile press feedback (menu triggers excluded — they host popups) */
:root:not([data-uip-anim="off"]) button:not([aria-haspopup]):not(:disabled):active,
:root:not([data-uip-anim="off"]) [role="button"]:not([aria-haspopup]):active {
  scale: 0.985;
  transition-duration: 0.06s;
}

/* ═══════════ 2. floating layers: one motion language for every popup ═══════ */
/* Every floating surface in the app (dialogs, masks, menus, listboxes,
   tooltips) shares the same restrained vocabulary: fade + slight rise +
   slight scale from its anchor. Where the anchor is known we set
   transform-origin so the surface unfolds FROM its trigger. */
@keyframes uip-rise {
  from { opacity: 0; translate: 0 8px; scale: 0.985; }
  to   { opacity: 1; translate: 0 0;  scale: 1; }
}
@keyframes uip-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes uip-pop {
  from { opacity: 0; translate: 0 4px; scale: 0.97; }
  to   { opacity: 1; translate: 0 0;  scale: 1; }
}
@keyframes uip-menu-item {
  from { opacity: 0; translate: 0 3px; }
  to   { opacity: 1; translate: 0 0; }
}

:root:not([data-uip-anim="off"]) [role="dialog"][aria-modal="true"],
:root:not([data-uip-anim="off"]) [role="alertdialog"] {
  animation: uip-rise 0.32s var(--ds-ease-in-out);
}
:root:not([data-uip-anim="off"]) [class*="_mask"] {
  animation: uip-fade 0.24s var(--ds-ease-in-out);
}
/* higher specificity than dsh-ui-motion's bare [role="menu"] so the curve is
   deterministic regardless of plugin load order */
:root:not([data-uip-anim="off"]) [role="menu"],
:root:not([data-uip-anim="off"]) [role="listbox"] {
  animation: uip-pop 0.22s var(--uip-spring-pop);
  transform-origin: top center;
}
:root:not([data-uip-anim="off"]) [role="tooltip"] {
  animation: uip-fade 0.16s var(--ds-ease-in-out);
}
/* menu/listbox rows cascade in. Two-level-selector flyouts (.m2-flyout) are
   direct children of its [role="menu"] — they MUST be excluded from BOTH the
   animation rule and every delay rule: an earlier revision left the delays
   un-excluded, so the flyout picked up nth-child animation-delay, which
   delayed its entrance AND its exit asymmetrically (the visible "闪烁"). */
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol),
:root:not([data-uip-anim="off"]) [role="listbox"] > * {
  animation: uip-menu-item 0.22s var(--ds-ease-in-out) both;
}
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol):nth-child(2),
:root:not([data-uip-anim="off"]) [role="listbox"] > *:nth-child(2) { animation-delay: 18ms; }
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol):nth-child(3),
:root:not([data-uip-anim="off"]) [role="listbox"] > *:nth-child(3) { animation-delay: 36ms; }
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol):nth-child(4),
:root:not([data-uip-anim="off"]) [role="listbox"] > *:nth-child(4) { animation-delay: 54ms; }
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol):nth-child(5),
:root:not([data-uip-anim="off"]) [role="listbox"] > *:nth-child(5) { animation-delay: 72ms; }
:root:not([data-uip-anim="off"]) [role="menu"] > *:not(.m2-flyout):not(.m2-rowsCol):nth-child(n+6),
:root:not([data-uip-anim="off"]) [role="listbox"] > *:nth-child(n+6) { animation-delay: 88ms; }

/* ═══════════ 3. sidebar: session tree, new-session, footer ════════════════ */
:root:not([data-uip-sidebar="off"]) [role="treeitem"] {
  border-radius: 8px;
}
:root:not([data-uip-sidebar="off"]) [role="treeitem"]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
/* selected session: soft accent wash only (no heavy indicator stripe) */
:root:not([data-uip-sidebar="off"]) [role="treeitem"][aria-selected="true"] {
  background: var(--uip-accent-soft);
}
:root:not([data-uip-sidebar="off"]) [class*="_newSession"] {
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
:root:not([data-uip-sidebar="off"]) [class*="_newSession"]:hover {
  box-shadow: 0 4px 14px -4px var(--uip-accent-ring);
}
:root:not([data-uip-sidebar="off"]) [class*="_iconButton"] {
  border-radius: 8px;
}
:root:not([data-uip-sidebar="off"]) [class*="_footArea"] button,
:root:not([data-uip-sidebar="off"]) [class*="_settingsArea"] button {
  border-radius: 8px;
}

/* ═══════════ 4. conversation: message entrance, tool rows, to-bottom ══════ */
/* one gentle entrance per message row; streaming updates reuse the same
   node, so the animation never restarts mid-stream */
:root:not([data-uip-anim="off"]) [class*="_flowItem"] {
  animation: uip-msg-in 0.3s var(--ds-ease-in-out);
}
@keyframes uip-msg-in {
  from { opacity: 0; translate: 0 4px; }
  to   { opacity: 1; translate: 0 0; }
}
:root:not([data-uip-anim="off"]) [class*="_callRow"] {
  border-radius: 8px;
}
:root:not([data-uip-anim="off"]) [class*="_toBottom"] {
  border-radius: 999px;
  box-shadow: var(--dsw-shadow-lv3, 0 6px 24px rgba(0, 0, 0, 0.12));
  animation: uip-rise 0.24s var(--uip-spring);
  transition: translate 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-anim="off"]) [class*="_toBottom"]:hover { translate: 0 -1px; }

/* ═══════════ 5. settings dialog overhaul (设置面板清晰化) ══════════════════ */
/* 5.1 shell metrics: a touch wider than the shipped 800px so the content
   column breathes; height leaves a comfortable screen margin. */
:root:not([data-uip-settings="off"]) [role="dialog"][aria-modal="true"][class*="_panel"] {
  width: 840px;
  height: min(780px, calc(100vh - 56px));
}

/* 5.2 nav rail: tinted, hairline-separated, denser cells. Officially the nav
   floats on the panel background with no separation — structure is what makes
   the panel read clearly. module-platform is the official inset-panel tint.
   NOTE: the rail is selected structurally (panel > nav) — a substring match
   on "_nav" would also hit _navTitle/_navList/_navCell and corrupt them. */
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] > nav {
  width: var(--uip-nav-w);
  padding: 18px 10px 12px;
  gap: 12px;
  background: var(--dsw-alias-bg-module-platform);
  border-right: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navTitle"] {
  padding: 2px 10px 6px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--dsw-alias-label-primary);
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] {
  gap: 2px;
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"] {
  height: 36px;
  padding: 0 10px;
  gap: 8px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"]:hover {
  background: var(--dsw-specific-sidebar-nav-item-hover, var(--dsw-alias-interactive-bg-hover));
  color: var(--dsw-alias-label-primary);
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"][class*="_active"],
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"][aria-current="true"] {
  background: var(--dsw-specific-sidebar-nav-item-active, var(--dsw-alias-interactive-bg-active));
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"][class*="_active"] [class*="_navIcon"],
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navCell"][aria-current="true"] [class*="_navIcon"] {
  color: var(--uip-accent);
}
/* nav cells cascade once when the dialog opens */
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > * {
  animation: uip-menu-item 0.24s var(--ds-ease-in-out) both;
}
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(2) { animation-delay: 20ms; }
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(3) { animation-delay: 40ms; }
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(4) { animation-delay: 60ms; }
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(5) { animation-delay: 80ms; }
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(6) { animation-delay: 100ms; }
:root:not([data-uip-anim="off"]):not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] [class*="_navList"] > *:nth-child(n+7) { animation-delay: 118ms; }

/* 5.3 content header: centered rhythm + quiet hairline separation
   (direct child of the content column — plugin pages ship their own
   "_header" classes which must not inherit these metrics) */
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] > [class*="_content"] > [class*="_header"] {
  height: 56px;
  align-items: center;
  padding: 0 12px 0 24px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.16));
}
/* 5.4 section scroll area: consistent gutters; scrollbar-gutter kills the
   horizontal jump when switching between short and long pages */
:root:not([data-uip-settings="off"]) [role="dialog"][class*="_panel"] > [class*="_content"] > [class*="_options"] {
  padding: 20px 24px 32px;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
/* section pages cross-fade in on every nav switch (they mount fresh) */
:root:not([data-uip-anim="off"]) [data-slot="settings.section"] > * {
  animation: uip-page-in 0.24s var(--ds-ease-in-out);
}
@keyframes uip-page-in {
  from { opacity: 0; translate: 0 6px; }
  to   { opacity: 1; translate: 0 0; }
}

/* 5.5 one component spec for every plugin settings page (统一官方元素).
   Official section roots are CSS-module classes named *_section; plugin pages
   never match that, so :not([class*="_section"]) scopes to plugin content
   only. Everything maps onto official tokens + official metrics:
   inputs 32px/8px radius (dsw input), buttons 32px/16px pill (dsw button),
   cards 12px radius + border-l2 (dsw card). */
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"]) [data-slot="settings.section"] > *:not([class*="_section"]) {
  max-width: var(--uip-page-w);
  box-sizing: border-box;
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) h1,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) h2,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) h3,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) h4 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary);
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) p {
  font-size: 13px;
  line-height: 1.7;
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) input:not([type="checkbox"]):not([type="radio"]),
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) select,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) textarea {
  box-sizing: border-box;
  min-height: 32px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsw-alias-label-primary);
  padding: 4px 10px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out),
    background-color 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) textarea {
  padding: 8px 10px;
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) input:focus-visible,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) select:focus-visible,
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) textarea:focus-visible {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 2.5px var(--uip-accent-ring);
}
/* plugin-page buttons default to the official secondary (outline) look;
   switches and this plugin's own controls are excluded and styled below */
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) button:not([role="switch"]):not([class*="uip-"]) {
  min-height: 32px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25));
  border-radius: 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  padding: 4px 14px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.16s var(--ds-ease-in-out), border-color 0.16s var(--ds-ease-in-out),
    color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) button:not([role="switch"]):not([class*="uip-"]):hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
/* shared card spec for plugin pages (injector items, prompt-principles,
   vision-router, this plugin's rows, …) */
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) :is(.sif-item, .sif-add, .ppTabCard, .vr-card, .uip-row, .sif-msg) {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  border-radius: 12px;
  transition: border-color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-settings="off"]) :where([role="dialog"][class*="_panel"] [data-slot="settings.section"] > *:not([class*="_section"])) :is(.sif-item, .ppTabCard, .vr-card, .uip-row):hover {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  box-shadow: 0 2px 10px -4px rgba(15, 23, 42, 0.12);
}
/* tabs inside settings (official plugins tabs): calmer hover, accent underline */
:root:not([data-uip-settings="off"]) [role="dialog"] [role="tab"] {
  border-radius: 8px;
  transition: color 0.16s var(--ds-ease-in-out), background-color 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-settings="off"]) [role="dialog"] [role="tab"]:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

/* 5.6 super-injector "插件管理" page (.sif-*): native look, official tokens.
   The plugin's own sheet hardcodes dark fallbacks (#111 inputs, #4a9eff
   buttons) behind non-existent token names — !important wins against it
   regardless of injection order. Cosmetic properties only. */
:root:not([data-uip-settings="off"]) .sif-page {
  font-family: inherit !important;
  font-size: 13px !important;
  line-height: 1.65 !important;
  max-width: var(--uip-page-w) !important;
  gap: 14px !important;
  padding: 4px 0 12px !important;
}
:root:not([data-uip-settings="off"]) .sif-page h3 {
  font-size: 15px !important;
  letter-spacing: -0.01em;
}
:root:not([data-uip-settings="off"]) .sif-add {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2)) !important;
  border-radius: 12px !important;
  background: var(--dsw-alias-bg-module-platform, rgba(127, 127, 127, 0.05)) !important;
  padding: 14px 16px !important;
  text-align: left !important;
  color: var(--dsw-alias-label-secondary, #666) !important;
}
:root:not([data-uip-settings="off"]) .sif-row { gap: 8px !important; }
:root:not([data-uip-settings="off"]) .sif-input {
  background: var(--dsw-alias-bg-layer-1, transparent) !important;
  color: var(--dsw-alias-label-primary, #222) !important;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2)) !important;
  border-radius: 8px !important;
  min-height: 32px;
  padding: 4px 10px !important;
  font-size: 13px !important;
  font-family: inherit !important;
  transition: border-color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out) !important;
}
:root:not([data-uip-settings="off"]) .sif-input:focus-visible {
  outline: none !important;
  border-color: var(--dsw-alias-brand-primary) !important;
  box-shadow: 0 0 0 2.5px var(--uip-accent-ring) !important;
}
/* primary action = official primary fill (near-black on light); ghost =
   official outline; danger = official error tokens */
:root:not([data-uip-settings="off"]) .sif-btn {
  background: var(--dsw-alias-button-primary-fill, #222) !important;
  color: var(--dsw-alias-label-primary-foreground, #fff) !important;
  border: 1px solid transparent !important;
  border-radius: 16px !important;
  padding: 5px 14px !important;
  font-size: 13px !important;
  font-weight: 500;
  font-family: inherit !important;
  transition: background-color 0.16s var(--ds-ease-in-out), border-color 0.16s var(--ds-ease-in-out),
    color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out) !important;
}
:root:not([data-uip-settings="off"]) .sif-btn:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, #333) !important;
}
:root:not([data-uip-settings="off"]) .sif-btn.ghost {
  background: transparent !important;
  border-color: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3)) !important;
  color: var(--dsw-alias-label-primary, #222) !important;
}
:root:not([data-uip-settings="off"]) .sif-btn.ghost:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover) !important;
}
:root:not([data-uip-settings="off"]) .sif-btn.danger {
  background: transparent !important;
  border-color: var(--dsw-alias-state-error-primary, #d33) !important;
  color: var(--dsw-alias-state-error-primary, #d33) !important;
}
:root:not([data-uip-settings="off"]) .sif-btn.danger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(211, 51, 51, 0.08)) !important;
}
:root:not([data-uip-settings="off"]) .sif-item {
  border-radius: 12px !important;
  padding: 10px 12px !important;
}
:root:not([data-uip-settings="off"]) .sif-st {
  border-radius: 999px !important;
  padding: 2px 8px !important;
  font-size: 11px !important;
  font-weight: 500;
}
:root:not([data-uip-settings="off"]) .sif-st.on {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2ecc71) 13%, transparent) !important;
  color: var(--dsw-alias-state-success-primary, #2ecc71) !important;
}
:root:not([data-uip-settings="off"]) .sif-st.off {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-label, #b8860b) 13%, transparent) !important;
  color: var(--dsw-alias-state-warn-label, #b8860b) !important;
}
/* log output keeps a mono face (it IS a log), but on official inset colors */
:root:not([data-uip-settings="off"]) .sif-msg {
  background: var(--dsw-alias-bg-module-platform, rgba(127, 127, 127, 0.06)) !important;
  color: var(--dsw-alias-label-secondary, #555) !important;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2)) !important;
  border-radius: 10px !important;
  font-family: var(--ds-font-family-code, ui-monospace, monospace) !important;
  font-size: 12px !important;
}
:root:not([data-uip-settings="off"]) .sif-msg.err {
  border-color: var(--dsw-alias-state-error-primary, #d33) !important;
}

/* 5.7 prompt-principles (.pp*): align with the shared spec */
:root:not([data-uip-settings="off"]) .ppTab {
  max-width: var(--uip-page-w) !important;
  gap: 14px !important;
  padding: 4px 0 12px !important;
}
:root:not([data-uip-settings="off"]) .ppTabHeading {
  font-size: 15px !important;
  letter-spacing: -0.01em;
}
:root:not([data-uip-settings="off"]) .ppTabIntro { line-height: 1.7 !important; }
:root:not([data-uip-settings="off"]) .ppTabCard {
  border-radius: 12px !important;
  padding: 12px 14px !important;
}
:root:not([data-uip-settings="off"]) .ppRow {
  gap: 8px !important;
  align-items: center !important;
  width: 100% !important;
  box-sizing: border-box !important;
  justify-content: flex-start !important;
}
:root:not([data-uip-settings="off"]) .ppRow .ppSwitch { margin-left: auto !important; flex: none !important; }
:root:not([data-uip-settings="off"]) .ppTitle { font-weight: 600 !important; }
:root:not([data-uip-settings="off"]) .ppError {
  max-width: 220px !important;
  font-size: 12px !important;
  line-height: 18px !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}
/* one switch spec everywhere (pp + this plugin): 38×22 accent pill */
:root:not([data-uip-settings="off"]) .ppSwitch {
  width: 38px !important;
  height: 22px !important;
  padding: 2px !important;
  background: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.35)) !important;
  border: none !important;
  border-radius: 999px !important;
  transition: background-color 0.18s var(--ds-ease-in-out) !important;
}
:root:not([data-uip-settings="off"]) .ppSwitch[data-on="true"] {
  background: var(--uip-accent) !important;
}
:root:not([data-uip-settings="off"]) .ppKnob {
  width: 18px !important;
  height: 18px !important;
  background: #fff !important;
  border-radius: 50% !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: translate 0.18s var(--uip-spring) !important;
}

/* 5.8 vision-router (.vr-*) settings surface: same cards, same controls */
:root:not([data-uip-settings="off"]) .vr-card {
  border-radius: 12px !important;
}
:root:not([data-uip-settings="off"]) .vr-select {
  border-radius: 8px !important;
  min-height: 32px !important;
}

/* ═══════════ 6. two-level model selector: adaptive flyout, zero flicker ═══ */
/* Placement: the flyout opens on the RIGHT of the first-level menu (natural
   submenu direction); the JS guard flips it LEFT only when the right side
   would clip, and clamps width when neither side fully fits.

   ANTI-FLICKER CONTRACT (three layers):
   1. The flyout mounts visibility:hidden + animation-play-state:paused and is
      revealed (data-uip-ready) by the guard in the same microtask batch, so
      the first painted frame is already at the correct side AND the entrance
      animation starts from frame 0 (paused → running) instead of having its
      first frames consumed while invisible.
   2. The menu-item stagger delays above exclude .m2-flyout, so entrance/exit
      timing is identical no matter how many flyouts are mounted.
   3. The reduce-motion re-arm block below keeps the close animation alive
      where the selector's own sheet disables it — the React component retires
      a closing flyout ONLY when an animation named m2-flyout-out ends; with
      animation:none the node would never retire and would linger as a
      "zombie" under the next flyout (the other half of the reported 闪烁).

   KEYFRAME CONTRACT: the component checks event.animationName ===
   'm2-flyout-out', so we REDEFINE the shipped keyframes under the same names
   (this sheet loads later and wins) instead of renaming them. */
:root:not([data-uip-menu="off"]) .m2-flyout {
  left: calc(100% + 8px) !important;
  right: auto !important;
  width: 232px !important;
  transform-origin: left bottom;
  visibility: hidden;
  pointer-events: none;
  animation-play-state: paused;
  animation-duration: 0.24s;
  animation-timing-function: var(--uip-spring-pop);
}
:root:not([data-uip-menu="off"]) .m2-flyout[data-uip-ready] {
  visibility: visible;
  pointer-events: auto;
  animation-play-state: running;
}
:root:not([data-uip-menu="off"]) .m2-flyout[data-uip-side="left"] {
  left: auto !important;
  right: calc(100% + 8px) !important;
  transform-origin: right bottom;
}
:root:not([data-uip-menu="off"]) .m2-flyout-closing {
  animation-duration: 0.15s;
  animation-timing-function: var(--ds-ease-in-out);
  /* belt-and-suspenders: the paused-until-ready gate must never freeze an
     exit animation (the node retires on animationend of m2-flyout-out) */
  animation-play-state: running;
}
@keyframes m2-flyout-in {
  from { opacity: 0; scale: 0.96; translate: 0 4px; }
  to   { opacity: 1; scale: 1;    translate: 0 0; }
}
@keyframes m2-flyout-out {
  from { opacity: 1; scale: 1;     translate: 0 0; }
  to   { opacity: 0; scale: 0.975; translate: 0 3px; }
}
/* reduce-motion re-arm: counter the selector sheet's animation:none
   !important so the retirement contract (and the motion itself) survives on
   reduce-motion systems. Higher specificity + later load + !important. */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-uip-menu="off"]) .m2-flyout {
    animation-name: m2-flyout-in !important;
    animation-duration: 0.24s !important;
    animation-timing-function: var(--uip-spring-pop) !important;
  }
  :root:not([data-uip-menu="off"]) .m2-flyout-closing {
    animation-name: m2-flyout-out !important;
    animation-duration: 0.15s !important;
    animation-timing-function: var(--ds-ease-in-out) !important;
    animation-fill-mode: forwards !important;
  }
  :root:not([data-uip-menu="off"]) .m2-triggerLabel,
  :root:not([data-uip-menu="off"]) .m2-triggerEffort,
  :root:not([data-uip-menu="off"]) .m2-cellValue {
    animation: m2-value-in 0.18s var(--ds-ease-in-out) !important;
  }
}
/* whole-menu graceful close (the selector adds .m2-menu-closing and unmounts
   ~150ms later — no more instant vanish when a selection settles) */
:root:not([data-uip-menu="off"]) .m2-menu {
  transform-origin: bottom right;
}
:root:not([data-uip-menu="off"]) .m2-menu-closing {
  animation: m2-menu-out 0.15s var(--ds-ease-in-out) forwards;
  pointer-events: none;
}
@keyframes m2-menu-out {
  from { opacity: 1; scale: 1;    translate: 0 0; }
  to   { opacity: 0; scale: 0.98; translate: 0 4px; }
}
/* first-level rows + flyout options cascade (subtle, capped) */
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-rowsCol > * {
  animation: uip-menu-item 0.2s var(--ds-ease-in-out) both;
}
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-rowsCol > *:nth-child(2) { animation-delay: 26ms; }
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-group .m2-option {
  animation: uip-menu-item 0.18s var(--ds-ease-in-out) both;
}
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-group .m2-option:nth-child(2) { animation-delay: 14ms; }
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-group .m2-option:nth-child(3) { animation-delay: 28ms; }
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-group .m2-option:nth-child(4) { animation-delay: 40ms; }
:root:not([data-uip-anim="off"]):not([data-uip-menu="off"]) .m2-group .m2-option:nth-child(n+5) { animation-delay: 52ms; }
/* selector chrome polish: hover transitions + official item padding */
:root:not([data-uip-menu="off"]) .m2-trigger,
:root:not([data-uip-menu="off"]) .m2-cell,
:root:not([data-uip-menu="off"]) .m2-option {
  transition: background-color 0.16s var(--ds-ease-in-out), color 0.16s var(--ds-ease-in-out),
    box-shadow 0.16s var(--ds-ease-in-out);
}
:root:not([data-uip-menu="off"]) .m2-option {
  padding: 8px 10px;
}
:root:not([data-uip-menu="off"]) .m2-chevron,
:root:not([data-uip-menu="off"]) .m2-cellChevron {
  transition: transform 0.18s var(--uip-spring);
}
/* toast entrance (restrained spring, no hard snap) */
:root:not([data-uip-menu="off"]) .m2-toast {
  animation: uip-toast-in 0.32s var(--uip-spring) !important;
}
@keyframes uip-toast-in {
  from { opacity: 0; transform: translate(-50%, -8px) scale(0.97); }
  to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

/* ═══════════ 7. this plugin's own settings page (.uip-*) ══════════════════ */
.uip-page {
  padding: 4px 0 16px;
  max-width: var(--uip-page-w);
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
  line-height: 1.65;
}
.uip-head { display: flex; flex-direction: column; gap: 4px; }
.uip-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary);
}
.uip-sub { margin: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.uip-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.uip-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  border-radius: 12px;
  transition: border-color 0.16s var(--ds-ease-in-out), box-shadow 0.16s var(--ds-ease-in-out);
}
.uip-row:hover {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  box-shadow: 0 2px 12px -4px rgba(15, 23, 42, 0.14);
}
.uip-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.uip-name { font-weight: 600; color: var(--dsw-alias-label-primary); }
.uip-desc { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.uip-switch {
  flex: none;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  border: none;
  padding: 2px;
  cursor: pointer;
  background: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.35));
  transition: background-color 0.18s var(--ds-ease-in-out);
}
.uip-switch.on { background: var(--uip-accent); }
.uip-knob {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: translate 0.18s var(--uip-spring);
}
.uip-switch.on .uip-knob { translate: 16px 0; }
.uip-foot { display: flex; align-items: center; gap: 12px; }
.uip-reset {
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.3));
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  border-radius: 16px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.16s var(--ds-ease-in-out), border-color 0.16s var(--ds-ease-in-out);
}
.uip-reset:hover { background: var(--dsw-alias-interactive-bg-hover); }
.uip-note { margin: 0; font-size: 11px; color: var(--dsw-alias-label-tertiary); }

/* Animations are intentionally always on (restrained amplitudes, no
   prefers-reduced-motion gating) per the user's preference for subtle but
   present motion. */
`;

    // ── flyout viewport guard ────────────────────────────────────────────────
    // CSS defaults the flyout to the RIGHT of the first-level menu. The guard
    // flips it LEFT only when the right side would clip — and when neither
    // side fits fully, it picks the wider side and clamps max-width. It never
    // touches vertical anchoring. While the guard is measuring, the flyout
    // stays hidden with its entrance animation paused (see CSS), so the first
    // painted frame is already final.
    const setupFlyoutGuard = () => {
      const GAP = 8;
      const MIN_W = 120;
      const EDGE = 12; // visual margin — the flyout never kisses the viewport edge
      const FLYOUT_W = 232; // mirrors the .m2-flyout width above
      const place = (el) => {
        if (!(el instanceof HTMLElement)) return;
        // When the feature is off, the CSS visibility rule doesn't apply, so
        // there is nothing to hide or reveal.
        if (document.documentElement.getAttribute("data-uip-menu") === "off")
          return;
        try {
          const menu = el.parentElement;
          if (menu && typeof menu.getBoundingClientRect === "function") {
            const mr = menu.getBoundingClientRect();
            if (mr.width > 0) {
              const vw =
                document.documentElement.clientWidth || window.innerWidth;
              const fw = Math.min(FLYOUT_W, vw - 48); // mirrors the .m2-flyout width
              const spaceLeft = mr.left - GAP - EDGE;
              const spaceRight = vw - mr.right - GAP - EDGE;
              // Default = right. Flip to left only when right would clip.
              if (spaceRight >= fw) {
                el.removeAttribute("data-uip-side"); // right (CSS default)
                el.style.maxWidth = "";
              } else if (spaceLeft >= fw || spaceLeft >= spaceRight) {
                el.setAttribute("data-uip-side", "left");
                el.style.maxWidth =
                  spaceLeft >= fw
                    ? ""
                    : Math.max(MIN_W, Math.floor(spaceLeft)) + "px";
              } else {
                // neither side fits fully → pick the wider, clamp width
                if (spaceRight >= spaceLeft) {
                  el.removeAttribute("data-uip-side");
                  el.style.maxWidth =
                    Math.max(MIN_W, Math.floor(spaceRight)) + "px";
                } else {
                  el.setAttribute("data-uip-side", "left");
                  el.style.maxWidth =
                    Math.max(MIN_W, Math.floor(spaceLeft)) + "px";
                }
              }
            }
          }
        } catch (_) {
          /* measure failed — reveal at default rather than stay hidden */
        }
        // ALWAYS reveal once settled (or best-effort): the CSS keeps the
        // flyout hidden until data-uip-ready, so this must run on every pass
        // to guarantee it is never stuck invisible. Visible-at-default is
        // strictly better than hidden.
        el.setAttribute("data-uip-ready", "");
      };
      const scan = (root) => {
        if (!root || root.nodeType !== 1) return;
        if (typeof root.matches === "function" && root.matches(".m2-flyout"))
          place(root);
        if (typeof root.querySelectorAll === "function") {
          root.querySelectorAll(".m2-flyout").forEach(place);
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) scan(node);
        }
        requestAnimationFrame(() => {
          document
            .querySelectorAll(".m2-flyout:not([data-uip-ready])")
            .forEach(place);
        });
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      const onResize = () =>
        document.querySelectorAll(".m2-flyout").forEach(place);
      window.addEventListener("resize", onResize);
      document.querySelectorAll(".m2-flyout").forEach(place);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", onResize);
      };
    };

    // ── settings nav de-duplicator ───────────────────────────────────────────
    // Two sections can register the same nav label (the injector's page and
    // the official plugins page both render as「插件」). When a collision is
    // detected, rename the later cell from a small known-collision map so the
    // nav stays unambiguous. Text-only, re-runs on nav mutations, idempotent.
    const NAV_RENAMES = { 插件: "插件管理" };
    const setupNavDedup = () => {
      const dedup = () => {
        if (
          document.documentElement.getAttribute("data-uip-settings") === "off"
        )
          return;
        const cells = document.querySelectorAll(
          '[role="dialog"][class*="_panel"] [class*="_navCell"]',
        );
        if (cells.length === 0) return;
        const seen = new Map();
        for (const cell of cells) {
          const labelEl = cell.querySelector('[class*="_navLabel"]') || cell;
          const text = (labelEl.textContent || "").trim();
          if (text === "") continue;
          if (!seen.has(text)) {
            seen.set(text, cell);
            continue;
          }
          // collision: rename THIS (later) cell once
          const rename = NAV_RENAMES[text];
          if (
            rename !== undefined &&
            text !== rename &&
            labelEl.textContent.trim() !== rename
          ) {
            labelEl.textContent = rename;
            seen.set(rename, cell);
          }
        }
      };
      const observer = new MutationObserver(() => dedup());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      dedup();
      return () => observer.disconnect();
    };

    // ── settings page ────────────────────────────────────────────────────────
    const FEATURES = [
      {
        key: "anim",
        name: "全局动效",
        desc: "消息入场、菜单逐项弹出、对话框升起、按钮按压回弹等一整套平滑动画，幅度克制但始终在线。",
      },
      {
        key: "menu",
        name: "模型二级菜单增强",
        desc: "二级飞出菜单默认从一级菜单右侧展开、贴近窗口边缘时自动换边或收窄；入场/退场动画全程防抖，快速切换交叉淡入不闪烁。",
      },
      {
        key: "sidebar",
        name: "侧边栏质感",
        desc: "会话行圆角与悬浮反馈、选中会话的柔和高亮、底部按钮过渡，让会话列表层次分明。",
      },
      {
        key: "settings",
        name: "设置面板清晰化",
        desc: "设置弹窗重排：带分隔的导航侧栏、统一的内容栏宽与排版节奏，所有插件页统一调用官方设计令牌（输入框、按钮、卡片一致）。",
      },
    ];

    function Toggle(props) {
      return React.createElement(
        "button",
        {
          type: "button",
          role: "switch",
          "aria-checked": props.on,
          "aria-label": props.name,
          className: "uip-switch" + (props.on ? " on" : ""),
          onClick: () => props.onChange(!props.on),
        },
        React.createElement("span", { className: "uip-knob" }),
      );
    }

    function PolishPage() {
      const [prefs, setPrefs] = React.useState(() => loadPrefs());
      const commit = (next) => {
        setPrefs(next);
        savePrefs(next);
        applyAttrs(next);
      };
      const rows = FEATURES.map((f) =>
        React.createElement(
          "li",
          { key: f.key, className: "uip-row" },
          React.createElement(
            "div",
            { className: "uip-copy" },
            React.createElement("span", { className: "uip-name" }, f.name),
            React.createElement("span", { className: "uip-desc" }, f.desc),
          ),
          React.createElement(Toggle, {
            on: prefs[f.key] !== false,
            name: f.name,
            onChange: (value) => commit({ ...prefs, [f.key]: value }),
          }),
        ),
      );
      return React.createElement(
        "div",
        { className: "uip-page" },
        React.createElement(
          "div",
          { className: "uip-head" },
          React.createElement("h3", { className: "uip-title" }, "界面焕新"),
          React.createElement(
            "p",
            { className: "uip-sub" },
            "注入式界面美化：动画、排版与交互反馈。改动即时生效，无需重启；配置仅保存在本机。",
          ),
        ),
        React.createElement("ul", { className: "uip-list" }, rows),
        React.createElement(
          "div",
          { className: "uip-foot" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "uip-reset",
              onClick: () => commit({ ...DEFAULTS }),
            },
            "恢复默认",
          ),
          React.createElement(
            "p",
            { className: "uip-note" },
            "dsh-ui-polish v1.1.0 · 全部开关默认开启 · 关闭后对应的样式组立即停用",
          ),
        ),
      );
    }

    // ── apply ────────────────────────────────────────────────────────────────
    function apply(ctx) {
      applyAttrs(loadPrefs());

      const insertStyles = (css) => {
        const el = document.createElement("style");
        el.setAttribute("data-plugin", "dsh-ui-polish");
        el.textContent = css;
        document.head.appendChild(el);
        return () => {
          el.remove();
        };
      };
      ctx.effect(() => insertStyles(CSS), "dsh-ui-polish: styles");
      ctx.effect(() => setupFlyoutGuard(), "dsh-ui-polish: flyout guard");
      ctx.effect(() => setupNavDedup(), "dsh-ui-polish: nav dedup");

      const slots = ctx.get("slots");
      if (slots !== undefined) {
        slots.inject("settings.section", () =>
          slots.register(
            {
              name: "settings.section",
              id: "ui-polish",
              order: 80,
              priority: 0,
              label: () => "界面焕新",
            },
            PolishPage,
          ),
        );
      }
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
