import { describe, expect, it, vi } from "vitest";

import { HarnessRuntimeController } from "../../apps/desktop/src/lifecycle/runtime-controller.js";

describe("HarnessRuntimeController", () => {
  it("publishes a bounded non-fatal preset conflict notice when ready", async () => {
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill: vi.fn() })),
      probeHealth: vi.fn(async () => true),
      runtimeNotice: () => "anchored-preset-conflict",
      onState: vi.fn(),
    });

    await controller.start();

    expect(controller.getState()).toEqual({
      phase: "ready",
      restartCount: 0,
      harnessPid: 42,
      notice: "anchored-preset-conflict",
    });
  });

  it("restarts after three consecutive failed health probes", async () => {
    const startHarness = vi.fn(async () => ({ pid: 42, kill: vi.fn() }));
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness,
      probeHealth: vi.fn(async () => false),
      onState: vi.fn(),
    });

    await controller.start();
    await controller.checkHealth();
    await controller.checkHealth();
    await controller.checkHealth();

    expect(startHarness).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      phase: "ready",
      restartCount: 1,
    });
  });

  it("reads the current loopback origin when its port is allocated during startup", async () => {
    const probeHealth = vi.fn(async () => true);
    const controller = new HarnessRuntimeController({
      origin: () => "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill: vi.fn() })),
      probeHealth,
      onState: vi.fn(),
    });

    await controller.start();
    await controller.checkHealth();

    expect(probeHealth).toHaveBeenCalledWith("http://127.0.0.1:41001");
  });

  it("publishes ready only after the local web root and child liveness are confirmed", async () => {
    const onState = vi.fn();
    const child = { pid: 42, kill: vi.fn() };
    const waitForExit = vi.fn(async () => false);
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => child),
      probeHealth: vi.fn(async () => true),
      waitForReady: vi.fn(async () => false),
      waitForExit,
      onState,
    });

    await expect(controller.start()).rejects.toThrow("not ready");

    expect(controller.getState()).toMatchObject({ phase: "failed" });
    expect(onState).not.toHaveBeenCalledWith(
      expect.objectContaining({ phase: "ready" }),
    );
    expect(waitForExit).toHaveBeenCalledWith(child, 8_000);
    expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(child.kill).toHaveBeenNthCalledWith(2, "SIGKILL");
  });

  it("ignores an exit notification from a child retired by a completed restart", async () => {
    const first = { pid: 41, kill: vi.fn() };
    const second = { pid: 42, kill: vi.fn() };
    const startHarness = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness,
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit: vi.fn(async () => true),
    });

    await controller.start();
    await controller.restart();
    await controller.handleChildExit(first);

    expect(startHarness).toHaveBeenCalledTimes(2);
  });

  it("serializes simultaneous restart requests and retires the old child before starting another", async () => {
    const first = { pid: 41, kill: vi.fn() };
    const second = { pid: 42, kill: vi.fn() };
    const startHarness = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const waitForExit = vi.fn(async () => true);
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness,
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit,
    });

    await controller.start();
    await Promise.all([controller.restart(), controller.restart()]);

    expect(first.kill).toHaveBeenCalledWith("SIGTERM");
    expect(waitForExit).toHaveBeenCalledWith(first, 8_000);
    expect(startHarness).toHaveBeenCalledTimes(2);
  });

  it("loads the newly ready origin after manual and health-triggered restarts", async () => {
    const origins = [
      "http://127.0.0.1:41001",
      "http://127.0.0.1:41002",
      "http://127.0.0.1:41003",
    ];
    let startCount = 0;
    const onReady = vi.fn(async () => undefined);
    const controller = new HarnessRuntimeController({
      origin: () => origins[startCount - 1]!,
      startHarness: vi.fn(async () => ({ pid: ++startCount, kill: vi.fn() })),
      probeHealth: vi.fn(async () => false),
      waitForReady: vi.fn(async () => true),
      onState: vi.fn(),
      onReady,
    });

    await controller.start();
    await controller.restart();
    await controller.checkHealth();
    await controller.checkHealth();
    await controller.checkHealth();

    expect(onReady).toHaveBeenNthCalledWith(1, "http://127.0.0.1:41001", {
      pid: 1,
      kill: expect.any(Function),
    });
    expect(onReady).toHaveBeenNthCalledWith(2, "http://127.0.0.1:41002", {
      pid: 2,
      kill: expect.any(Function),
    });
    expect(onReady).toHaveBeenNthCalledWith(3, "http://127.0.0.1:41003", {
      pid: 3,
      kill: expect.any(Function),
    });
  });

  it("converges to failed and retires the child when loading the ready origin fails", async () => {
    const child = { pid: 42, kill: vi.fn() };
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => child),
      probeHealth: vi.fn(async () => true),
      waitForReady: vi.fn(async () => true),
      onReady: vi.fn(async () => {
        throw new Error("load failed");
      }),
      onState: vi.fn(),
      waitForExit: vi.fn(async () => true),
    });

    await expect(controller.start()).rejects.toThrow("load failed");

    expect(controller.getState()).toMatchObject({
      phase: "failed",
      lastError: "load failed",
    });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("does not start a replacement child once shutdown begins during a restart", async () => {
    let releaseExit: (() => void) | undefined;
    const first = { pid: 41, kill: vi.fn() };
    const startHarness = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ pid: 42, kill: vi.fn() });
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness,
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            releaseExit = () => resolve(true);
          }),
      ),
    });

    await controller.start();
    const restart = controller.restart();
    const stop = controller.stop();
    releaseExit!();
    await Promise.all([restart, stop]);

    expect(startHarness).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({ phase: "stopping" });
  });

  it("does not overlap health checks while a bounded probe is still pending", async () => {
    let resolveProbe: (() => void) | undefined;
    const probeHealth = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveProbe = () => resolve(true);
        }),
    );
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill: vi.fn() })),
      probeHealth,
      onState: vi.fn(),
    });

    await controller.start();
    const first = controller.checkHealth();
    const second = controller.checkHealth();
    expect(probeHealth).toHaveBeenCalledTimes(1);
    resolveProbe!();
    await Promise.all([first, second]);
  });

  it("retires a child acquired after stop begins while startup readiness is blocked", async () => {
    let releaseReady: (() => void) | undefined;
    const child = { pid: 99, kill: vi.fn() };
    const waitForExit = vi.fn(async () => true);
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => child),
      waitForReady: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            releaseReady = () => resolve(true);
          }),
      ),
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit,
    });

    const start = controller.start();
    await Promise.resolve();
    const stop = controller.stop();
    releaseReady?.();

    await expect(start).resolves.toBeUndefined();
    await expect(stop).resolves.toMatchObject({ retired: true });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(waitForExit).toHaveBeenCalledWith(child, 8_000);
  });

  it("reports retirement only after SIGKILL exit confirmation", async () => {
    const child = { pid: 100, kill: vi.fn() };
    const waitForExit = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => child),
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit,
    });

    await controller.start();
    await expect(controller.stop()).resolves.toMatchObject({ retired: true });
    expect(waitForExit).toHaveBeenNthCalledWith(2, child, 8_000);
  });

  it("reloads an unresponsive renderer only after 30 seconds without a responsive event", async () => {
    vi.useFakeTimers();
    const startHarness = vi.fn(async () => ({ pid: 42, kill: vi.fn() }));
    const reloadRenderer = vi.fn();
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness,
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      reloadRenderer,
    });

    await controller.start();
    controller.handleRendererUnresponsive();
    await vi.advanceTimersByTimeAsync(29_999);

    expect(reloadRenderer).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(reloadRenderer).toHaveBeenCalledOnce();
    expect(startHarness).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("cancels a pending unresponsive reload when the renderer responds", async () => {
    vi.useFakeTimers();
    const reloadRenderer = vi.fn();
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill: vi.fn() })),
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      reloadRenderer,
    });

    controller.handleRendererUnresponsive();
    controller.handleRendererResponsive();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(reloadRenderer).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("escalates graceful shutdown only after its timeout elapses", async () => {
    const kill = vi.fn();
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill })),
      probeHealth: vi.fn(async () => true),
      onState: vi.fn(),
      waitForExit: vi.fn(async () => false),
    });

    await controller.start();
    await controller.stop();

    expect(kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(kill).toHaveBeenNthCalledWith(2, "SIGKILL");
  });

  it("still retires Harness when a destroyed renderer rejects a state notification", async () => {
    const kill = vi.fn();
    let notifications = 0;
    const controller = new HarnessRuntimeController({
      origin: "http://127.0.0.1:41001",
      startHarness: vi.fn(async () => ({ pid: 42, kill })),
      probeHealth: vi.fn(async () => true),
      onState: () => {
        notifications += 1;
        if (notifications > 2) throw new Error("Object has been destroyed");
      },
      waitForExit: vi.fn(async () => true),
    });

    await controller.start();
    await expect(controller.stop()).resolves.toEqual({ retired: true });
    expect(kill).toHaveBeenCalledWith("SIGTERM");
  });
});
