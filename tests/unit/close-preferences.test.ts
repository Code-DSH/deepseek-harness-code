import { describe, expect, it, vi } from "vitest";

import { resolveCloseAction } from "../../apps/desktop/src/lifecycle/close-preferences.js";

describe("close preferences", () => {
  it("persists the first native close choice instead of asking on later closes", async () => {
    const save = vi.fn(async () => undefined);
    const choose = vi.fn(async () => "minimize" as const);

    await expect(resolveCloseAction("ask", choose, save)).resolves.toBe(
      "minimize",
    );
    expect(choose).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("minimize");
  });

  it("uses an existing preference without presenting a native choice", async () => {
    const choose = vi.fn(async () => "quit" as const);
    const save = vi.fn(async () => undefined);

    await expect(resolveCloseAction("quit", choose, save)).resolves.toBe(
      "quit",
    );
    expect(choose).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
