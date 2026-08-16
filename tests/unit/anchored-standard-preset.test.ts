import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type InstallResult = {
  status: "installed" | "updated" | "unchanged" | "conflict";
  path: string;
};

type StartupInstallResult =
  | InstallResult
  | {
      status: "unavailable";
      path: string;
    };

type EnsurePreset = (
  dshHome: string,
  packagedRoot: string,
) => Promise<InstallResult>;

async function loadInstaller(): Promise<EnsurePreset> {
  const lifecycle = (await import(
    "../../apps/desktop/src/lifecycle/desktop-plugin-link.js"
  )) as Record<string, unknown>;
  expect(lifecycle.ensureAnchoredStandardPreset).toBeTypeOf("function");
  return lifecycle.ensureAnchoredStandardPreset as EnsurePreset;
}

async function loadStartupInstaller(): Promise<
  (dshHome: string, packagedRoot: string) => Promise<StartupInstallResult>
> {
  const lifecycle = (await import(
    "../../apps/desktop/src/lifecycle/desktop-plugin-link.js"
  )) as Record<string, unknown>;
  expect(lifecycle.installAnchoredStandardPresetForStartup).toBeTypeOf(
    "function",
  );
  return lifecycle.installAnchoredStandardPresetForStartup as (
    dshHome: string,
    packagedRoot: string,
  ) => Promise<StartupInstallResult>;
}

async function createPackagedPreset(
  root: string,
  version: string,
  composition = "- id: bootstrap\n  name: ./tool-bootstrap.mjs\n",
): Promise<string> {
  const packagedRoot = join(root, "resources", "anchored-standard-plugin");
  const presetRoot = join(packagedRoot, "preset");
  await mkdir(presetRoot, { recursive: true });
  await Promise.all([
    writeFile(
      join(packagedRoot, "package.json"),
      `${JSON.stringify({ name: "dsh-anchored-standard", version })}\n`,
    ),
    writeFile(join(packagedRoot, "LICENSE"), "MIT License\n"),
    writeFile(join(packagedRoot, "NOTICE"), "Pinned community source\n"),
    writeFile(
      join(packagedRoot, "UPSTREAM.json"),
      `${JSON.stringify({ commit: "db4527a" })}\n`,
    ),
    writeFile(join(packagedRoot, "LOCAL-PATCHES.md"), "Strict failure\n"),
    writeFile(
      join(packagedRoot, "UPSTREAM-SHA256SUMS"),
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  preset/agent.cordis.yml\n",
    ),
    writeFile(join(presetRoot, "agent.cordis.yml"), composition),
    writeFile(
      join(presetRoot, "preset.yml"),
      "name: 渐进式标准模式 / Anchored Standard (Progressive)\n" +
        "description: 首轮仅提供 Minimal 的真实双工具。 / Progressive Standard mode.\n",
    ),
    writeFile(
      join(presetRoot, "tool-bootstrap.mjs"),
      "export const name = 'tool-bootstrap'\n",
    ),
  ]);
  return packagedRoot;
}

describe("managed Anchored Standard agent preset", () => {
  it("installs the packaged preset with an ownership and digest marker", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-install-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");

    const result = await ensurePreset(dshHome, packagedRoot);

    const target = join(dshHome, ".agent-presets", "anchored-standard");
    expect(result).toEqual({ status: "installed", path: target });
    expect(await readFile(join(target, "agent.cordis.yml"), "utf8")).toContain(
      "tool-bootstrap.mjs",
    );
    expect(await readFile(join(target, "LICENSE"), "utf8")).toBe(
      "MIT License\n",
    );
    expect(
      await readFile(join(target, "UPSTREAM-SHA256SUMS"), "utf8"),
    ).toContain("preset/agent.cordis.yml");
    const marker = JSON.parse(
      await readFile(
        join(target, ".deepseek-harness-code-managed.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(marker).toMatchObject({
      schemaVersion: 1,
      owner: "deepseek-harness-code",
      presetId: "anchored-standard",
      sourceVersion: "0.2.0",
    });
    expect(marker.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    const metadata = await readFile(join(target, "preset.yml"), "utf8");
    expect(metadata).toContain("渐进式标准模式");
    expect(metadata).toContain("Anchored Standard (Progressive)");
    expect(metadata).toContain("Progressive Standard mode");
  });

  it("is idempotent and upgrades only an unmodified managed copy", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-upgrade-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");

    expect((await ensurePreset(dshHome, packagedRoot)).status).toBe(
      "installed",
    );
    expect((await ensurePreset(dshHome, packagedRoot)).status).toBe(
      "unchanged",
    );
    await createPackagedPreset(
      root,
      "0.2.1",
      "- id: bootstrap-v2\n  name: ./tool-bootstrap.mjs\n",
    );
    expect((await ensurePreset(dshHome, packagedRoot)).status).toBe("updated");
    expect(
      await readFile(
        join(
          dshHome,
          ".agent-presets",
          "anchored-standard",
          "agent.cordis.yml",
        ),
        "utf8",
      ),
    ).toContain("bootstrap-v2");
    expect(
      (await readdir(join(dshHome, ".agent-presets"))).filter((name) =>
        name.includes("anchored-standard."),
      ),
    ).toEqual([]);
  });

  it("updates ownership metadata when only the packaged version changes", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-version-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");
    await ensurePreset(dshHome, packagedRoot);
    await writeFile(
      join(packagedRoot, "package.json"),
      `${JSON.stringify({ name: "dsh-anchored-standard", version: "0.2.1" })}\n`,
    );

    expect((await ensurePreset(dshHome, packagedRoot)).status).toBe("updated");
    const marker = JSON.parse(
      await readFile(
        join(
          dshHome,
          ".agent-presets",
          "anchored-standard",
          ".deepseek-harness-code-managed.json",
        ),
        "utf8",
      ),
    ) as { sourceVersion: string };
    expect(marker.sourceVersion).toBe("0.2.1");
  });

  it("preserves an unknown same-name preset and reports a conflict", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-conflict-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");
    const target = join(dshHome, ".agent-presets", "anchored-standard");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "agent.cordis.yml"), "user-authored\n");

    await expect(ensurePreset(dshHome, packagedRoot)).resolves.toEqual({
      status: "conflict",
      path: target,
    });
    expect(await readFile(join(target, "agent.cordis.yml"), "utf8")).toBe(
      "user-authored\n",
    );
  });

  it("preserves a non-directory entry that occupies the preset id", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(
      join(tmpdir(), "anchored-preset-file-conflict-"),
    );
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");
    const target = join(dshHome, ".agent-presets", "anchored-standard");
    await mkdir(join(dshHome, ".agent-presets"), { recursive: true });
    await writeFile(target, "user-owned\n");

    await expect(ensurePreset(dshHome, packagedRoot)).resolves.toEqual({
      status: "conflict",
      path: target,
    });
    expect(await readFile(target, "utf8")).toBe("user-owned\n");
  });

  it("treats edits to an installed managed copy as a conflict", async () => {
    const ensurePreset = await loadInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-edited-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");
    const target = join(dshHome, ".agent-presets", "anchored-standard");
    await ensurePreset(dshHome, packagedRoot);
    await writeFile(join(target, "agent.cordis.yml"), "locally-edited\n");
    await createPackagedPreset(root, "0.2.1");

    expect((await ensurePreset(dshHome, packagedRoot)).status).toBe("conflict");
    expect(await readFile(join(target, "agent.cordis.yml"), "utf8")).toBe(
      "locally-edited\n",
    );
  });

  it("isolates a corrupt packaged preset so Standard startup can continue", async () => {
    const installForStartup = await loadStartupInstaller();
    const root = await mkdtemp(join(tmpdir(), "anchored-preset-invalid-"));
    const packagedRoot = await createPackagedPreset(root, "0.2.0");
    const dshHome = join(root, "dsh-home");
    await writeFile(join(packagedRoot, "package.json"), "{}\n");

    await expect(installForStartup(dshHome, packagedRoot)).resolves.toEqual({
      status: "unavailable",
      path: join(dshHome, ".agent-presets", "anchored-standard"),
    });
    await expect(
      readFile(
        join(dshHome, ".agent-presets", "anchored-standard", "preset.yml"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
