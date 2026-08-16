export const RUNNING_STATUS_SELECTOR =
  '[data-chat-flow] > [role="status"][aria-live="polite"]';

const ORB_SIZE = 20;

export function findRunningStatus(doc) {
  if (!doc?.querySelectorAll) return null;
  const matches = doc.querySelectorAll(RUNNING_STATUS_SELECTOR);
  return matches.item(matches.length - 1);
}

export function installThinkingStatus(doc, win, onSnapshot) {
  if (
    !doc?.documentElement ||
    !win ||
    typeof onSnapshot !== "function" ||
    typeof win.MutationObserver !== "function" ||
    typeof win.requestAnimationFrame !== "function"
  ) {
    return () => {};
  }

  let activeAnchor = null;
  let frameId;
  let resizeObserver;
  let lastSnapshot = null;
  let disposed = false;
  let viewportListening = false;

  const publish = (snapshot) => {
    if (
      snapshot &&
      lastSnapshot &&
      snapshot.anchor === lastSnapshot.anchor &&
      snapshot.left === lastSnapshot.left &&
      snapshot.top === lastSnapshot.top
    ) {
      return;
    }
    if (snapshot === null && lastSnapshot === null) return;
    lastSnapshot = snapshot;
    onSnapshot(snapshot);
  };

  const cancelFrame = () => {
    if (frameId === undefined) return;
    win.cancelAnimationFrame(frameId);
    frameId = undefined;
  };

  const disconnectResizeObserver = () => {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
  };

  const measure = () => {
    frameId = undefined;
    if (disposed || !activeAnchor) return;
    if (!activeAnchor.isConnected || findRunningStatus(doc) !== activeAnchor) {
      syncAnchor();
      return;
    }
    const rect = activeAnchor.getBoundingClientRect();
    publish({
      anchor: activeAnchor,
      left: rect.left,
      top: rect.top + (rect.height - ORB_SIZE) / 2,
    });
  };

  const scheduleMeasure = () => {
    if (disposed || !activeAnchor || frameId !== undefined) return;
    frameId = win.requestAnimationFrame(measure);
  };

  const attachViewportListeners = () => {
    if (viewportListening) return;
    viewportListening = true;
    win.addEventListener("scroll", scheduleMeasure, true);
    win.addEventListener("resize", scheduleMeasure);
  };

  const detachViewportListeners = () => {
    if (!viewportListening) return;
    viewportListening = false;
    win.removeEventListener("scroll", scheduleMeasure, true);
    win.removeEventListener("resize", scheduleMeasure);
  };

  function syncAnchor() {
    if (disposed) return;
    const nextAnchor = findRunningStatus(doc);
    if (nextAnchor === activeAnchor) {
      scheduleMeasure();
      return;
    }
    cancelFrame();
    disconnectResizeObserver();
    activeAnchor = nextAnchor;
    if (!activeAnchor) {
      detachViewportListeners();
      publish(null);
      return;
    }
    attachViewportListeners();
    if (typeof win.ResizeObserver === "function") {
      resizeObserver = new win.ResizeObserver(scheduleMeasure);
      resizeObserver.observe(activeAnchor);
    }
    scheduleMeasure();
  }

  const observer = new win.MutationObserver(syncAnchor);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  win.addEventListener("popstate", syncAnchor);
  win.addEventListener("hashchange", syncAnchor);
  syncAnchor();

  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    disconnectResizeObserver();
    cancelFrame();
    detachViewportListeners();
    win.removeEventListener("popstate", syncAnchor);
    win.removeEventListener("hashchange", syncAnchor);
    activeAnchor = null;
    publish(null);
  };
}
