import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const pluginRoot = join(projectRoot, "packages", "desktop-plugin");
const requireFromPlugin = createRequire(join(pluginRoot, "package.json"));

describe("packaged runtime dependency closure", () => {
  it("ships the workflow seam required by the pinned Standard preset", () => {
    expect(() =>
      requireFromProject.resolve("@deepseek-ai/dsh-workflow/package.json"),
    ).not.toThrow();
  });

  it("pins the workflow seam as a production dependency for packaging", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@deepseek-ai/dsh-workflow"]).toBe(
      "0.1.0-rc.6",
    );
  });

  it("pins the Standard preset and official UI runtime contracts", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };

    expect(manifest.dependencies["@deepseek-ai/dsh-compaction"]).toBe(
      "0.1.0-rc.6",
    );
    expect(manifest.dependencies["@deepseek-ai/dsh-invariants"]).toBe(
      "0.1.0-rc.6",
    );
    expect(manifest.dependencies["@deepseek-ai/dsh-client-ui-primitives"]).toBe(
      "0.1.0-rc.6",
    );
  });

  it("bundles preload validation instead of requiring zod in the sandbox", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts["build:desktop"]).toContain(
      "tsup.desktop.config.ts",
    );
    const config = await readFile(
      join(projectRoot, "tsup.desktop.config.ts"),
      "utf8",
    );
    expect(config).toContain('noExternal: ["zod"]');
  });

  it("bundles conversation effects without unresolved runtime modules", async () => {
    const manifest = JSON.parse(
      await readFile(join(pluginRoot, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
      files: string[];
    };
    const client = await readFile(join(pluginRoot, "client.js"), "utf8");
    const notices = await readFile(
      join(pluginRoot, "THIRD_PARTY_NOTICES.md"),
      "utf8",
    );
    const thinkingOrbsPackage = JSON.parse(
      await readFile(
        requireFromPlugin.resolve("thinking-orbs/package.json"),
        "utf8",
      ),
    ) as { version: string };

    expect(manifest.dependencies["thinking-orbs"]).toBe("0.3.1");
    expect(thinkingOrbsPackage.version).toBe("0.3.1");
    expect(manifest.files).toContain("THIRD_PARTY_NOTICES.md");
    expect(notices).toContain("thinking-orbs 0.3.1");
    expect(notices).toContain("generative-loaders 0.1.1");
    for (const unresolved of [
      'require("thinking-orbs")',
      'require("./stream-output-model.js")',
      'require("./stream-output-controller.js")',
      'require("./thinking-status.js")',
    ]) {
      expect(client).not.toContain(unresolved);
    }
  });
});
