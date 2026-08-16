import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("startup loading UI", () => {
  it("shows only a centered monochrome spinner on the system light or dark background", async () => {
    const html = await readFile(
      join(process.cwd(), "apps/desktop/src/startup.html"),
      "utf8",
    );
    expect(html).toContain('class="titlebar"');
    expect(html).toMatch(/\.titlebar\s*\{[^}]*-webkit-app-region:\s*drag/s);
    expect(html).toContain('class="spinner"');
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("background: #fff");
    expect(html).toContain("background: #000");
    expect(html).toMatch(/animation:\s*spin[^;]*infinite/);
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("radial-gradient");
    expect(html).not.toContain("DeepSeek Harness Code</h1>");
    expect(html).toContain("prefers-reduced-motion: reduce");
  });
});
