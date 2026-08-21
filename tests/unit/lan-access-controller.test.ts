import { describe, expect, it, vi } from "vitest";

import {
  LanAccessController,
  resolveLanIpv4Addresses,
} from "../../apps/desktop/src/lifecycle/lan-access-controller.js";

function createHarness() {
  const steps: string[] = [];
  let persistedEnabled = false;
  let nextUrl = "http://0.0.0.0:43210/?lanToken=first-secret";
  const proxy = {
    start: vi.fn(async (origin: string) => {
      steps.push(`start:${origin}`);
      return { port: 43210, accessUrl: nextUrl };
    }),
    stop: vi.fn(async () => {
      steps.push("stop");
    }),
  };
  const persistEnabled = vi.fn(async (enabled: boolean) => {
    steps.push(`persist:${enabled}`);
    persistedEnabled = enabled;
  });
  const writeClipboard = vi.fn((value: string) => {
    steps.push(`copy:${value}`);
  });
  const controller = new LanAccessController({
    proxy,
    persistEnabled,
    resolveAddresses: () => ["192.168.1.12", "10.0.0.4"],
    writeClipboard,
  });
  return {
    controller,
    proxy,
    persistEnabled,
    writeClipboard,
    steps,
    getPersistedEnabled: () => persistedEnabled,
    setNextUrl(value: string) {
      nextUrl = value;
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("LAN access controller", () => {
  it("resolves only real non-loopback IPv4 interface addresses", () => {
    expect(
      resolveLanIpv4Addresses({
        lo0: [
          {
            address: "127.0.0.1",
            netmask: "255.0.0.0",
            family: "IPv4",
            mac: "00:00:00:00:00:00",
            internal: true,
            cidr: "127.0.0.1/8",
          },
        ],
        en0: [
          {
            address: "192.168.1.12",
            netmask: "255.255.255.0",
            family: "IPv4",
            mac: "00:00:00:00:00:01",
            internal: false,
            cidr: "192.168.1.12/24",
          },
          {
            address: "fe80::1",
            netmask: "ffff:ffff:ffff:ffff::",
            family: "IPv6",
            mac: "00:00:00:00:00:01",
            internal: false,
            cidr: "fe80::1/64",
            scopeid: 4,
          },
        ],
      }),
    ).toEqual(["192.168.1.12"]);
  });

  it("starts before persisting enablement and exposes only redacted state", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");

    await expect(harness.controller.set({ enabled: true })).resolves.toEqual({
      enabled: true,
      port: 43210,
      addresses: ["10.0.0.4", "192.168.1.12"],
    });
    expect(harness.steps).toEqual([
      "start:http://127.0.0.1:41001",
      "persist:true",
    ]);
    expect(JSON.stringify(harness.controller.get())).not.toContain(
      "first-secret",
    );
  });

  it("keeps LAN disabled and unpersisted when starting fails", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    harness.proxy.start.mockRejectedValueOnce(new Error("bind failed"));

    await expect(harness.controller.set({ enabled: true })).rejects.toThrow(
      "bind failed",
    );
    expect(harness.controller.get()).toEqual({
      enabled: false,
      addresses: [],
    });
    expect(harness.persistEnabled).not.toHaveBeenCalled();
  });

  it("stops before persisting disablement", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    await harness.controller.set({ enabled: true });
    harness.steps.length = 0;

    await expect(harness.controller.set({ enabled: false })).resolves.toEqual({
      enabled: false,
      addresses: [],
    });
    expect(harness.steps).toEqual(["stop", "persist:false"]);
  });

  it("serializes a disable requested while enablement is starting", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    const startEntered = deferred<void>();
    const releaseStart = deferred<{ port: number; accessUrl: string }>();
    harness.proxy.start.mockImplementationOnce(async (origin: string) => {
      harness.steps.push(`start:${origin}`);
      startEntered.resolve();
      return releaseStart.promise;
    });

    const enable = harness.controller.set({ enabled: true });
    await startEntered.promise;
    const disable = harness.controller.set({ enabled: false });
    releaseStart.resolve({
      port: 43210,
      accessUrl: "http://0.0.0.0:43210/?lanToken=interleaved-secret",
    });

    await expect(enable).resolves.toEqual({ enabled: false, addresses: [] });
    await expect(disable).resolves.toEqual({ enabled: false, addresses: [] });
    expect(harness.controller.get()).toEqual({
      enabled: false,
      addresses: [],
    });
    expect(harness.getPersistedEnabled()).toBe(false);
    expect(harness.proxy.stop).toHaveBeenCalledOnce();
  });

  it("does not restart on a new origin after disable wins recovery", async () => {
    const harness = createHarness();
    harness.controller.loadPersistedEnabled(true);
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    const stopEntered = deferred<void>();
    const releaseStop = deferred<void>();
    harness.proxy.stop.mockImplementationOnce(async () => {
      harness.steps.push("stop");
      stopEntered.resolve();
      await releaseStop.promise;
    });

    const recovery = harness.controller.onHarnessReady(
      "http://127.0.0.1:41002",
    );
    await stopEntered.promise;
    const disable = harness.controller.set({ enabled: false });
    releaseStop.resolve();

    await recovery;
    await expect(disable).resolves.toEqual({ enabled: false, addresses: [] });
    expect(harness.proxy.start).toHaveBeenCalledTimes(1);
    expect(harness.proxy.start).toHaveBeenCalledWith("http://127.0.0.1:41001");
    expect(harness.getPersistedEnabled()).toBe(false);
  });

  it("starts persisted enablement after readiness and retargets on recovery", async () => {
    const harness = createHarness();
    harness.controller.loadPersistedEnabled(true);

    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    harness.setNextUrl("http://0.0.0.0:43211/?lanToken=second-secret");
    await harness.controller.onHarnessReady("http://127.0.0.1:41002");

    expect(harness.steps).toEqual([
      "start:http://127.0.0.1:41001",
      "stop",
      "start:http://127.0.0.1:41002",
    ]);
    expect(harness.persistEnabled).not.toHaveBeenCalled();
    harness.controller.copyUrl();
    expect(harness.writeClipboard).toHaveBeenCalledWith(
      "http://10.0.0.4:43211/?lanToken=second-secret",
    );
  });

  it("keeps an enabled listener with no invented route when no address exists", async () => {
    const harness = createHarness();
    const controller = new LanAccessController({
      proxy: harness.proxy,
      persistEnabled: harness.persistEnabled,
      resolveAddresses: () => [],
      writeClipboard: harness.writeClipboard,
    });
    await controller.onHarnessReady("http://127.0.0.1:41001");

    await expect(controller.set({ enabled: true })).resolves.toEqual({
      enabled: true,
      port: 43210,
      addresses: [],
    });
    expect(() => controller.copyUrl()).toThrow("unavailable");
    expect(harness.writeClipboard).not.toHaveBeenCalled();
  });

  it("rejects copy while disabled", () => {
    const harness = createHarness();

    expect(() => harness.controller.copyUrl()).toThrow("disabled");
    expect(harness.writeClipboard).not.toHaveBeenCalled();
  });
});
