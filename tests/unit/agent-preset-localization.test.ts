import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const patchName = "@deepseek-ai__dsh-client-ui-agent-preset@0.1.0-rc.8.patch";

async function readProject(path: string): Promise<string> {
  return readFile(join(projectRoot, path), "utf8");
}

describe("custom Agent preset locale patch", () => {
  it("defines exact zh/en copy for every product-owned custom preset", async () => {
    const patch = await readProject(join("patches", patchName));
    for (const text of [
      'presetAnchoredStandardName: "Progressive Standard Mode"',
      'presetAnchoredStandardDescription: "Provides chain-of-thought for DeepSeek V4 Pro and progressively unlocks tools."',
      'presetProductRoutingName: "Deep Routing Mode"',
      'presetRouterSpecName: "Deep Analysis Routing Mode"',
      'presetRouterStandardName: "Standard Routing Mode"',
      'presetAnchoredStandardName: "渐进式标准模式"',
      'presetAnchoredStandardDescription: "专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。"',
      'presetProductRoutingName: "深度路由模式"',
      'presetRouterSpecName: "路由深度思考模式"',
      'presetRouterStandardName: "路由标准模式"',
    ])
      expect(patch).toContain(text);
  });

  it("allowlists four product IDs without translating arbitrary user presets", async () => {
    const patch = await readProject(join("patches", patchName));
    for (const id of [
      "anchored-standard",
      "cordis-with-products",
      "router-spec",
      "router-standard",
    ])
      expect(patch).toContain(`${JSON.stringify(id)}:`);
    expect(patch).toContain("PRODUCT_PRESET_KEYS[preset.id]");
    expect(patch).toContain('preset.trust === "system"');
  });

  it("ships the identical exact-version patch in both workspaces", async () => {
    const [rootPatch, runtimePatch, rootWorkspace, runtimeWorkspace] =
      await Promise.all([
        readProject(join("patches", patchName)),
        readProject(join("config", "node-runtime", "patches", patchName)),
        readProject("pnpm-workspace.yaml"),
        readProject(join("config", "node-runtime", "pnpm-workspace.yaml")),
      ]);
    expect(runtimePatch).toBe(rootPatch);
    expect(rootWorkspace).toContain(patchName);
    expect(runtimeWorkspace).toContain(patchName);
  });

  it("applies the locale patch without removing the user metadata fallback", async () => {
    const virtualStore = join(projectRoot, "node_modules", ".pnpm");
    const packageDirectory = (await readdir(virtualStore)).find((entry) =>
      entry.startsWith(
        "@deepseek-ai+dsh-client-ui-agent-preset@0.1.0-rc.8_patch_hash=",
      ),
    );
    expect(packageDirectory).toBeDefined();
    const client = await readFile(
      join(
        virtualStore,
        packageDirectory!,
        "node_modules",
        "@deepseek-ai",
        "dsh-client-ui-agent-preset",
        "lib",
        "client.js",
      ),
      "utf8",
    );
    expect(client).toContain("PRODUCT_PRESET_KEYS");
    expect(client).toContain(
      "专为 DeepSeek V4 Pro 提供思维链，并逐步开放工具的模式。",
    );
    expect(client).toContain("Deep Routing Mode");
    expect(client).toContain("name: preset.name ?? preset.id");
  });
});
