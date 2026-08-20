import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();

describe("build assets", () => {
  test("generates icons as part of the normal build used by development startup", async () => {
    const packageJson = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts?: { build?: string } };

    expect(packageJson.scripts?.build).toContain("pnpm build:icon");
  });
});
