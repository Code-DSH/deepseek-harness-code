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
      return { port: 43210 };
    }),
    stop: vi.fn(async () => {
      steps.push("stop");
    }),
    issueAccessUrl: vi.fn(() => nextUrl),
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

  it("clears active state when stop fails during disable", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    await harness.controller.set({ enabled: true });
    harness.proxy.stop.mockRejectedValueOnce(new Error("stop failed"));

    await expect(harness.controller.set({ enabled: false })).rejects.toThrow(
      "stop failed",
    );
    expect(harness.controller.get()).toEqual({ enabled: false, addresses: [] });
  });

  it("serializes a disable requested while enablement is starting", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    const startEntered = deferred<void>();
    const releaseStart = deferred<{ port: number }>();
    harness.proxy.start.mockImplementationOnce(async (origin: string) => {
      harness.steps.push(`start:${origin}`);
      startEntered.resolve();
      return releaseStart.promise;
    });

    const enable = harness.controller.set({ enabled: true });
    await startEntered.promise;
    const disable = harness.controller.set({ enabled: false });
    releaseStart.resolve({ port: 43210 });

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
    harness.controller.copyUrl({ address: "192.168.1.12" });
    expect(harness.writeClipboard).toHaveBeenCalledWith(
      "http://192.168.1.12:43211/?lanToken=second-secret",
    );
  });

  it("clears active state when stop fails during origin replacement", async () => {
    const harness = createHarness();
    harness.controller.loadPersistedEnabled(true);
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    harness.proxy.stop.mockRejectedValueOnce(new Error("stop failed"));

    await expect(
      harness.controller.onHarnessReady("http://127.0.0.1:41002"),
    ).rejects.toThrow("stop failed");
    expect(harness.controller.get()).toEqual({ enabled: false, addresses: [] });
  });

  it("stops and clears a started listener when no address exists", async () => {
    const harness = createHarness();
    const controller = new LanAccessController({
      proxy: harness.proxy,
      persistEnabled: harness.persistEnabled,
      resolveAddresses: () => [],
      writeClipboard: harness.writeClipboard,
    });
    await controller.onHarnessReady("http://127.0.0.1:41001");

    await expect(controller.set({ enabled: true })).rejects.toThrow(
      "No LAN IPv4 address is available",
    );
    expect(controller.get()).toEqual({
      enabled: false,
      addresses: [],
    });
    expect(harness.proxy.stop).toHaveBeenCalledOnce();
    expect(harness.persistEnabled).not.toHaveBeenCalled();
    expect(harness.writeClipboard).not.toHaveBeenCalled();
  });

  it("copies only an address from the current active allowlist", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    await harness.controller.set({ enabled: true });

    harness.controller.copyUrl({ address: "192.168.1.12" });
    expect(harness.writeClipboard).toHaveBeenLastCalledWith(
      "http://192.168.1.12:43210/?lanToken=first-secret",
    );
    expect(() =>
      harness.controller.copyUrl({ address: "172.16.0.99" }),
    ).toThrow("not active");
    expect(() =>
      harness.controller.copyUrl({ address: "attacker.example" }),
    ).toThrow("not active");
    expect(harness.writeClipboard).toHaveBeenCalledTimes(1);
  });

  it("issues a fresh private exchange URL for every copy", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    await harness.controller.set({ enabled: true });
    const issuesBeforeCopy = harness.proxy.issueAccessUrl.mock.calls.length;

    harness.setNextUrl("http://0.0.0.0:43210/?lanToken=copy-one");
    harness.controller.copyUrl({ address: "192.168.1.12" });
    harness.setNextUrl("http://0.0.0.0:43210/?lanToken=copy-two");
    harness.controller.copyUrl({ address: "192.168.1.12" });

    expect(harness.writeClipboard.mock.calls).toEqual([
      ["http://192.168.1.12:43210/?lanToken=copy-one"],
      ["http://192.168.1.12:43210/?lanToken=copy-two"],
    ]);
    expect(harness.proxy.issueAccessUrl).toHaveBeenCalledTimes(
      issuesBeforeCopy + 2,
    );
  });

  it("stops and clears the listener when address resolution fails after start", async () => {
    const harness = createHarness();
    const controller = new LanAccessController({
      proxy: harness.proxy,
      persistEnabled: harness.persistEnabled,
      resolveAddresses: () => {
        throw new Error("address resolution failed");
      },
      writeClipboard: harness.writeClipboard,
    });
    await controller.onHarnessReady("http://127.0.0.1:41001");

    await expect(controller.set({ enabled: true })).rejects.toThrow(
      "address resolution failed",
    );
    expect(harness.proxy.stop).toHaveBeenCalledOnce();
    expect(controller.get()).toEqual({ enabled: false, addresses: [] });
    expect(harness.persistEnabled).not.toHaveBeenCalled();
  });

  it("stops and clears the listener when its private URL is malformed", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    harness.setNextUrl("not a URL");

    await expect(harness.controller.set({ enabled: true })).rejects.toThrow();
    expect(harness.proxy.stop).toHaveBeenCalledOnce();
    expect(harness.controller.get()).toEqual({
      enabled: false,
      addresses: [],
    });
    expect(harness.persistEnabled).not.toHaveBeenCalled();
  });

  it("clears active state when persistence and rollback stop both fail", async () => {
    const harness = createHarness();
    await harness.controller.onHarnessReady("http://127.0.0.1:41001");
    harness.persistEnabled.mockRejectedValueOnce(new Error("persist failed"));
    harness.proxy.stop.mockRejectedValueOnce(new Error("rollback stop failed"));

    await expect(harness.controller.set({ enabled: true })).rejects.toThrow();
    expect(harness.controller.get()).toEqual({ enabled: false, addresses: [] });
  });

  it("rejects copy while disabled", () => {
    const harness = createHarness();

    expect(() => harness.controller.copyUrl()).toThrow("disabled");
    expect(harness.writeClipboard).not.toHaveBeenCalled();
  });
});
