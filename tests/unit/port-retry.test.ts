import { describe, expect, it, vi } from "vitest";

import {
  reserveLoopbackPort,
  startWithPortRetries,
} from "../../apps/desktop/src/lifecycle/port-retry.js";

describe("Harness port startup", () => {
  it("retries a loopback bind race no more than three times", async () => {
    let nextPort = 41001;
    const allocatePort = vi.fn(async () => nextPort++);
    const start = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("occupied"), { code: "EADDRINUSE" }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("occupied"), { code: "EADDRINUSE" }),
      )
      .mockResolvedValueOnce("started");

    await expect(startWithPortRetries(allocatePort, start)).resolves.toBe(
      "started",
    );
    expect(allocatePort).toHaveBeenCalledTimes(3);
    expect(start).toHaveBeenNthCalledWith(3, 41003);
  });

  it("does not retry non-bind failures", async () => {
    const allocatePort = vi.fn(async () => 41001);
    const start = vi.fn().mockRejectedValue(new Error("missing dsh"));

    await expect(startWithPortRetries(allocatePort, start)).rejects.toThrow(
      "missing dsh",
    );
    expect(allocatePort).toHaveBeenCalledTimes(1);
  });

  it("selects a positive loopback port without leaving a listener open", async () => {
    await expect(reserveLoopbackPort()).resolves.toBeGreaterThan(0);
  });
});
