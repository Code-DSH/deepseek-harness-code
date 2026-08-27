import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const familyVersion = "0.1.1-rc.2.code.1";

async function sha256(path: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function sha512Integrity(path: string): Promise<string> {
  const digest = createHash("sha512");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return `sha512-${digest.digest("base64")}`;
}

describe("packaged runtime dependency closure", () => {
  it("pins the maintained Harness submodule without a floating branch", async () => {
    const [gitmodules, provenance] = await Promise.all([
      readFile(join(projectRoot, ".gitmodules"), "utf8"),
      readFile(
        join(projectRoot, "build", "node-runtime", "maintained-harness.json"),
        "utf8",
      ).then((value) => JSON.parse(value) as Record<string, unknown>),
    ]);

    expect(gitmodules).toContain("path = deps/deepseek-harness");
    expect(gitmodules).toContain(
      "url = https://github.com/Code-DSH/deepseek-harness.git",
    );
    expect(gitmodules).not.toMatch(/^\s*branch\s*=/mu);
    expect(provenance).toMatchObject({
      schemaVersion: 1,
      repositoryUrl: "https://github.com/Code-DSH/deepseek-harness.git",
      familyVersion,
    });
    expect(provenance.submoduleCommit).toMatch(/^[a-f0-9]{40}$/u);
  });

  it("stages the complete maintained family with local specs and verified hashes", async () => {
    const runtimeRoot = join(projectRoot, "build", "node-runtime");
    const [provenance, configManifest, buildManifest, configLock, buildLock] =
      await Promise.all([
        readFile(join(runtimeRoot, "maintained-harness.json"), "utf8").then(
          (value) =>
            JSON.parse(value) as {
              packages: Array<{
                name: string;
                version: string;
                file: string;
                sha256: string;
              }>;
            },
        ),
        readFile(
          join(projectRoot, "config", "node-runtime", "package.json"),
          "utf8",
        ).then(
          (value) =>
            JSON.parse(value) as { dependencies: Record<string, string> },
        ),
        readFile(join(runtimeRoot, "package.json"), "utf8").then(
          (value) =>
            JSON.parse(value) as { dependencies: Record<string, string> },
        ),
        readFile(
          join(projectRoot, "config", "node-runtime", "pnpm-lock.yaml"),
          "utf8",
        ),
        readFile(join(runtimeRoot, "pnpm-lock.yaml"), "utf8"),
      ]);

    expect(provenance.packages).toHaveLength(227);
    expect(provenance.packages.map((entry) => entry.name)).toEqual(
      provenance.packages
        .map((entry) => entry.name)
        .toSorted((left, right) => left.localeCompare(right)),
    );
    for (const entry of provenance.packages) {
      const specifier = `file:vendor/dsh/${entry.file}`;
      expect(entry.version).toBe(familyVersion);
      expect(configManifest.dependencies[entry.name]).toBe(specifier);
      expect(buildManifest.dependencies[entry.name]).toBe(specifier);
      const tarballPath = join(runtimeRoot, "vendor", "dsh", entry.file);
      expect(configLock).toContain(specifier);
      expect(buildLock).toContain(specifier);
      await expect(sha256(tarballPath)).resolves.toBe(entry.sha256);
      const integrity = await sha512Integrity(tarballPath);
      expect(buildLock).toContain(
        `resolution: {integrity: ${integrity}, tarball: ${specifier}}`,
      );
    }
    const tarballs = (await readdir(join(runtimeRoot, "vendor", "dsh"))).filter(
      (entry) => entry.endsWith(".tgz"),
    );
    expect(tarballs).toHaveLength(provenance.packages.length);
  });

  it("approves the exact local native builds needed by the maintained family", async () => {
    const [configWorkspace, buildWorkspace] = await Promise.all([
      readFile(
        join(projectRoot, "config", "node-runtime", "pnpm-workspace.yaml"),
        "utf8",
      ),
      readFile(
        join(projectRoot, "build", "node-runtime", "pnpm-workspace.yaml"),
        "utf8",
      ),
    ]);
    const localSubprocessBuild =
      '"@deepseek-ai/dsh-subprocess-local@file:vendor/dsh/deepseek-ai-dsh-subprocess-local-0.1.1-rc.2.code.1.tgz": true';

    for (const workspace of [configWorkspace, buildWorkspace]) {
      expect(workspace).toContain(localSubprocessBuild);
      expect(workspace).toContain("esbuild: true");
      expect(workspace).not.toContain("set this to true or false");
    }
  });

  it("resolves development DSH packages only from the submodule", async () => {
    const [manifest, lock] = await Promise.all([
      readFile(join(projectRoot, "package.json"), "utf8").then(
        (value) =>
          JSON.parse(value) as { dependencies: Record<string, string> },
      ),
      readFile(join(projectRoot, "pnpm-lock.yaml"), "utf8"),
    ]);
    const maintainedDependencies = Object.entries(manifest.dependencies).filter(
      ([name]) =>
        name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-"),
    );
    expect(maintainedDependencies.length).toBeGreaterThan(0);
    for (const [name, specifier] of maintainedDependencies) {
      expect(specifier).toMatch(/^link:deps\/deepseek-harness\//u);
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      expect(lock).not.toMatch(new RegExp(`^  ['"]?${escapedName}@`, "mu"));
    }
  });

  it("keeps composition declarative and registers official provider bundles", async () => {
    const [composition, compositionPatch, lifecycle, main, runtime] =
      await Promise.all([
        readFile(
          join(projectRoot, "packages", "app-composition", "package.json"),
          "utf8",
        ).then(
          (value) =>
            JSON.parse(value) as { dependencies?: Record<string, string> },
        ),
        readFile(
          join(projectRoot, "packages", "app-composition", "cordis.patch.yml"),
          "utf8",
        ),
        readFile(
          join(
            projectRoot,
            "apps",
            "desktop",
            "src",
            "lifecycle",
            "desktop-plugin-link.ts",
          ),
          "utf8",
        ),
        readFile(
          join(projectRoot, "apps", "desktop", "src", "main.ts"),
          "utf8",
        ),
        readFile(
          join(projectRoot, "config", "node-runtime", "package.json"),
          "utf8",
        ).then(
          (value) =>
            JSON.parse(value) as { dependencies?: Record<string, string> },
        ),
      ]);

    expect(composition.dependencies).toBeUndefined();
    expect(compositionPatch).not.toContain("@deepseek-ai/dsh-subagent-codex");
    expect(compositionPatch).not.toContain(
      "@deepseek-ai/dsh-subagent-claude-code",
    );
    expect(compositionPatch).toMatch(
      /- id: mcp-everything[\s\S]*?disabled: true[\s\S]*?serverName: everything/u,
    );
    expect(compositionPatch).toMatch(
      /- id: mcp-context7[\s\S]*?disabled: true[\s\S]*?serverName: context7/u,
    );
    expect(lifecycle).not.toContain("linkOnly");
    expect(runtime.dependencies?.["@deepseek-ai/dsh-subagent-codex"]).toBe(
      "file:vendor/dsh/deepseek-ai-dsh-subagent-codex-0.1.1-rc.2.code.1.tgz",
    );
    expect(
      runtime.dependencies?.["@deepseek-ai/dsh-subagent-claude-code"],
    ).toBe(
      "file:vendor/dsh/deepseek-ai-dsh-subagent-claude-code-0.1.1-rc.2.code.1.tgz",
    );
    expect(main).toContain('packageName: "@deepseek-ai/dsh-subagent-codex"');
    expect(main).toContain(
      'packageName: "@deepseek-ai/dsh-subagent-claude-code"',
    );
    expect(main).not.toContain("ensureGlobalDshCli");
    expect(main).not.toContain("npm install -g");
  });

  it("ships the LAN plugin and preserves bare-name plugin patches", async () => {
    const [lanManifest, lanPatch, injectorPatch, modeBoostPatch] =
      await Promise.all([
        readFile(
          join(projectRoot, "packages", "dsh-lan-access", "package.json"),
          "utf8",
        ).then((value) => JSON.parse(value) as { name: string }),
        readFile(
          join(projectRoot, "packages", "dsh-lan-access", "cordis.patch.yml"),
          "utf8",
        ),
        readFile(
          join(
            projectRoot,
            "build",
            "routing-suite",
            "injector",
            "cordis.patch.yml",
          ),
          "utf8",
        ),
        readFile(
          join(
            projectRoot,
            "build",
            "routing-suite",
            "mode-boost",
            "cordis.patch.yml",
          ),
          "utf8",
        ),
      ]);

    expect(lanManifest.name).toBe("dsh-lan-access");
    expect(lanPatch).toContain('name: "dsh-lan-access"');
    expect(injectorPatch).toContain("name: '@dsh-external/dsh-super-injector'");
    expect(modeBoostPatch).toContain("name: '@dsh-external/dsh-mode-boost'");
    for (const patch of [lanPatch, injectorPatch, modeBoostPatch]) {
      expect(patch).not.toContain("./node_modules/");
    }
  });
});
