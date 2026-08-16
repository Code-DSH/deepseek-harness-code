import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const requireFromProject = createRequire(join(projectRoot, "package.json"));

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
});
