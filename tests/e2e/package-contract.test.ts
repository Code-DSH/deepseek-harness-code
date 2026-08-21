import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { format } from "prettier";
import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();

// Windows CI cold-starts sharp's native rasterizer; the 5 s vitest default
// is too tight for the icon regeneration step.
const ICON_BUILD_TIMEOUT_MS = 60_000;

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
    expect(config).toContain("differentialPackage: false");
    expect(config).toContain("useZip: true");
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

  test("caches Playwright browsers without repeating icon generation", async () => {
    const ciWorkflow = await readProjectFile(".github/workflows/ci.yml");

    expect(ciWorkflow).toContain("PLAYWRIGHT_BROWSERS_PATH");
    expect(ciWorkflow).toContain("uses: actions/cache@v4");
    expect(ciWorkflow).toContain("playwright-${{ runner.os }}-");
    expect(ciWorkflow.match(/run: pnpm build:icon/g)).toHaveLength(1);
  });

  test(
    "generates a self-contained SVG, ICNS, ICO, and PNG product icon",
    async () => {
      const outputRoot = await mkdtemp(
        join(tmpdir(), "deepseek-harness-test-icon-"),
      );
      try {
        execFileSync(process.execPath, ["scripts/build-icon.mjs"], {
          cwd: projectRoot,
          env: { ...process.env, DSH_ICON_OUTPUT_DIR: outputRoot },
          stdio: "pipe",
        });

        const svg = await readFile(
          join(outputRoot, "deepseek-harness-code.svg"),
          "utf8",
        );
        const icoHeader = await readFile(
          join(outputRoot, "deepseek-harness-code.ico"),
        );
        const pngHeader = await readFile(
          join(outputRoot, "deepseek-harness-code.png"),
        );
        const icnsHeader = await readFile(
          join(outputRoot, "deepseek-harness-code.icns"),
        );
        const trayHeader = await readFile(
          join(outputRoot, "deepseek-harness-code-tray.png"),
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
      } finally {
        await rm(outputRoot, { recursive: true, force: true });
      }
    },
    ICON_BUILD_TIMEOUT_MS,
  );

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
      "THIRD-PARTY-NOTICES.md",
      "packages/anchored-standard-plugin",
      "apps/desktop/src/startup.html",
      "build/THIRD-PARTY-NOTICES.md",
      "build/node-runtime",
      "config/global-agent-prompt",
      "packages/prompt-principles-plugin",
    ]) {
      expect(config).toContain(resource);
    }
    expect(config).toContain("asar: false");
    expect(config).toContain('"!node_modules/**/*"');
    expect(config).not.toContain("x64ArchFiles");
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
    expect(verifyScript).toContain("node-runtime/package.json");
    expect(verifyScript).toContain("node-runtime/pnpm-lock.yaml");
    expect(verifyScript).toContain("node-runtime/pnpm.mjs");
    expect(verifyScript).toContain("global-agent-prompt/protocol.md");
    expect(verifyScript).toContain(
      "node-runtime/vendor/dsh-vision-router-1.7.1.tgz",
    );
    expect(verifyScript).toContain(
      "node-runtime/vendor/dsh-better-sidebar-0.12.3.tgz",
    );
    expect(verifyScript).toContain(
      "node-runtime/vendor/deepseek-harness-composition-1.0.0.tgz",
    );
    expect(verifyScript).toContain(
      "packaged application still contains node_modules",
    );
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
    expect(preflightScript).toContain("build/node-runtime");
    expect(preflightScript).toContain("pnpmStandaloneRoot");
    expect(preflightScript).toContain("pnpm.mjs");
    expect(preflightScript).toContain("worker.js");
    expect(preflightScript).toContain("name: 'dsh-find-plugin'");
    expect(preflightScript).toContain(
      "name: '@dsh-external/dsh-super-injector'",
    );
    expect(preflightScript).toContain("name: '@dsh-external/dsh-mode-boost'");
    expect(verifyScript).toContain("node-runtime/package.json");
    expect(verifyScript).toContain("node-runtime/pnpm.mjs");
  });

  test("declares native packaging and durable sanitized smoke evidence", async () => {
    const manifest = JSON.parse(await readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const smokeScript = await readProjectFile(
      "scripts/smoke-packaged-runtime.mjs",
    );

    expect(manifest.scripts["smoke:package"]).toContain(
      "smoke-packaged-runtime.mjs",
    );
    expect(workflow).toContain("windows-x64");
    expect(workflow).toContain("windows-arm64");
    expect(workflow).toContain("macos-universal");
    expect(workflow).toContain("linux-x64");
    expect(workflow).toContain("linux-arm64");
    expect(workflow).toContain("package-kind: nsis");
    expect(workflow).toContain("expected-architecture: x64");
    expect(workflow).toContain("windows-${EXPECTED_ARCHITECTURE}-setup.exe");
    expect(workflow).toContain("mac-universal.dmg");
    expect(workflow).toContain(
      'node scripts/verify-macos-artifact.mjs "$ARTIFACT" --universal',
    );
    expect(workflow).toContain("linux-x86_64.AppImage");
    expect(workflow).toContain("linux-amd64.deb");
    const artifactValidationStep = workflow.slice(
      workflow.indexOf("      - name: Validate exact package artifacts"),
      workflow.indexOf("      - name: Smoke test Windows package"),
    );
    expect(artifactValidationStep).not.toContain("mapfile -t");
    expect(workflow).toContain("Validate tag version");
    expect(workflow).toContain('if [[ "$GITHUB_REF" == refs/tags/* ]]');
    expect(workflow).toContain("SMOKE_TIMEOUT_MS: 600000");
    for (const [label, runner] of [
      ["windows-x64", "windows-2025"],
      ["windows-arm64", "windows-11-arm"],
      ["linux-x64", "ubuntu-24.04"],
      ["linux-arm64", "ubuntu-24.04-arm"],
      ["macos-universal", "macos-15"],
    ]) {
      const matrixEntry = workflow.slice(
        workflow.indexOf(`          - label: ${label}`),
        workflow.indexOf(
          "            command:",
          workflow.indexOf(`          - label: ${label}`),
        ),
      );
      expect(matrixEntry).toContain(`os: ${runner}`);
    }
    expect(smokeScript).toContain("runtime.readyDurationMs");
    expect(workflow).toContain(
      'executable="$squashfs_root/deepseek-harness-code"',
    );
    expect(workflow).toContain("xvfb-run -a pnpm smoke:package");
    expect(workflow).toContain("artifact-sha256");
    expect(workflow).not.toContain(".omo");
    expect(workflow).toContain("release/evidence/${{ matrix.label }}");
    expect(workflow).toContain("${{ matrix.package-kind }}");
    expect(workflow).toContain("${{ matrix.expected-architecture }}");
    expect(workflow).toContain("--artifact-filename");
    expect(workflow).toContain("--runner-architecture");
    expect(workflow).toContain("--evidence-root");
    expect(workflow).toContain("--evidence");
    expect(workflow).toContain("pnpm smoke:package");
    expect(workflow).toContain("smoke-evidence");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("Start-Process -PassThru");
    expect(workflow).toContain("installer.ExitCode -eq 0");
    expect(workflow).toContain(
      "installed application uninstaller exited nonzero",
    );
    expect(workflow).toContain("finally");
    expect(workflow).toContain("set -euo pipefail");
    expect(workflow).toContain("dpkg-deb -f");
    expect(workflow).toContain("dpkg-query");
    expect(workflow).toContain("trap cleanup EXIT");
    expect(workflow).toContain("find release -maxdepth 1 -type f");
    expect(workflow).toContain("wc -l");
    expect(workflow).toContain(
      'printf \'ARTIFACT=%s\\n\' "${matches[0]}" >> "$GITHUB_ENV"',
    );
    expect(workflow).toContain(
      'printf \'ARTIFACT_FILENAME=%s\\n\' "$(basename "${matches[0]}")" >> "$GITHUB_ENV"',
    );
    expect(workflow).not.toContain('if [[ "$pattern" == *.AppImage ]]');
    expect(workflow).toContain("Get-Item $env:ARTIFACT");
    expect(workflow).toContain("--artifact-filename $env:ARTIFACT_FILENAME");
    expect(workflow).toContain(
      "release/evidence/${{ matrix.label }}/**/*.json",
    );
    expect(smokeScript).toContain("127.0.0.1");
    expect(smokeScript).toContain("desktop-plugin");
    expect(smokeScript).toContain("anchored-standard-plugin");
    expect(smokeScript).toContain("architecture");
    expect(smokeScript).toContain("verifySmokeEvidence");
    expect(smokeScript).toContain("SMOKE_EVIDENCE_PATH");
    expect(smokeScript).toContain("SMOKE_RUN_ID");
    expect(smokeScript).toContain("randomUUID");
    expect(smokeScript).toContain("parseWindowsPeMachine");
    expect(smokeScript).toContain('child.stdout?.on("data"');
    expect(smokeScript).toContain('child.stderr?.on("data"');
    expect(smokeScript).toContain("redactPackagedDiagnostic");
  });

  test("launches every package on its native runner before release", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const windowsStep = workflow.slice(
      workflow.indexOf("      - name: Smoke test Windows package"),
      workflow.indexOf("      - name: Verify macOS Universal DMG"),
    );
    const appImageStep = workflow.slice(
      workflow.indexOf(
        "      - name: Extract and smoke test Linux AppImage package",
      ),
      workflow.indexOf(
        "      - name: Install and smoke test Linux deb package",
      ),
    );
    const debStep = workflow.slice(
      workflow.indexOf(
        "      - name: Install and smoke test Linux deb package",
      ),
      workflow.indexOf("      - name: Upload installer artifacts"),
    );
    const macosSmokeJob = workflow.slice(
      workflow.indexOf("  macos-smoke:"),
      workflow.indexOf("  release:"),
    );
    const releaseJob = workflow.slice(workflow.indexOf("  release:"));

    expect(windowsStep).toContain(
      "if: matrix.label == 'windows-x64' || matrix.label == 'windows-arm64'",
    );
    expect(appImageStep).toContain(
      "if: matrix.label == 'linux-x64' || matrix.label == 'linux-arm64'",
    );
    expect(debStep).toContain(
      "if: matrix.label == 'linux-x64' || matrix.label == 'linux-arm64'",
    );
    expect(macosSmokeJob).toContain("runs-on: ${{ matrix.os }}");
    expect(macosSmokeJob).toContain("os: macos-15");
    expect(macosSmokeJob).toContain("os: macos-15-intel");
    expect(macosSmokeJob).toContain("name: macos-universal");
    expect(macosSmokeJob).toContain("hdiutil attach");
    expect(macosSmokeJob).toContain("ditto");
    expect(macosSmokeJob).toContain("pnpm smoke:package");
    expect(macosSmokeJob).toContain("--expected-architecture universal");
    expect(macosSmokeJob).toContain(
      "--runner-architecture ${{ matrix.runner-architecture }}",
    );
    expect(releaseJob).toContain("needs: [package, macos-smoke]");
  });

  test("parses the package workflow as YAML", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");

    const formatted = await format(workflow, { parser: "yaml" });

    expect(formatted).toContain("name: Package DeepSeek Harness Code");
    expect(formatted).toContain("jobs:");
  });

  test("publishes only installable packages to GitHub releases", async () => {
    // Given
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const releaseJob = workflow.slice(workflow.indexOf("  release:"));

    // When
    const publishedExtensions = [
      ...releaseJob.matchAll(/-name '\*\.([^']+)'/g),
    ].map((match) => match[1]);

    // Then
    expect(new Set(publishedExtensions)).toEqual(
      new Set(["dmg", "zip", "exe", "AppImage", "deb"]),
    );
    expect(releaseJob).not.toContain("artifacts/*");
    expect(releaseJob).not.toContain("*.blockmap");
    expect(releaseJob).toContain("update-manifest.json");
    expect(workflow.slice(0, workflow.indexOf("  release:"))).toContain(
      "setup.exe.blockmap",
    );
  });

  test("preserves native smoke failures while enforcing installer cleanup", async () => {
    // Given
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const windowsStep = workflow.slice(
      workflow.indexOf("      - name: Smoke test Windows package"),
      workflow.indexOf("      - name: Extract and smoke test Linux package"),
    );
    const linuxStep = workflow.slice(
      workflow.indexOf(
        "      - name: Extract and smoke test Linux AppImage package",
      ),
      workflow.indexOf("      - name: Upload installer artifacts"),
    );

    // When
    const windowsFinally = windowsStep.slice(windowsStep.indexOf("finally {"));
    const uninstallAttempt = windowsFinally.indexOf(
      'Start-Process -PassThru -Wait -FilePath $installedApplication.Uninstaller -ArgumentList "/S"',
    );
    const forcedRemoval = windowsFinally.indexOf(
      "Remove-DhscRunnerOwnedCustomRoot",
    );

    // Then
    expect(windowsStep).toContain("$primaryFailure = $null");
    expect(windowsStep).toContain(
      'if ($LASTEXITCODE -ne 0) { throw "package smoke failed with exit code $LASTEXITCODE" }',
    );
    expect(windowsFinally).toContain("Assert-DhscInstalledApplicationRemoved");
    expect(windowsFinally).not.toContain("if ($installSucceeded)");
    expect(uninstallAttempt).toBeGreaterThan(-1);
    expect(windowsFinally).toContain(
      "installed application uninstaller exited nonzero",
    );
    expect(forcedRemoval).toBeGreaterThan(uninstallAttempt);
    expect(windowsStep).toContain("Complete-DhscPackageStep");
    expect(linuxStep).toContain("original_exit=$?");
    expect(linuxStep).toContain('package_installed="false"');
    expect(linuxStep).toContain('package_installed="true"');
    expect(linuxStep).toContain('sudo apt-get install -y "$deb"');
    expect(linuxStep).not.toContain('sudo dpkg -i "$deb"');
    expect(linuxStep).toContain(
      "executable=$(command -v deepseek-harness-code)",
    );
    expect(linuxStep).not.toContain('awk -F= \'$1 == "Exec"');
    expect(linuxStep).toContain("sudo dpkg --purge deepseek-harness-code");
    expect(linuxStep).not.toContain("apt-get remove");
    expect(linuxStep).toContain(
      "dpkg-query -W -f='${Status}\\n' deepseek-harness-code 2>/dev/null | grep -q .",
    );
    expect(linuxStep).toContain('rm -rf "$squashfs_root" "$temp_root"');
    expect(linuxStep).toContain('exit "$original_exit"');
  });

  test("quarantines production Node candidates only around node-required smoke and always restores", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const steps = [
      workflow.slice(
        workflow.indexOf("      - name: Smoke test Windows package"),
        workflow.indexOf("      - name: Verify macOS Universal DMG"),
      ),
      workflow.slice(
        workflow.indexOf(
          "      - name: Extract and smoke test Linux AppImage package",
        ),
        workflow.indexOf(
          "      - name: Install and smoke test Linux deb package",
        ),
      ),
      workflow.slice(
        workflow.indexOf(
          "      - name: Install and smoke test Linux deb package",
        ),
        workflow.indexOf("      - name: Upload installer artifacts"),
      ),
      (() => {
        const start = workflow.indexOf(
          "      - name: Install and smoke test macOS Universal package",
        );
        return workflow.slice(
          start,
          workflow.indexOf(
            "      - name: Upload sanitized smoke evidence",
            start,
          ),
        );
      })(),
    ];

    for (const step of steps) {
      const runtime = step.indexOf("--scenario runtime");
      const hide = Math.max(
        step.indexOf("Hide-DhscNodeCandidates -Candidates $nodePlan"),
        step.indexOf('hide_system_node_candidates "${node_candidates[@]}"'),
      );
      const nodeRequired = step.indexOf("--scenario node-required");
      expect(runtime).toBeGreaterThan(-1);
      expect(hide).toBeGreaterThan(runtime);
      expect(nodeRequired).toBeGreaterThan(hide);
      expect(step).toContain("--print-node-quarantine-paths");
      expect(step).toMatch(
        /(?:finally \{|cleanup\(\) \{)[\s\S]*(?:Restore-DhscNodeCandidates|restore_system_node_candidates)/u,
      );
    }
    expect(workflow).toContain("node quarantine cleanup failed");
    expect(workflow).toContain("${BASHPID:-$$}");
    expect(workflow).not.toContain("${BASHPID}-${index}");
    expect(workflow).not.toContain("SMOKE_FORCE_NODE_MISSING");
    const windowsStep = steps[0] ?? "";
    expect(windowsStep).toContain("scripts/package-smoke-windows.ps1");
    expect(windowsStep).toContain("New-DhscNodeMoveList");
    expect(windowsStep).not.toContain("function Hide-SystemNodeCandidates");
    expect(windowsStep).not.toContain("function Restore-SystemNodeCandidates");
  });

  test("resolves the exact Windows product install root without scanning LocalAppData", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const helper = await readProjectFile("scripts/package-smoke-windows.ps1");
    const windowsStep = workflow.slice(
      workflow.indexOf("      - name: Smoke test Windows package"),
      workflow.indexOf("      - name: Verify macOS Universal DMG"),
    );

    expect(windowsStep).toContain("scripts/package-smoke-windows.ps1");
    expect(windowsStep).toContain("Get-DhscUninstallRegistryEntries");
    expect(windowsStep).toContain("Resolve-DhscInstalledApplication");
    expect(windowsStep).toContain("Assert-DhscInstalledApplicationRemoved");
    expect(windowsStep).toContain("Remove-DhscRunnerOwnedCustomRoot");
    expect(windowsStep).not.toContain("function Get-RegisteredInstallRoots");
    expect(windowsStep).not.toContain(
      "Remove-Item -LiteralPath $actualInstallRoot -Recurse",
    );
    expect(windowsStep).not.toMatch(
      /Get-ChildItem[^\n]*\$env:(?:LOCALAPPDATA|USERPROFILE)/iu,
    );
    expect(helper).toContain("Stack[IO.DirectoryInfo]");
    expect(helper).toContain("EnumerateFileSystemInfos");
    expect(helper).toContain("SearchOption]::TopDirectoryOnly");
    expect(helper).toContain("FileAttributes]::ReparsePoint");
    const customCleanup = helper.slice(
      helper.indexOf("function Remove-DhscRunnerOwnedCustomRoot"),
      helper.indexOf("function Assert-DhscInstalledApplicationRemoved"),
    );
    expect(customCleanup).toContain("Assert-DhscTreeHasNoReparsePoint");
    expect(
      customCleanup.indexOf("Assert-DhscTreeHasNoReparsePoint"),
    ).toBeLessThan(customCleanup.indexOf("Remove-Item"));
    expect(customCleanup).not.toContain("Get-ChildItem");
  });

  test("normalizes Windows cleanup failures as Exceptions and preserves primary failure priority", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const helper = await readProjectFile("scripts/package-smoke-windows.ps1");
    const windowsStep = workflow.slice(
      workflow.indexOf("      - name: Smoke test Windows package"),
      workflow.indexOf("      - name: Verify macOS Universal DMG"),
    );

    expect(windowsStep).toContain("New-DhscCleanupFailureList");
    expect(windowsStep).toContain("Add-DhscCaughtCleanupFailure");
    expect(windowsStep).toContain("Add-DhscDirectCleanupFailure");
    expect(windowsStep).toContain("Complete-DhscPackageStep");
    expect(windowsStep).not.toContain("$cleanupFailure.Exception.Message");
    expect(helper).toContain("[Collections.Generic.List[Exception]]");
    expect(helper).toContain("$ErrorRecord.Exception");
    expect(helper).toContain("$cleanupFailure.Message");
    expect(helper).toContain("throw $PrimaryFailure");
    expect(
      helper.match(
        /\[AllowEmptyCollection\(\)\]\[Collections\.Generic\.List\[object\]\]\$Moves/gu,
      ) ?? [],
    ).toHaveLength(2);
    expect(
      helper.match(
        /\[AllowEmptyCollection\(\)\]\[Collections\.Generic\.List\[Exception\]\]\$CleanupFailures/gu,
      ) ?? [],
    ).toHaveLength(3);
    expect(helper).not.toMatch(
      /\[AllowNull\(\)\]\[Collections\.Generic\.List/gu,
    );
  });

  test("scopes Linux smoke package metadata to each package step", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const appImageStep = workflow.slice(
      workflow.indexOf(
        "      - name: Extract and smoke test Linux AppImage package",
      ),
      workflow.indexOf(
        "      - name: Install and smoke test Linux deb package",
      ),
    );
    const debStep = workflow.slice(
      workflow.indexOf(
        "      - name: Install and smoke test Linux deb package",
      ),
      workflow.indexOf("      - name: Upload installer artifacts"),
    );

    expect(appImageStep).toContain("PACKAGE_KIND: appimage");
    expect(debStep).toContain("PACKAGE_KIND: deb");
  });

  test("keeps agent worktree metadata out of tracked package inputs", async () => {
    const stdout = execFileSync("git", ["ls-files", ".omo/**"], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    execFileSync("git", ["check-ignore", "-q", ".omo/probe"], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    expect(stdout.trim()).toBe("");
  });

  test("tracks only the repository-root AGENTS.md entry", () => {
    const trackedEntries = execFileSync(
      "git",
      ["ls-files", "*AGENTS.md", "*agent.md"],
      {
        cwd: projectRoot,
        encoding: "utf8",
      },
    );

    expect(trackedEntries.trim()).toBe("AGENTS.md");
  });

  test("contains no product workflow or package reference to agent evidence paths", async () => {
    const workflow = await readProjectFile(".github/workflows/package.yml");
    const manifest = await readProjectFile("package.json");

    expect(workflow).not.toMatch(/\.omo/);
    expect(manifest).not.toMatch(/\.omo/);
  });
});
