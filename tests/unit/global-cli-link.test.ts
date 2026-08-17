import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ensureGlobalDshCli,
  type NpmRunner,
} from "../../apps/desktop/src/lifecycle/global-cli-link.js";

async function createResource(root: string): Promise<string> {
  const resource = join(root, "resource");
  await mkdir(resource, { recursive: true });
  await writeFile(
    join(resource, "package.json"),
    `${JSON.stringify({
      dependencies: {
        "@deepseek-ai/dsh": "0.1.0-rc.6",
        "dsh-find-plugin": "0.3.6",
      },
    })}\n`,
  );
  return resource;
}

function lsResult(version?: string) {
  const dependencies =
    version === undefined ? {} : { "@deepseek-ai/dsh": { version } };
  return {
    status: 0,
    stdout: `${JSON.stringify({ dependencies })}\n`,
    stderr: "",
  };
}

describe("global dsh CLI provisioning", () => {
  it("installs the pinned version when no global dsh exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-cli-install-"));
    const resource = await createResource(root);
    const runNpm = vi
      .fn<NpmRunner>()
      .mockReturnValueOnce(lsResult())
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" });

    const result = await ensureGlobalDshCli({
      nodeExecutable: "/usr/bin/node",
      runtimeResourcePath: resource,
      runNpm,
    });

    expect(result).toMatchObject({
      status: "installed",
      pinnedVersion: "0.1.0-rc.6",
    });
    expect(runNpm).toHaveBeenCalledTimes(2);
    expect(runNpm.mock.calls[0]?.[0]).toEqual([
      "ls",
      "-g",
      "@deepseek-ai/dsh",
      "--depth=0",
      "--json",
    ]);
    expect(runNpm.mock.calls[1]?.[0]).toEqual([
      "install",
      "-g",
      "@deepseek-ai/dsh@0.1.0-rc.6",
    ]);
  });

  it("does nothing when the pinned version is already global", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-cli-present-"));
    const resource = await createResource(root);
    const runNpm = vi.fn<NpmRunner>().mockReturnValue(lsResult("0.1.0-rc.6"));

    const result = await ensureGlobalDshCli({
      nodeExecutable: "/usr/bin/node",
      runtimeResourcePath: resource,
      runNpm,
    });

    expect(result).toMatchObject({
      status: "present",
      installedVersion: "0.1.0-rc.6",
    });
    expect(runNpm).toHaveBeenCalledTimes(1);
  });

  it("keeps a user-managed global version and only reports the mismatch", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-cli-mismatch-"));
    const resource = await createResource(root);
    const runNpm = vi.fn<NpmRunner>().mockReturnValue(lsResult("0.2.0"));

    const result = await ensureGlobalDshCli({
      nodeExecutable: "/usr/bin/node",
      runtimeResourcePath: resource,
      runNpm,
    });

    expect(result.status).toBe("version-mismatch");
    expect(result.message).toContain("0.2.0");
    expect(runNpm).toHaveBeenCalledTimes(1);
  });

  it("degrades to a manual command when npm itself is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-cli-nonpm-"));
    const resource = await createResource(root);
    const runNpm = vi.fn<NpmRunner>().mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: new Error("spawn npm ENOENT"),
    });

    const result = await ensureGlobalDshCli({
      nodeExecutable: "/usr/bin/node",
      runtimeResourcePath: resource,
      runNpm,
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain(
      "npm install -g @deepseek-ai/dsh@0.1.0-rc.6",
    );
  });

  it("reports a failed install without throwing", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-cli-fail-"));
    const resource = await createResource(root);
    const runNpm = vi
      .fn<NpmRunner>()
      .mockReturnValueOnce(lsResult())
      .mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "network unreachable",
      });

    const result = await ensureGlobalDshCli({
      nodeExecutable: "/usr/bin/node",
      runtimeResourcePath: resource,
      runNpm,
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("network unreachable");
  });
});
