import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();
const execFileAsync = promisify(execFile);

async function readProjectFile(relativePath: string): Promise<string> {
  return readFile(join(projectRoot, relativePath), "utf8");
}

describe("DeepSeek Harness Code distribution contract", () => {
  test("declares the renamed Universal macOS product with ad-hoc signing", async () => {
    const config = await readProjectFile("electron-builder.yml");

    expect(config).toContain("appId: community.deepseek.harness.code");
    expect(config).toContain("productName: DeepSeek Harness Code");
    expect(config).toContain("electronVersion: 43.4.0");
    expect(config).not.toContain("electronDist:");
    expect(config).toContain("minimumSystemVersion: 12.0.0");
    expect(config).toMatch(/identity:\s*['"]-['"]/);
    expect(config).toContain("hardenedRuntime: false");
    expect(config).toContain("target:");
    expect(config).toContain("dmg");
    expect(config).toContain("build/deepseek-harness-code.icns");
    expect(config).toContain(
      "DeepSeek-Harness-Code-${version}-${os}-${arch}.${ext}",
    );
  });

  test("covers macOS, Windows, and Linux targets with generated product icons", async () => {
    const config = await readProjectFile("electron-builder.yml");
    const iconScript = await readProjectFile("scripts/build-icon.mjs");
    const releaseWorkflow = await readProjectFile(
      ".github/workflows/package.yml",
    );
    const ciWorkflow = await readProjectFile(".github/workflows/ci.yml");

    expect(config).toContain("nsis");
    expect(config).toContain("AppImage");
    expect(config).toContain("deb");
    expect(config).toContain("build/deepseek-harness-code.ico");
    expect(config).toContain("build/deepseek-harness-code.png");
    expect(iconScript).toContain("deepseek-harness-code.svg");
    expect(iconScript).toContain("deepseek-harness-code.icns");
    expect(iconScript).toContain("deepseek-harness-code.ico");
    expect(iconScript).toContain("deepseek-harness-code.png");
    expect(iconScript).toContain("deepseek-harness-code-tray.png");
    expect(config).toContain("build/deepseek-harness-code-tray.png");
    expect(config).toContain("to: deepseek-harness-code-tray.png");
    expect(config).toContain("to: deepseek-harness-code.png");
    expect(iconScript).toContain(">Code<");
    // Release workflow builds Windows installers on native runners.
    expect(releaseWorkflow).toContain("windows");
    // The CI workflow runs structure, compliance, memory, test, and packaging
    // adaptation gates across Linux (ubuntu), Windows, and macOS runners for
    // both pushes and pull requests.
    expect(ciWorkflow).toContain("macos");
    expect(ciWorkflow).toContain("windows");
    expect(ciWorkflow).toContain("ubuntu");
    expect(ciWorkflow).toContain("pull_request");
    expect(ciWorkflow).toContain("check:memory");
  });

  test("generates a self-contained SVG, ICNS, ICO, and PNG product icon", async () => {
    await execFileAsync(process.execPath, ["scripts/build-icon.mjs"], {
      cwd: projectRoot,
    });

    const svg = await readProjectFile("build/deepseek-harness-code.svg");
    const icoHeader = await readFile(
      join(projectRoot, "build/deepseek-harness-code.ico"),
    );
    const pngHeader = await readFile(
      join(projectRoot, "build/deepseek-harness-code.png"),
    );
    const icnsHeader = await readFile(
      join(projectRoot, "build/deepseek-harness-code.icns"),
    );
    const trayHeader = await readFile(
      join(projectRoot, "build/deepseek-harness-code-tray.png"),
    );

    expect(svg).toContain("Official DeepSeek Harness black graphic");
    expect(svg).toContain('fill="#F4F6FA"');
    expect(svg).toContain('transform="translate(58 42) scale(2.8)"');
    expect(svg).toContain('<text x="128" y="218"');
    expect(svg).toContain(">Code<");
    expect(icnsHeader.subarray(0, 4).toString("ascii")).toBe("icns");
    expect(icoHeader.subarray(0, 4).toString("hex")).toBe("00000100");
    expect(pngHeader.subarray(1, 4).toString("hex")).toBe("504e47");
    expect(trayHeader.subarray(1, 4).toString("hex")).toBe("504e47");
  });

  test("includes every local runtime component and a safe renamed installer handoff", async () => {
    const manifest = JSON.parse(await readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const config = await readProjectFile("electron-builder.yml");
    const installerReadme = await readProjectFile(
      "build/INSTALL-UNSIGNED-macOS.txt",
    );
    const notices = await readProjectFile("build/THIRD-PARTY-NOTICES.md");
    const verifyScript = await readProjectFile(
      "scripts/verify-macos-artifact.mjs",
    );
    const preflightScript = await readProjectFile(
      "scripts/check-runtime-closure.mjs",
    );
    const anchoredManifest = JSON.parse(
      await readProjectFile("packages/anchored-standard-plugin/UPSTREAM.json"),
    ) as { commit: string };

    for (const resource of [
      "dist/desktop",
      "dist/watchdog",
      "packages/desktop-plugin",
      "THIRD_PARTY_NOTICES.md",
      "packages/anchored-standard-plugin",
      "apps/desktop/src/startup.html",
      "build/THIRD-PARTY-NOTICES.md",
    ]) {
      expect(config).toContain(resource);
    }
    expect(config).toContain("asar: false");
    expect(config).toContain(
      "x64ArchFiles: Contents/Resources/app/node_modules/**/*",
    );
    expect(installerReadme).toContain(
      'xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness Code.app"',
    );
    expect(installerReadme).not.toContain("spctl --master-disable");
    expect(installerReadme).toContain("community wrapper");
    expect(notices).toContain("DeepSeek Harness Code");
    expect(notices).toContain("thinking-orbs@0.3.1");
    expect(verifyScript).toContain("codesign --verify --deep --strict");
    expect(verifyScript).toContain("lipo -archs");
    expect(verifyScript).toContain("hdiutil attach");
    expect(verifyScript).toContain("xattr");
    expect(verifyScript).toContain("@deepseek-ai/dsh-compaction/package.json");
    expect(verifyScript).toContain("@deepseek-ai/dsh-invariants/package.json");
    expect(verifyScript).toContain(
      "anchored-standard-plugin/preset/agent.cordis.yml",
    );
    expect(verifyScript).toContain(
      "anchored-standard-plugin/UPSTREAM-SHA256SUMS",
    );
    expect(manifest.scripts["preflight:runtime"]).toContain(
      "check-runtime-closure.mjs",
    );
    for (const script of ["pack:dir", "dist:mac", "dist:win", "dist:linux"])
      expect(manifest.scripts[script]).toContain("preflight:runtime");
    expect(preflightScript).toContain("@deepseek-ai/dsh-compaction");
    expect(preflightScript).toContain("@deepseek-ai/dsh-invariants");
    expect(preflightScript).toContain("@deepseek-ai/dsh-client-ui-primitives");
    expect(preflightScript).toContain("packages/desktop-plugin/client.js");
    expect(config).toContain("preset/**/*");
    expect(config).toContain("UPSTREAM.json");
    expect(config).toContain("UPSTREAM-SHA256SUMS");
    expect(config).toContain("LOCAL-PATCHES.md");
    expect(preflightScript).toContain(
      "packages/anchored-standard-plugin/preset/agent.cordis.yml",
    );
    expect(notices).toContain("dsh-anchored-standard");
    expect(preflightScript).toContain(
      "packages/anchored-standard-plugin/UPSTREAM-SHA256SUMS",
    );
    expect(anchoredManifest.commit).toBe(
      "db4527a2a70a9032d3a8525ce3c0ea6ef528d6fc",
    );
    expect(preflightScript).toContain("thinking-orbs");
    expect(preflightScript).toContain("thinking-status.js");
    expect(preflightScript).toContain('["pnpm", "11.19.0"]');
    expect(preflightScript).toContain('["dsh-find-plugin", "0.3.6"]');
    expect(preflightScript).toContain("bin/pnpm.mjs");
    expect(preflightScript).toContain("name: 'dsh-find-plugin'");
    expect(preflightScript).toContain(
      "name: '@dsh-external/dsh-super-injector'",
    );
    expect(preflightScript).toContain("name: '@dsh-external/dsh-mode-boost'");
    expect(verifyScript).toContain("dsh-find-plugin/package.json");
    expect(verifyScript).toContain("pnpm/bin/pnpm.mjs");
  });
});
