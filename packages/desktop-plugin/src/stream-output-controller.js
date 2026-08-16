import {
  STREAMING_ASSISTANT_SELECTOR,
  eligibleTextNodes,
  findAppendedGraphemes,
  isEligibleStreamTextNode,
} from "./stream-output-model.js";

const HIGHLIGHT_NAME = "dsh-desktop-stream-mask";
const DISSOLVE_DURATION_MS = 460;
const MAX_STAGGER_MS = 200;
const CLEANUP_DEADLINE_MS = 700;

function mediaQueryOf(win) {
  return typeof win.matchMedia === "function"
    ? win.matchMedia("(prefers-reduced-motion: reduce)")
    : undefined;
}

function textNodesIn(node) {
  if (node?.nodeType === 3) return [node];
  if (node?.nodeType === 1) return eligibleTextNodes(node);
  return [];
}

export function createStreamOutputEffectController({
  document: doc,
  window: win,
}) {
  let observer;
  let overlay;
  let highlight;
  let frameId;
  let started = false;
  let disposed = false;
  let snapshots = new WeakMap();
  let pending = [];
  const activeEffects = new Set();
  const effectsBySource = new Map();
  const reducedMotion = mediaQueryOf(win);

  const animationAllowed = () =>
    !reducedMotion?.matches &&
    typeof win.Highlight === "function" &&
    Boolean(win.CSS?.highlights);

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
    for (const effect of [...(effectsBySource.get(source) ?? [])])
      removeEffect(effect);
  };

  const cancelAll = () => {
    pending = [];
    if (frameId !== undefined) {
      win.cancelAnimationFrame(frameId);
      frameId = undefined;
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
      "color",
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
      timer: 0,
    };
    effect.timer = win.setTimeout(
      () => removeEffect(effect),
      Math.min(CLEANUP_DEADLINE_MS, DISSOLVE_DURATION_MS + delay),
    );
    activeEffects.add(effect);
    const sourceEffects = effectsBySource.get(entry.source) ?? new Set();
    sourceEffects.add(effect);
    effectsBySource.set(entry.source, sourceEffects);
  };

  const flushPending = () => {
    frameId = undefined;
    if (!ensurePaintResources()) {
      pending = [];
      return;
    }
    const batch = pending;
    pending = [];
    for (const entry of batch) {
      if (
        !entry.source.isConnected ||
        !isEligibleStreamTextNode(entry.source) ||
        entry.source.data.slice(entry.start, entry.end) !== entry.text
      ) {
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
    if (frameId === undefined)
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
      STREAMING_ASSISTANT_SELECTOR,
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
        snapshots = new WeakMap();
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
    snapshots = new WeakMap();
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
      attributeFilter: ["data-streaming"],
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
    highlight = undefined;
    overlay?.remove();
    overlay = undefined;
    win.removeEventListener("scroll", onViewportChange, true);
    win.removeEventListener("resize", onViewportChange);
    win.removeEventListener("popstate", onViewportChange);
    win.removeEventListener("hashchange", onViewportChange);
    reducedMotion?.removeEventListener("change", onReducedMotionChange);
  };

  return { start, dispose };
}

export function installStreamOutputEffects(doc = document, win = window) {
  const controller = createStreamOutputEffectController({
    document: doc,
    window: win,
  });
  controller.start();
  return () => controller.dispose();
}
