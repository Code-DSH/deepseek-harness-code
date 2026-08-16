import { describe, expect, it } from "vitest";

import { fetchOkWithTimeout } from "../../apps/desktop/src/lifecycle/http-health.js";

describe("loopback health probe", () => {
  it("attaches a bounded abort signal and treats an abort as unhealthy", async () => {
    const request = async (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });

    await expect(
      fetchOkWithTimeout("http://127.0.0.1:41001", 1, request),
    ).resolves.toBe(false);
  });
});
