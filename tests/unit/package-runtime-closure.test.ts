import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const requireFromProject = createRequire(join(projectRoot, "package.json"));
const pluginRoot = join(projectRoot, "packages", "desktop-plugin");

describe("packaged runtime dependency closure", () => {
  it("pins and resolves the official plugin installation runtime", async () => {
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@deepseek-ai/dsh-home-paths"]).toBe(
      "0.1.0-rc.6",
    );
    expect(manifest.dependencies["dsh-find-plugin"]).toBe("0.3.6");
    expect(manifest.dependencies.pnpm).toBe("11.19.0");

    const pnpmRoot = join(requireFromProject.resolve("pnpm"), "..");
    await expect(
      readFile(join(pnpmRoot, "bin", "pnpm.mjs"), "utf8"),
    ).resolves.toContain("pnpm");
    const findPluginRoot = join(
      requireFromProject.resolve("dsh-find-plugin/package.json"),
      "..",
    );
    await expect(
      readFile(join(findPluginRoot, "cordis.patch.yml"), "utf8"),
    ).resolves.toContain("name: 'dsh-find-plugin'");
  });

  it("keeps integrated plugin patches on official bare package names", async () => {
    const injectorPatch = await readFile(
      join(projectRoot, "build/routing-suite/injector/cordis.patch.yml"),
      "utf8",
    );
    const modeBoostManifest = JSON.parse(
      await readFile(
        join(projectRoot, "build/routing-suite/mode-boost/package.json"),
        "utf8",
      ),
    ) as { dsh?: { bundle?: { patch?: string } } };
    const modeBoostPatch = await readFile(
      join(projectRoot, "build/routing-suite/mode-boost/cordis.patch.yml"),
      "utf8",
    );
    expect(injectorPatch).toContain("name: '@dsh-external/dsh-super-injector'");
    expect(injectorPatch).not.toContain("./node_modules/");
    expect(modeBoostManifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(modeBoostPatch).toContain("name: '@dsh-external/dsh-mode-boost'");
    expect(modeBoostPatch).not.toContain("./node_modules/");
  });

  it("contains no superseded manual Web-profile assembler", async () => {
    const lifecycle = await readFile(
      join(projectRoot, "apps/desktop/src/lifecycle/desktop-plugin-link.ts"),
      "utf8",
    );
    const routing = await readFile(
      join(projectRoot, "apps/desktop/src/lifecycle/routing-suite-link.ts"),
      "utf8",
    );
    for (const source of [lifecycle, routing]) {
      expect(source).not.toContain("ensureDesktopPluginBundle");
      expect(source).not.toContain("ensureDesktopPluginLink");
      expect(source).not.toContain('profiles", "web", "node_modules');
    }
  });

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

  it("bundles only the inline thinking status enhancement", async () => {
    const manifest = JSON.parse(
      await readFile(join(pluginRoot, "package.json"), "utf8"),
    ) as {
      dependencies: Record<string, string>;
    };
    const client = await readFile(join(pluginRoot, "client.js"), "utf8");
    expect(manifest.dependencies["thinking-orbs"]).toBe("0.3.1");
    expect(client).toContain("ThinkingOrb");
    expect(client).toContain("data-dsh-desktop-thinking-inline");
    for (const retiredEffect of [
      "ConversationEffectsOverlay",
      "data-dsh-desktop-thinking-source",
      "data-dsh-desktop-thinking-orb",
      "data-dsh-stream-overlay",
    ]) {
      expect(client).not.toContain(retiredEffect);
    }
    expect(client).not.toContain('require("thinking-orbs")');
    expect(client).not.toContain('require("./thinking-status.js")');
  });
});
