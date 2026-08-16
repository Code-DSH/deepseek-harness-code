export const RUNNING_STATUS_SELECTOR: string;

export type ThinkingStatusSnapshot = {
  anchor: HTMLElement;
  left: number;
  top: number;
};

export function findRunningStatus(document: Document): HTMLElement | null;
export function installThinkingStatus(
  document: Document,
  window: Window,
  onSnapshot: (snapshot: ThinkingStatusSnapshot | null) => void,
): () => void;
