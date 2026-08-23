import type { UpdaterStatus } from "../shared/contracts.js";

export interface UpdaterStatusStore {
  get(): UpdaterStatus;
  publish(status: UpdaterStatus): void;
  subscribe(
    listener: (status: UpdaterStatus) => void,
    options?: { replay?: boolean },
  ): () => void;
}

function snapshot(status: UpdaterStatus): UpdaterStatus {
  return { ...status };
}

export function createUpdaterStatusStore(
  initial: UpdaterStatus = { phase: "idle" },
): UpdaterStatusStore {
  let current = snapshot(initial);
  const listeners = new Set<(status: UpdaterStatus) => void>();

  return {
    get() {
      return snapshot(current);
    },
    publish(status) {
      current = snapshot(status);
      for (const listener of listeners) listener(snapshot(current));
    },
    subscribe(listener, options = {}) {
      listeners.add(listener);
      if (options.replay !== false) listener(snapshot(current));
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
      };
    },
  };
}
