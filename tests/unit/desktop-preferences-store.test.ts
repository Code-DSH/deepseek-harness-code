import { describe, expect, it, vi } from "vitest";

import { DesktopPreferencesStore } from "../../apps/desktop/src/lifecycle/desktop-preferences-store.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("DesktopPreferencesStore", () => {
  it("serializes concurrent close and LAN updates without losing either field", async () => {
    const firstWriteEntered = deferred();
    const releaseFirstWrite = deferred();
    const writes: Array<{
      closeBehavior: "ask" | "minimize" | "quit";
      lanAccessEnabled: boolean;
    }> = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const write = vi.fn(async (value) => {
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      writes.push({ ...value });
      if (writes.length === 1) {
        firstWriteEntered.resolve();
        await releaseFirstWrite.promise;
      }
      activeWrites -= 1;
    });
    const store = new DesktopPreferencesStore(
      { closeBehavior: "ask", lanAccessEnabled: false },
      write,
    );

    const closeUpdate = store.update({ closeBehavior: "quit" });
    await firstWriteEntered.promise;
    const lanUpdate = store.update({ lanAccessEnabled: true });
    releaseFirstWrite.resolve();

    await expect(closeUpdate).resolves.toEqual({
      closeBehavior: "quit",
      lanAccessEnabled: false,
    });
    await expect(lanUpdate).resolves.toEqual({
      closeBehavior: "quit",
      lanAccessEnabled: true,
    });
    expect(store.get()).toEqual({
      closeBehavior: "quit",
      lanAccessEnabled: true,
    });
    expect(writes).toEqual([
      { closeBehavior: "quit", lanAccessEnabled: false },
      { closeBehavior: "quit", lanAccessEnabled: true },
    ]);
    expect(maxActiveWrites).toBe(1);
  });
});
