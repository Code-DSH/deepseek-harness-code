export const RUNNING_STATUS_SELECTOR =
  '[data-chat-flow] > [role="status"][aria-live="polite"]';

export function findRunningStatus(doc) {
  if (!doc?.querySelectorAll) return null;
  const matches = doc.querySelectorAll(RUNNING_STATUS_SELECTOR);
  return matches.item(matches.length - 1);
}

function addedRunningStatus(records) {
  let found = null;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const element = node;
      if (element.matches?.(RUNNING_STATUS_SELECTOR)) found = element;
      const nested = element.querySelectorAll?.(RUNNING_STATUS_SELECTOR);
      if (nested?.length) found = nested.item(nested.length - 1);
    }
  }
  return found;
}

export function installThinkingStatus(doc, win, onAnchor) {
  if (
    !doc?.documentElement ||
    !win ||
    typeof onAnchor !== "function" ||
    typeof win.MutationObserver !== "function"
  ) {
    return () => {};
  }

  let activeAnchor = null;
  let disposed = false;

  const publish = (anchor) => {
    if (anchor === activeAnchor) return;
    activeAnchor = anchor;
    onAnchor(anchor);
  };

  const observer = new win.MutationObserver((records) => {
    if (disposed) return;
    const added = addedRunningStatus(records);
    if (added !== null) {
      publish(findRunningStatus(doc));
      return;
    }
    if (activeAnchor?.isConnected) return;
    publish(findRunningStatus(doc));
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  publish(findRunningStatus(doc));

  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    publish(null);
  };
}
