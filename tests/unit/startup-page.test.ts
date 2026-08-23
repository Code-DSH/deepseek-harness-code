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

  it("explains the first-launch dependency install in the startup window", async () => {
    const html = await readFile(
      join(process.cwd(), "apps/desktop/src/dependency-install.html"),
      "utf8",
    );
    expect(html).toContain("首次启动需要安装依赖");
    expect(html).toContain("预计需要 5–10 分钟，具体取决于网络速度。");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="正在安装依赖"');
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).not.toContain("<script");
  });

  it("reuses the main window for first-launch dependency progress", async () => {
    const source = await readFile(
      join(process.cwd(), "apps/desktop/src/main.ts"),
      "utf8",
    );

    expect(source.match(/\bnew BrowserWindow\(/g)).toHaveLength(1);
    expect(source).not.toContain("dependencyInstallWindow");
  });
});
