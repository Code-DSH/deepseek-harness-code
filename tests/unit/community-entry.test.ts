import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();

async function readProjectFile(relativePath: string): Promise<string> {
  return readFile(join(projectRoot, relativePath), "utf8");
}

describe("community entry", () => {
  test("publishes the QQ group in both README variants", async () => {
    const [english, chinese] = await Promise.all([
      readProjectFile("README.md"),
      readProjectFile("README.zh-CN.md"),
    ]);

    for (const readme of [english, chinese]) {
      expect(readme).toContain("1107534919");
      expect(readme).toContain("docs/assets/qq-group-1107534919.jpg");
      expect(readme).toContain("docs/assets/deepseek-harness-code.png");
    }
    expect(english).toContain("QQ community");
    expect(chinese).toContain("QQ 社区");
  });

  test("keeps the QQ entry image available in a clean checkout", async () => {
    const [qqImage, productIcon] = await Promise.all([
      stat(join(projectRoot, "docs/assets/qq-group-1107534919.jpg")),
      stat(join(projectRoot, "docs/assets/deepseek-harness-code.png")),
    ]);

    expect(qqImage.isFile()).toBe(true);
    expect(qqImage.size).toBeGreaterThan(0);
    expect(productIcon.isFile()).toBe(true);
    expect(productIcon.size).toBeGreaterThan(0);
  });
});
