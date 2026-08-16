export const RUNNING_STATUS_SELECTOR: string;

export function findRunningStatus(document: Document): HTMLElement | null;
export function installThinkingStatus(
  document: Document,
  window: Window,
  onAnchor: (anchor: HTMLElement | null) => void,
): () => void;
