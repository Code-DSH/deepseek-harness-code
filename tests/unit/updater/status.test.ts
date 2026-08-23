import { describe, expect, it, vi } from "vitest";

import { createUpdaterStatusStore } from "../../../apps/desktop/src/lifecycle/updater-status.js";
import type { UpdaterStatus } from "../../../apps/desktop/src/shared/contracts.js";

const available: UpdaterStatus = {
  phase: "available",
  version: "0.1.0-BETA3",
  notes: "LAN status test",
};

describe("updater status store", () => {
  it("replays the current snapshot to a new subscriber", () => {
    const store = createUpdaterStatusStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    expect(listener).toHaveBeenCalledWith({ phase: "idle" });

    store.publish(available);
    expect(listener).toHaveBeenLastCalledWith(available);

    unsubscribe();
    store.publish({ phase: "ready-to-restart", version: available.version });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("returns snapshots that cannot be mutated through the store", () => {
    const store = createUpdaterStatusStore(available);
    const snapshot = store.get();

    snapshot.notes = "mutated outside";

    expect(store.get()).toEqual(available);
  });

  it("supports an idempotent unsubscribe", () => {
    const store = createUpdaterStatusStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    unsubscribe();
    store.publish(available);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
