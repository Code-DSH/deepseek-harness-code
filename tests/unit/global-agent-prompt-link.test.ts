import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  adoptBundledGlobalAgentPrompt,
  installGlobalAgentPromptForStartup,
} from "../../apps/desktop/src/lifecycle/global-agent-prompt-link.js";

async function createResource(root: string, content: string): Promise<string> {
  const resource = join(root, "resource");
  await mkdir(resource, { recursive: true });
  await writeFile(join(resource, "protocol.md"), content);
  return resource;
}

const PROMPT_V1 = "# Global Agent Operating Protocol\n\nv1 content\n";
const PROMPT_V2 = "# Global Agent Operating Protocol\n\nv2 content\n";

describe("bundled global AGENTS.md installation", () => {
  it("installs the bundled prompt when the user has none", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-install-"));
    const resource = await createResource(root, PROMPT_V1);
    const dshHome = join(root, "home");

    const result = await installGlobalAgentPromptForStartup({
      dshHome,
      resourceRoot: resource,
    });

    expect(result).toEqual({ status: "installed" });
    await expect(readFile(join(dshHome, "AGENTS.md"), "utf8")).resolves.toBe(
      PROMPT_V1,
    );
    const marker = JSON.parse(
      await readFile(join(dshHome, ".agents-md.managed.json"), "utf8"),
    ) as { owner: string; schemaVersion: number };
    expect(marker).toMatchObject({
      owner: "deepseek-harness-code",
      schemaVersion: 1,
    });
  });

  it("reports current when the managed copy already matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-current-"));
    const resource = await createResource(root, PROMPT_V1);
    const dshHome = join(root, "home");
    await installGlobalAgentPromptForStartup({
      dshHome,
      resourceRoot: resource,
    });

    const result = await installGlobalAgentPromptForStartup({
      dshHome,
      resourceRoot: resource,
    });

    expect(result).toEqual({ status: "current" });
  });

  it("updates an unmodified managed copy when the release changes it", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-update-"));
    const resource = await createResource(root, PROMPT_V1);
    const dshHome = join(root, "home");
    await installGlobalAgentPromptForStartup({
      dshHome,
      resourceRoot: resource,
    });
    await writeFile(join(resource, "protocol.md"), PROMPT_V2);

    const result = await installGlobalAgentPromptForStartup({
      dshHome,
      resourceRoot: resource,
    });

    expect(result).toEqual({ status: "updated" });
    await expect(readFile(join(dshHome, "AGENTS.md"), "utf8")).resolves.toBe(
      PROMPT_V2,
    );
  });

  it("never touches a user-authored or user-edited file", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-conflict-"));
    const resource = await createResource(root, PROMPT_V1);
    const dshHome = join(root, "home");

    // User-authored file without a managed marker.
    await mkdir(dshHome, { recursive: true });
    await writeFile(join(dshHome, "AGENTS.md"), "user prompt\n");
    await expect(
      installGlobalAgentPromptForStartup({ dshHome, resourceRoot: resource }),
    ).resolves.toEqual({ status: "conflict" });
    await expect(readFile(join(dshHome, "AGENTS.md"), "utf8")).resolves.toBe(
      "user prompt\n",
    );

    // App-managed copy that the user later edited.
    const editedHome = join(root, "home2");
    await installGlobalAgentPromptForStartup({
      dshHome: editedHome,
      resourceRoot: resource,
    });
    await writeFile(join(editedHome, "AGENTS.md"), "edited by user\n");
    await expect(
      installGlobalAgentPromptForStartup({
        dshHome: editedHome,
        resourceRoot: resource,
      }),
    ).resolves.toEqual({ status: "conflict" });
    await expect(readFile(join(editedHome, "AGENTS.md"), "utf8")).resolves.toBe(
      "edited by user\n",
    );
  });

  it("reports unavailable when the bundle is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-missing-"));
    const dshHome = join(root, "home");
    await expect(
      installGlobalAgentPromptForStartup({
        dshHome,
        resourceRoot: join(root, "resource"),
      }),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("backs up and replaces an existing prompt on adopt", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-adopt-"));
    const resource = await createResource(root, PROMPT_V2);
    const dshHome = join(root, "home");
    await mkdir(dshHome, { recursive: true });
    await writeFile(join(dshHome, "AGENTS.md"), "user prompt\n");

    const result = await adoptBundledGlobalAgentPrompt({
      dshHome,
      resourceRoot: resource,
      now: () => new Date("2026-08-17T05:04:05.123Z"),
    });

    expect(result).toMatchObject({
      status: "adopted",
      backupPath: join(dshHome, "AGENTS.md.backup-20260817T050405Z"),
    });
    await expect(readFile(join(dshHome, "AGENTS.md"), "utf8")).resolves.toBe(
      PROMPT_V2,
    );
    await expect(
      readFile(join(dshHome, "AGENTS.md.backup-20260817T050405Z"), "utf8"),
    ).resolves.toBe("user prompt\n");
    const entries = await readdir(dshHome);
    expect(entries).toContain("AGENTS.md");
    expect(entries).toContain("AGENTS.md.backup-20260817T050405Z");
    expect(entries).toContain(".agents-md.managed.json");
  });

  it("adopts without a backup when no prompt exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "dhc-agents-adopt-new-"));
    const resource = await createResource(root, PROMPT_V1);
    const dshHome = join(root, "home");

    const result = await adoptBundledGlobalAgentPrompt({
      dshHome,
      resourceRoot: resource,
    });

    expect(result).toEqual({ status: "adopted", backupPath: undefined });
    await expect(readFile(join(dshHome, "AGENTS.md"), "utf8")).resolves.toBe(
      PROMPT_V1,
    );
  });
});
