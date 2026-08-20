import { describe, expect, it, vi } from "vitest";

import {
  createSingleFlightAction,
  registerDesktopLifecycle,
  type BeforeQuitEvent,
} from "../../apps/desktop/src/lifecycle/app-lifecycle.js";

describe("Electron readiness boundary", () => {
  it("runs a concurrent startup sequence only once", async () => {
    let finish: (() => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const run = createSingleFlightAction(action);

    const first = run();
    const second = run();
    expect(action).toHaveBeenCalledTimes(1);

    finish?.();
    await Promise.all([first, second]);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("registers activation only after Electron readiness resolves", async () => {
    let resolveReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    let activate: (() => void) | undefined;
    const launch = vi.fn();

    registerDesktopLifecycle(
      {
        whenReady: () => ready,
        onActivate: (listener) => {
          activate = listener;
        },
        onBeforeQuit: vi.fn(),
      },
      {
        activate: vi.fn(),
        launch,
        shutdown: vi.fn(),
        clearHealthTimer: vi.fn(),
        reportLaunchFailure: vi.fn(),
      },
    );

    expect(activate).toBeUndefined();
    expect(launch).not.toHaveBeenCalled();

    resolveReady?.();
    await Promise.resolve();

    expect(activate).toBeTypeOf("function");
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("does not start shutdown recursively when terminal quit re-enters before-quit", async () => {
    let beforeQuit: ((event: BeforeQuitEvent) => void) | undefined;
    const initialEvent = { preventDefault: vi.fn() };
    const terminalEvent = { preventDefault: vi.fn() };
    const shutdown = vi.fn(() => {
      beforeQuit?.(terminalEvent);
      return Promise.resolve();
    });

    registerDesktopLifecycle(
      {
        whenReady: () => Promise.resolve(),
        onActivate: vi.fn(),
        onBeforeQuit: (listener) => {
          beforeQuit = listener;
        },
      },
      {
        activate: vi.fn(),
        launch: vi.fn(),
        shutdown,
        clearHealthTimer: vi.fn(),
        reportLaunchFailure: vi.fn(),
      },
    );

    beforeQuit?.(initialEvent);

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(initialEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(terminalEvent.preventDefault).not.toHaveBeenCalled();
  });
});
