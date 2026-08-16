import { describe, expect, it } from "vitest";

import { replaceWindowKeepingHostAlive } from "../../apps/desktop/src/lifecycle/window-recovery.js";

describe("renderer window recovery", () => {
  it("creates the replacement before destroying the failed window", () => {
    const events: string[] = [];
    const oldWindow = {
      destroy: () => events.push("destroy-old"),
      loadURL: () => undefined,
    };
    const freshWindow = {
      destroy: () => undefined,
      loadURL: (origin: string) => {
        events.push(`load:${origin}`);
      },
    };

    expect(
      replaceWindowKeepingHostAlive(
        oldWindow,
        () => {
          events.push("create-fresh");
          return freshWindow;
        },
        "http://127.0.0.1:41234",
      ),
    ).toBe(freshWindow);
    expect(events).toEqual([
      "create-fresh",
      "destroy-old",
      "load:http://127.0.0.1:41234",
    ]);
  });
});
