window.__ModuleLoader__.load({
  id: "deepseek-harness-desktop-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/desktop-plugin/src/stream-output-model.js
function findAppendedGraphemes(previous, next, segmenter = graphemeSegmenter) {
  if (!next.startsWith(previous)) return null;
  const suffix = next.slice(previous.length);
  const parts = [...segmenter.segment(suffix)];
  if (parts[0]?.index === 0 && /^\p{Mark}/u.test(parts[0].segment)) return null;
  return parts.map((part, order) => ({
    text: part.segment,
    start: previous.length + part.index,
    end: previous.length + part.index + part.segment.length,
    order
  }));
}
function isEligibleStreamTextNode(node) {
  if (!node || node.nodeType !== 3 || node.data.trim().length === 0)
    return false;
  const parent = node.parentElement;
  if (!parent || !parent.closest(STREAMING_ASSISTANT_SELECTOR)) return false;
  return parent.closest(EXCLUDED_OUTPUT_SELECTOR) === null;
}
function eligibleTextNodes(root) {
  if (!root?.ownerDocument) return [];
  const nodes = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isEligibleStreamTextNode(node)) nodes.push(node);
  }
  return nodes;
}
var STREAMING_ASSISTANT_SELECTOR, EXCLUDED_OUTPUT_SELECTOR, graphemeSegmenter;
var init_stream_output_model = __esm({
  "packages/desktop-plugin/src/stream-output-model.js"() {
    "use strict";
    STREAMING_ASSISTANT_SELECTOR = '[data-chat-flow-kind="assistant-step"] [data-streaming]';
    EXCLUDED_OUTPUT_SELECTOR = [
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
      "[data-terminal]"
    ].join(",");
    graphemeSegmenter = new Intl.Segmenter(void 0, {
      granularity: "grapheme"
    });
  }
});

// packages/desktop-plugin/src/stream-output-controller.js
var stream_output_controller_exports = {};
__export(stream_output_controller_exports, {
  createStreamOutputEffectController: () => createStreamOutputEffectController,
  installStreamOutputEffects: () => installStreamOutputEffects
});
function mediaQueryOf(win) {
  return typeof win.matchMedia === "function" ? win.matchMedia("(prefers-reduced-motion: reduce)") : void 0;
}
function textNodesIn(node) {
  if (node?.nodeType === 3) return [node];
  if (node?.nodeType === 1) return eligibleTextNodes(node);
  return [];
}
function createStreamOutputEffectController({
  document: doc,
  window: win
}) {
  let observer;
  let overlay;
  let highlight;
  let frameId;
  let started = false;
  let disposed = false;
  let snapshots = /* @__PURE__ */ new WeakMap();
  let pending = [];
  const activeEffects = /* @__PURE__ */ new Set();
  const effectsBySource = /* @__PURE__ */ new Map();
  const reducedMotion = mediaQueryOf(win);
  const animationAllowed = () => !reducedMotion?.matches && typeof win.Highlight === "function" && Boolean(win.CSS?.highlights);
  const ensurePaintResources = () => {
    if (!animationAllowed()) return false;
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.dataset.dshStreamOverlay = "";
      overlay.setAttribute("aria-hidden", "true");
      doc.body.appendChild(overlay);
    }
    if (!highlight) {
      highlight = new win.Highlight();
      win.CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    }
    return true;
  };
  const removeEffect = (effect) => {
    if (!activeEffects.delete(effect)) return;
    win.clearTimeout(effect.timer);
    highlight?.delete(effect.range);
    effect.glyph.remove();
    const sourceEffects = effectsBySource.get(effect.source);
    sourceEffects?.delete(effect);
    if (sourceEffects?.size === 0) effectsBySource.delete(effect.source);
  };
  const cancelSource = (source) => {
    pending = pending.filter((entry) => entry.source !== source);
    for (const effect of [...effectsBySource.get(source) ?? []])
      removeEffect(effect);
  };
  const cancelAll = () => {
    pending = [];
    if (frameId !== void 0) {
      win.cancelAnimationFrame(frameId);
      frameId = void 0;
    }
    for (const effect of [...activeEffects]) removeEffect(effect);
    highlight?.clear();
  };
  const copyTypography = (target, computed) => {
    const properties = [
      "font",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "fontStretch",
      "fontKerning",
      "fontFeatureSettings",
      "fontVariationSettings",
      "lineHeight",
      "letterSpacing",
      "textTransform",
      "color"
    ];
    for (const property of properties) {
      if (computed[property]) target.style[property] = computed[property];
    }
  };
  const createGlyph = (entry, range, rect, computed) => {
    const glyph = doc.createElement("span");
    glyph.dataset.dshStreamGlyph = "";
    glyph.appendChild(doc.createTextNode(entry.text));
    glyph.style.left = `${rect.left}px`;
    glyph.style.top = `${rect.top}px`;
    glyph.style.width = `${rect.width}px`;
    glyph.style.height = `${rect.height}px`;
    glyph.style.whiteSpace = "pre";
    const delay = Math.min(entry.order * 20, MAX_STAGGER_MS);
    glyph.style.setProperty("--dsh-stream-delay", `${delay}ms`);
    copyTypography(glyph, computed);
    if (!/^\s+$/u.test(entry.text)) {
      for (let index = 0; index < 3; index += 1) {
        const particle = doc.createElement("i");
        particle.dataset.dshStreamParticle = String(index);
        glyph.appendChild(particle);
      }
    }
    overlay.appendChild(glyph);
    highlight.add(range);
    const effect = {
      source: entry.source,
      range,
      glyph,
      timer: 0
    };
    effect.timer = win.setTimeout(
      () => removeEffect(effect),
      Math.min(CLEANUP_DEADLINE_MS, DISSOLVE_DURATION_MS + delay)
    );
    activeEffects.add(effect);
    const sourceEffects = effectsBySource.get(entry.source) ?? /* @__PURE__ */ new Set();
    sourceEffects.add(effect);
    effectsBySource.set(entry.source, sourceEffects);
  };
  const flushPending = () => {
    frameId = void 0;
    if (!ensurePaintResources()) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    for (const entry of batch) {
      if (!entry.source.isConnected || !isEligibleStreamTextNode(entry.source) || entry.source.data.slice(entry.start, entry.end) !== entry.text) {
        continue;
      }
      try {
        const range = doc.createRange();
        range.setStart(entry.source, entry.start);
        range.setEnd(entry.source, entry.end);
        const rect = range.getBoundingClientRect();
        const parent = entry.source.parentElement;
        if (!parent || rect.width <= 0 || rect.height <= 0) continue;
        createGlyph(entry, range, rect, win.getComputedStyle(parent));
      } catch {
        cancelSource(entry.source);
      }
    }
  };
  const schedule = (entries) => {
    if (entries.length === 0 || !animationAllowed()) return;
    pending.push(...entries);
    if (frameId === void 0)
      frameId = win.requestAnimationFrame(flushPending);
  };
  const processText = (source, previous) => {
    const next = source.data;
    snapshots.set(source, next);
    if (!isEligibleStreamTextNode(source)) {
      cancelSource(source);
      return;
    }
    const appended = findAppendedGraphemes(previous, next);
    if (appended === null) {
      cancelSource(source);
      return;
    }
    schedule(appended.map((entry) => ({ ...entry, source })));
  };
  const baseline = (root = doc) => {
    for (const streamingRoot of root.querySelectorAll(
      STREAMING_ASSISTANT_SELECTOR
    )) {
      for (const node of eligibleTextNodes(streamingRoot))
        snapshots.set(node, node.data);
    }
  };
  const handleMutations = (records) => {
    if (disposed) return;
    for (const record of records) {
      if (record.type === "characterData") {
        const source = record.target;
        const previous = snapshots.get(source) ?? record.oldValue ?? "";
        processText(source, previous);
        continue;
      }
      if (record.type === "attributes") {
        cancelAll();
        snapshots = /* @__PURE__ */ new WeakMap();
        if (record.target.hasAttribute("data-streaming"))
          baseline(record.target);
        continue;
      }
      for (const removed of record.removedNodes) {
        for (const source of textNodesIn(removed)) cancelSource(source);
      }
      const replacement = record.removedNodes.length > 0;
      for (const added of record.addedNodes) {
        for (const source of textNodesIn(added)) {
          if (!isEligibleStreamTextNode(source)) continue;
          if (replacement) snapshots.set(source, source.data);
          else processText(source, "");
        }
      }
    }
    if (!doc.querySelector(STREAMING_ASSISTANT_SELECTOR)) cancelAll();
  };
  const onViewportChange = () => cancelAll();
  const onReducedMotionChange = () => {
    cancelAll();
    snapshots = /* @__PURE__ */ new WeakMap();
    baseline();
    if (!reducedMotion?.matches) ensurePaintResources();
  };
  const start = () => {
    if (started || disposed || !doc.body) return;
    started = true;
    baseline();
    ensurePaintResources();
    observer = new win.MutationObserver(handleMutations);
    observer.observe(doc.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeFilter: ["data-streaming"]
    });
    win.addEventListener("scroll", onViewportChange, true);
    win.addEventListener("resize", onViewportChange);
    win.addEventListener("popstate", onViewportChange);
    win.addEventListener("hashchange", onViewportChange);
    reducedMotion?.addEventListener("change", onReducedMotionChange);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    cancelAll();
    win.CSS?.highlights?.delete(HIGHLIGHT_NAME);
    highlight = void 0;
    overlay?.remove();
    overlay = void 0;
    win.removeEventListener("scroll", onViewportChange, true);
    win.removeEventListener("resize", onViewportChange);
    win.removeEventListener("popstate", onViewportChange);
    win.removeEventListener("hashchange", onViewportChange);
    reducedMotion?.removeEventListener("change", onReducedMotionChange);
  };
  return { start, dispose };
}
function installStreamOutputEffects(doc = document, win = window) {
  const controller = createStreamOutputEffectController({
    document: doc,
    window: win
  });
  controller.start();
  return () => controller.dispose();
}
var HIGHLIGHT_NAME, DISSOLVE_DURATION_MS, MAX_STAGGER_MS, CLEANUP_DEADLINE_MS;
var init_stream_output_controller = __esm({
  "packages/desktop-plugin/src/stream-output-controller.js"() {
    "use strict";
    init_stream_output_model();
    HIGHLIGHT_NAME = "dsh-desktop-stream-mask";
    DISSOLVE_DURATION_MS = 460;
    MAX_STAGGER_MS = 200;
    CLEANUP_DEADLINE_MS = 700;
  }
});

// packages/desktop-plugin/src/client-runtime.cjs
var React = require("react");
var {
  createStreamOutputEffectController: createStreamOutputEffectController2,
  installStreamOutputEffects: installStreamOutputEffects2
} = (init_stream_output_controller(), __toCommonJS(stream_output_controller_exports));
var {
  Button,
  IconChevronDownOutline14,
  Menu
} = require("@deepseek-ai/dsh-client-ui-primitives");
var activeDesktopInstallation;
var DESKTOP_LOCALE_NAMESPACE = "settings.desktop";
var DESKTOP_LOCALES = {
  zh: {
    "runtime.title": "\u684C\u9762\u8FD0\u884C\u72B6\u6001",
    "runtime.status": "Harness {phase}\uFF1B\u91CD\u542F\u6B21\u6570\uFF1A{count}",
    "phase.starting": "\u6B63\u5728\u542F\u52A8",
    "phase.ready": "\u5DF2\u5C31\u7EEA",
    "phase.recovering": "\u6B63\u5728\u6062\u590D",
    "phase.failed": "\u542F\u52A8\u5931\u8D25",
    "phase.stopping": "\u6B63\u5728\u505C\u6B62",
    "close.title": "\u5173\u95ED\u7A97\u53E3\u65F6",
    "close.ask": "\u9996\u6B21\u5173\u95ED\u65F6\u8BE2\u95EE",
    "close.minimize": "\u6700\u5C0F\u5316\u5230\u83DC\u5355\u680F",
    "close.quit": "\u5F7B\u5E95\u9000\u51FA\u5E94\u7528",
    "anchored.title": "\u542F\u7528 Anchored Standard\uFF08\u5B9E\u9A8C\u6027\uFF09",
    "anchored.enabled": "\u5DF2\u542F\u7528",
    "anchored.disabled": "\u672A\u542F\u7528",
    "anchored.fallback": "\u5F53\u524D rc.6 \u5B89\u5168\u6A21\u5F0F\uFF1A\u6240\u6709\u8F6E\u6B21\u7EE7\u7EED\u4F7F\u7528 Standard\u3002",
    "action.restart": "\u91CD\u542F Harness",
    "action.logs": "\u6253\u5F00\u65E5\u5FD7"
  },
  en: {
    "runtime.title": "Desktop runtime",
    "runtime.status": "Harness {phase}; restarts: {count}",
    "phase.starting": "starting",
    "phase.ready": "ready",
    "phase.recovering": "recovering",
    "phase.failed": "failed",
    "phase.stopping": "stopping",
    "close.title": "When this window closes",
    "close.ask": "Ask on first close",
    "close.minimize": "Minimize to menu bar",
    "close.quit": "Quit application",
    "anchored.title": "Use Anchored Standard (experimental)",
    "anchored.enabled": "Enabled",
    "anchored.disabled": "Disabled",
    "anchored.fallback": "Current rc.6 safe mode: Standard for all turns.",
    "action.restart": "Restart Harness",
    "action.logs": "Open logs"
  }
};
function bridgeOf(win) {
  return win && win.deepseekDesktop;
}
function hasGroupedCapabilities(bridge) {
  return Boolean(
    bridge && bridge.preferences && typeof bridge.preferences.get === "function" && typeof bridge.preferences.set === "function" && bridge.runtime && typeof bridge.runtime.getState === "function" && typeof bridge.runtime.subscribe === "function"
  );
}
function createDesktopSettingsModel(bridge, onChange = () => {
}) {
  let stopSubscription;
  const groupedCapabilities = hasGroupedCapabilities(bridge);
  const reportError = (error) => {
    model.error = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    onChange(model);
  };
  const model = {
    state: void 0,
    closeBehavior: void 0,
    anchoredStandard: void 0,
    preferencesSupported: groupedCapabilities,
    error: void 0,
    async start() {
      try {
        const [state, preferences] = groupedCapabilities ? await Promise.all([
          bridge.runtime.getState(),
          bridge.preferences.get()
        ]) : await Promise.all([
          bridge.getRuntimeState(),
          bridge.getCloseBehavior().then((closeBehavior) => ({
            closeBehavior,
            anchoredStandard: void 0
          }))
        ]);
        model.state = state;
        model.closeBehavior = preferences.closeBehavior;
        model.anchoredStandard = preferences.anchoredStandard;
        const subscribe = groupedCapabilities ? bridge.runtime.subscribe : bridge.subscribeRuntime;
        stopSubscription = subscribe.call(
          groupedCapabilities ? bridge.runtime : bridge,
          (next) => {
            model.state = next;
            onChange(model);
          }
        );
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    stop() {
      if (stopSubscription) {
        stopSubscription();
        stopSubscription = void 0;
      }
    },
    async restart() {
      try {
        await (groupedCapabilities ? bridge.runtime.restartHarness() : bridge.restartHarness());
      } catch (error) {
        reportError(error);
      }
    },
    async openLogs() {
      try {
        await (groupedCapabilities ? bridge.runtime.openLogs() : bridge.openLogs());
      } catch (error) {
        reportError(error);
      }
    },
    async setCloseBehavior(value) {
      try {
        if (groupedCapabilities) {
          await bridge.preferences.set({
            closeBehavior: value,
            anchoredStandard: Boolean(model.anchoredStandard)
          });
        } else {
          await bridge.setCloseBehavior(value);
        }
        model.closeBehavior = value;
        onChange(model);
      } catch (error) {
        reportError(error);
      }
    },
    async setAnchoredStandard(value) {
      if (!groupedCapabilities) return;
      try {
        await bridge.preferences.set({
          closeBehavior: model.closeBehavior === "quit" ? "quit" : "minimize",
          anchoredStandard: value
        });
        model.anchoredStandard = value;
        onChange(model);
        await bridge.runtime.restartHarness();
      } catch (error) {
        reportError(error);
      }
    }
  };
  return model;
}
function pageKind(pathname) {
  if (pathname.includes("settings")) return "settings";
  if (pathname.includes("workspace")) return "workspace";
  if (pathname.includes("subagent")) return "subagent";
  if (pathname.includes("session") || pathname.includes("chat"))
    return "session";
  return "shell";
}
function platformKind(win) {
  const platform = String(
    win.navigator && (win.navigator.userAgentData?.platform || win.navigator.platform) || ""
  ).toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "web";
}
function recoveryState(doc) {
  if (doc.querySelector && doc.querySelector('[aria-busy="true"]'))
    return "loading";
  if (doc.querySelector && doc.querySelector('[role="alert"]')) return "error";
  return "ready";
}
function installTransitions(doc = document, win = window) {
  if (!doc || !win || !doc.documentElement) return () => {
  };
  const root = doc.documentElement;
  const prefersReducedMotion = () => Boolean(
    win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const styleId = "deepseek-harness-desktop-transitions";
  if (doc.getElementById(styleId) === null) {
    const style = doc.createElement("style");
    style.id = styleId;
    style.textContent = `${':root[data-dsh-desktop-page] {\n  --dsh-desktop-transition-duration: 180ms;\n  --dsh-desktop-titlebar-safe-inset: 0px;\n  --dsh-desktop-titlebar-height: 0px;\n}\n\n:root[data-dsh-desktop-platform="macos"] {\n  --dsh-desktop-titlebar-safe-inset: 78px;\n  --dsh-desktop-titlebar-height: 28px;\n}\n\n:root[data-dsh-desktop-platform="macos"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-platform="macos"] header [aria-label*="DeepSeek" i],\n:root[data-dsh-desktop-platform="macos"] header [data-dsh-desktop-title] {\n  margin-left: var(--dsh-desktop-titlebar-safe-inset);\n  padding-top: var(--dsh-desktop-titlebar-height);\n}\n\n:root[data-dsh-desktop-platform] header,\n:root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n  background: color-mix(in srgb, Canvas 78%, transparent);\n  backdrop-filter: blur(14px) saturate(1.08);\n}\n\n[data-dsh-desktop-settings] {\n  color: var(--dsw-alias-label-primary, CanvasText);\n  border-top: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  padding: 20px 0 8px;\n}\n\n.dshDesktopSettingsTitle {\n  margin: 0;\n  font-size: 16px;\n  font-weight: 600;\n  line-height: 24px;\n}\n\n.dshDesktopSettingsStatus,\n.dshDesktopSettingsNote {\n  color: var(\n    --dsw-alias-label-secondary,\n    color-mix(in srgb, CanvasText 62%, transparent)\n  );\n  margin: 4px 0 12px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dshDesktopSettingsRow {\n  border-bottom: 1px solid\n    var(--dsw-alias-border-l2, color-mix(in srgb, CanvasText 14%, transparent));\n  align-items: center;\n  gap: 16px;\n  min-height: 68px;\n  display: flex;\n}\n\n.dshDesktopSettingsLabel {\n  flex: 1;\n  min-width: 0;\n  font-size: 14px;\n  line-height: 22px;\n}\n\n.dshDesktopSettingsControl {\n  flex: 0 1 280px;\n  min-width: 0;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.dshDesktopSettingsDropdownButton {\n  width: min(100%, 260px);\n  min-width: 0;\n  display: inline-flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.dshDesktopSettingsDropdownLabel {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dshDesktopSettingsDropdownIcon {\n  flex: 0 0 auto;\n}\n\n.dshDesktopSettingsActions {\n  gap: 8px;\n  padding-top: 12px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n@media (max-width: 760px) {\n  .dshDesktopSettingsRow {\n    align-items: stretch;\n    flex-direction: column;\n    gap: 8px;\n    padding: 12px 0;\n  }\n\n  .dshDesktopSettingsControl {\n    flex: 0 0 auto;\n    justify-content: flex-start;\n  }\n}\n\n:root[data-dsh-desktop-page] main,\n:root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-recovery] [role="alert"] {\n  animation: dsh-desktop-enter var(--dsh-desktop-transition-duration) ease-out\n    both;\n}\n\n:root[data-dsh-desktop-recovery="loading"] [aria-busy="true"],\n:root[data-dsh-desktop-recovery="error"] [role="alert"] {\n  animation-duration: 180ms;\n}\n\n:root[data-dsh-desktop-animation="odd"] main,\n:root[data-dsh-desktop-animation="odd"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="odd"] [role="alert"],\n:root[data-dsh-desktop-animation="odd"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-odd;\n}\n\n:root[data-dsh-desktop-animation="even"] main,\n:root[data-dsh-desktop-animation="even"] [data-dsh-desktop-breadcrumb],\n:root[data-dsh-desktop-animation="even"] [role="alert"],\n:root[data-dsh-desktop-animation="even"] [aria-busy="true"] {\n  animation-name: dsh-desktop-enter-even;\n}\n\n@keyframes dsh-desktop-enter {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-odd {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@keyframes dsh-desktop-enter-even {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :root[data-dsh-desktop-page] main,\n  :root[data-dsh-desktop-page] [data-dsh-desktop-breadcrumb],\n  :root[data-dsh-desktop-recovery] [role="alert"] {\n    animation: none;\n  }\n\n  :root[data-dsh-desktop-platform] header,\n  :root[data-dsh-desktop-platform] [data-dsh-desktop-breadcrumb] {\n    backdrop-filter: none;\n  }\n}\n'}
${'[data-dsh-stream-overlay] {\n  position: fixed;\n  inset: 0;\n  z-index: 30;\n  pointer-events: none;\n  contain: strict;\n}\n\n::highlight(dsh-desktop-stream-mask) {\n  color: transparent;\n  -webkit-text-fill-color: transparent;\n}\n\n[data-dsh-stream-glyph] {\n  position: fixed;\n  display: block;\n  overflow: visible;\n  opacity: 0.05;\n  filter: blur(3px);\n  clip-path: inset(0 100% 0 0);\n  animation: dsh-stream-dissolve 460ms ease-out both;\n  animation-delay: var(--dsh-stream-delay, 0ms);\n}\n\n[data-dsh-stream-particle] {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 2px;\n  height: 2px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: 0;\n  animation: dsh-stream-particle 460ms ease-out both;\n  animation-delay: var(--dsh-stream-delay, 0ms);\n}\n\n[data-dsh-stream-particle="0"] {\n  --dsh-particle-x: -0.45em;\n  --dsh-particle-y: -0.35em;\n}\n\n[data-dsh-stream-particle="1"] {\n  --dsh-particle-x: 0.5em;\n  --dsh-particle-y: -0.15em;\n}\n\n[data-dsh-stream-particle="2"] {\n  --dsh-particle-x: 0.15em;\n  --dsh-particle-y: 0.45em;\n}\n\n@keyframes dsh-stream-dissolve {\n  0% {\n    opacity: 0.05;\n    filter: blur(3px);\n    clip-path: inset(0 100% 0 0);\n  }\n\n  55% {\n    opacity: 0.82;\n    filter: blur(0.8px);\n  }\n\n  100% {\n    opacity: 1;\n    filter: blur(0);\n    clip-path: inset(0 0 0 0);\n  }\n}\n\n@keyframes dsh-stream-particle {\n  0%,\n  100% {\n    opacity: 0;\n    transform: translate(0, 0) scale(0.4);\n  }\n\n  42% {\n    opacity: 0.58;\n  }\n\n  78% {\n    opacity: 0;\n    transform: translate(var(--dsh-particle-x), var(--dsh-particle-y)) scale(1);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-stream-glyph],\n  [data-dsh-stream-particle] {\n    animation: none;\n  }\n}\n'}`;
    doc.head.appendChild(style);
  }
  const update = () => {
    root.dataset.dshDesktopPage = pageKind(win.location.pathname);
    root.dataset.dshDesktopPlatform = platformKind(win);
    root.dataset.dshDesktopRecovery = recoveryState(doc);
    root.dataset.dshDesktopTransition = doc.startViewTransition && !prefersReducedMotion() ? "view" : "css";
  };
  const transition = () => {
    if (doc.startViewTransition && !prefersReducedMotion())
      doc.startViewTransition(update);
    else update();
  };
  let routeObserver;
  let transitionNonce = 0;
  const restartCommittedAnimation = () => {
    if (prefersReducedMotion()) return;
    transitionNonce += 1;
    root.dataset.dshDesktopTransitionNonce = String(transitionNonce);
    root.dataset.dshDesktopAnimation = transitionNonce % 2 === 0 ? "even" : "odd";
  };
  const observeRouteCommit = () => {
    const MutationObserver = win.MutationObserver;
    const body = doc.body;
    if (!MutationObserver || !body) return;
    if (routeObserver) routeObserver.disconnect();
    routeObserver = new MutationObserver((records) => {
      if (records.length === 0) return;
      routeObserver.disconnect();
      routeObserver = void 0;
      restartCommittedAnimation();
    });
    routeObserver.observe(body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };
  const routeChanged = () => {
    transition();
    observeRouteCommit();
  };
  transition();
  win.addEventListener("popstate", routeChanged);
  win.addEventListener("hashchange", routeChanged);
  const history = win.history;
  const pushState = history && history.pushState;
  const replaceState = history && history.replaceState;
  if (pushState)
    history.pushState = function(...args) {
      const result = pushState.apply(this, args);
      routeChanged();
      return result;
    };
  if (replaceState)
    history.replaceState = function(...args) {
      const result = replaceState.apply(this, args);
      routeChanged();
      return result;
    };
  return () => {
    win.removeEventListener("popstate", routeChanged);
    win.removeEventListener("hashchange", routeChanged);
    if (routeObserver) routeObserver.disconnect();
    if (pushState) history.pushState = pushState;
    if (replaceState) history.replaceState = replaceState;
  };
}
function DesktopSettingsRow({ t }) {
  const bridge = bridgeOf(window);
  const [model, setModel] = React.useState(
    () => bridge ? createDesktopSettingsModel(bridge) : void 0
  );
  const [closeMenuOpen, setCloseMenuOpen] = React.useState(false);
  React.useEffect(() => {
    if (!bridge) return void 0;
    const activeModel = createDesktopSettingsModel(
      bridge,
      () => setModel({ ...activeModel })
    );
    void activeModel.start();
    return () => activeModel.stop();
  }, [bridge]);
  if (!bridge || !model) return null;
  const phase = model.state ? model.state.phase : "starting";
  const restarts = model.state ? model.state.restartCount : 0;
  const closeBehavior = model.closeBehavior || "ask";
  const closeItems = [
    { id: "ask", label: t("close.ask"), disabled: true },
    { id: "minimize", label: t("close.minimize") },
    { id: "quit", label: t("close.quit") }
  ];
  const closeLabel = t(`close.${closeBehavior}`);
  return React.createElement(
    "section",
    {
      "data-dsh-desktop-settings": "true",
      className: "dshDesktopSettings",
      "aria-label": t("runtime.title")
    },
    React.createElement(
      "h3",
      { className: "dshDesktopSettingsTitle" },
      t("runtime.title")
    ),
    React.createElement(
      "p",
      { className: "dshDesktopSettingsStatus", "aria-live": "polite" },
      t("runtime.status", {
        phase: t(`phase.${phase}`),
        count: restarts
      })
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("close.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(Menu, {
          open: closeMenuOpen,
          anchor: React.createElement(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "md",
              className: "dshDesktopSettingsDropdownButton",
              "aria-label": t("close.title"),
              "aria-haspopup": "menu",
              "aria-expanded": closeMenuOpen,
              onClick: () => setCloseMenuOpen(!closeMenuOpen)
            },
            React.createElement(
              "span",
              { className: "dshDesktopSettingsDropdownLabel" },
              closeLabel
            ),
            React.createElement(IconChevronDownOutline14, {
              className: "dshDesktopSettingsDropdownIcon"
            })
          ),
          items: closeItems,
          selectedId: closeBehavior,
          align: "end",
          portal: true,
          compact: true,
          onClose: () => setCloseMenuOpen(false),
          onSelect: (id) => {
            setCloseMenuOpen(false);
            if (id === "minimize" || id === "quit")
              void model.setCloseBehavior(id);
          }
        })
      )
    ),
    model.preferencesSupported && React.createElement(
      "div",
      { className: "dshDesktopSettingsRow" },
      React.createElement(
        "span",
        { className: "dshDesktopSettingsLabel" },
        t("anchored.title")
      ),
      React.createElement(
        "div",
        { className: "dshDesktopSettingsControl" },
        React.createElement(
          Button,
          {
            type: "button",
            variant: model.anchoredStandard ? "primary" : "outline",
            size: "md",
            role: "switch",
            "aria-checked": Boolean(model.anchoredStandard),
            onClick: () => void model.setAnchoredStandard(!model.anchoredStandard)
          },
          t(
            model.anchoredStandard ? "anchored.enabled" : "anchored.disabled"
          )
        )
      )
    ),
    model.preferencesSupported && model.anchoredStandard && React.createElement(
      "p",
      { className: "dshDesktopSettingsNote", "aria-live": "polite" },
      t("anchored.fallback")
    ),
    model.error && React.createElement(
      "p",
      { role: "alert", "aria-live": "polite" },
      model.error
    ),
    React.createElement(
      "div",
      { className: "dshDesktopSettingsActions" },
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.restart()
        },
        t("action.restart")
      ),
      React.createElement(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "md",
          onClick: () => void model.openLogs()
        },
        t("action.logs")
      )
    )
  );
}
function apply(ctx) {
  if (!bridgeOf(window)) return () => {
  };
  if (activeDesktopInstallation) {
    return acquireInstallation(activeDesktopInstallation);
  }
  const disposeLocale = ctx.locale.register(
    DESKTOP_LOCALE_NAMESPACE,
    DESKTOP_LOCALES
  );
  const disposeTransitions = installTransitions(document, window);
  const disposeSlot = ctx.slots.inject(
    "settings.general.item",
    () => ctx.slots.register(
      {
        name: "settings.general.item",
        id: "deepseek-harness-desktop",
        order: 100,
        locale: DESKTOP_LOCALE_NAMESPACE
      },
      DesktopSettingsRow
    )
  );
  const installation = {
    references: 0,
    released: false,
    disposeSlot,
    disposeLocale,
    disposeTransitions
  };
  activeDesktopInstallation = installation;
  return acquireInstallation(installation);
}
function acquireInstallation(installation) {
  installation.references += 1;
  let released = false;
  return () => {
    if (released || installation.released) return;
    released = true;
    installation.references -= 1;
    if (installation.references > 0) return;
    installation.released = true;
    if (typeof installation.disposeSlot === "function")
      installation.disposeSlot();
    if (typeof installation.disposeLocale === "function")
      installation.disposeLocale();
    installation.disposeTransitions();
    if (activeDesktopInstallation === installation)
      activeDesktopInstallation = void 0;
  };
}
exports.inject = ["slots", "locale"];
exports.apply = apply;
exports.DesktopSettingsRow = DesktopSettingsRow;
exports.DESKTOP_LOCALES = DESKTOP_LOCALES;
exports.createDesktopSettingsModel = createDesktopSettingsModel;
exports.installTransitions = installTransitions;
exports.createStreamOutputEffectController = createStreamOutputEffectController2;
exports.installStreamOutputEffects = installStreamOutputEffects2;

    return module.exports;
  },
});
