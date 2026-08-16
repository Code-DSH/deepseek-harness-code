import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = join(process.cwd(), "packages", "anchored-standard-plugin");
const entry = join(packageRoot, "index.js");

describe("anchored Standard official bundle", () => {
  it("fails closed to Standard after a successful tool result instead of mutating a live agent preset", async () => {
    expect(existsSync(entry)).toBe(true);
    if (!existsSync(entry)) return;

    const plugin = await import(pathToFileURL(entry).href);
    const controller = plugin.createAnchoredStandardController({
      enabled: true,
    });

    expect(controller.snapshot()).toEqual({
      enabled: true,
      mode: "standard-fallback",
      observedSuccessfulToolCall: false,
      promotionCount: 0,
    });
    controller.recordToolResult({ ok: false });
    controller.recordToolResult({ ok: true });
    controller.recordToolResult({ ok: true });
    expect(controller.snapshot()).toEqual({
      enabled: true,
      mode: "standard-fallback",
      observedSuccessfulToolCall: true,
      promotionCount: 0,
    });
  });

  it("declares an official bundle but contains no post-tool preset recompose hook", () => {
    const manifestPath = join(packageRoot, "package.json");
    expect(existsSync(manifestPath)).toBe(true);
    if (!existsSync(manifestPath)) return;

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const source = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");
    expect(manifest.dsh.bundle.patch).toBe("./cordis.patch.yml");
    expect(source).not.toContain("recompose(");
    expect(source).not.toContain("tool/call");
  });
});
