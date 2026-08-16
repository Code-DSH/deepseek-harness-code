import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

type RoutingSuiteStartupResult = {
  status: "available" | "unavailable";
  path?: string;
  summary?: {
    presets: { id: string; status: string }[];
  };
};

type LinkModule = {
  ensureRoutingPresets: (
    dshHome: string,
    routingSuiteRoot: string,
  ) => Promise<{
    presets: { id: string; status: string }[];
  }>;
  installRoutingPresetsForStartup: (
    dshHome: string,
    routingSuiteRoot: string,
  ) => Promise<RoutingSuiteStartupResult>;
};

async function loadLinker(): Promise<LinkModule> {
  const module = (await import(
    "../../apps/desktop/src/lifecycle/routing-suite-link.js"
  )) as Record<string, unknown>;
  expect(module.ensureRoutingPresets).toBeTypeOf("function");
  expect(module.installRoutingPresetsForStartup).toBeTypeOf("function");
  return module as unknown as LinkModule;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`);
}

/** Build a fixture routing-suite snapshot mirroring scripts/fetch-routing-suite.mjs output. */
async function createRoutingSuiteSnapshot(
  root: string,
  version = "0.2.0",
): Promise<string> {
  const suiteRoot = join(root, "routing-suite");
  await writeJson(join(suiteRoot, "injector", "package.json"), {
    name: "@dsh-external/dsh-super-injector",
    version: "0.3.3",
    main: "lib/index.js",
  });
  await writeFile(
    join(suiteRoot, "injector", "cordis.patch.yml"),
    `# injector patch layer
- insert:
    - id: dsh-super-injector
      name: '@dsh-external/dsh-super-injector'
      config: {}
`,
  );
  await mkdir(join(suiteRoot, "injector", "lib"), { recursive: true });
  await writeFile(
    join(suiteRoot, "injector", "lib", "index.js"),
    "export const injector = true\n",
  );
  await writeJson(join(suiteRoot, "mode-boost", "package.json"), {
    name: "@dsh-external/dsh-mode-boost",
    version: "0.1.0",
    main: "lib/index.js",
    dsh: { bundle: { patch: "./cordis.patch.yml" } },
  });
  await writeFile(
    join(suiteRoot, "mode-boost", "cordis.patch.yml"),
    `- insert:\n    - id: mode-boost\n      name: '@dsh-external/dsh-mode-boost'\n`,
  );
  await mkdir(join(suiteRoot, "mode-boost", "lib"), { recursive: true });
  await writeFile(
    join(suiteRoot, "mode-boost", "lib", "index.js"),
    "export const boost = true\n",
  );
  for (const presetId of ["router-standard", "router-spec"]) {
    const presetDir = join(suiteRoot, "preset", presetId);
    await mkdir(presetDir, { recursive: true });
    await writeFile(
      join(presetDir, "agent.cordis.yml"),
      "- id: bootstrap\n  name: ./router-core.mjs\n",
    );
    await writeFile(join(presetDir, "preset.yml"), `name: ${presetId}\n`);
    await writeFile(
      join(presetDir, "router-core.mjs"),
      "export const route = true\n",
    );
  }
  await writeJson(join(suiteRoot, "versions.json"), {
    schemaVersion: 1,
    components: [
      { id: "injector", version: "0.3.3" },
      { id: "mode-boost", version: "0.1.0" },
      { id: "router-preset", version },
    ],
  });
  return suiteRoot;
}

/** Build a real .tgz with the given entries (path -> content) under staging/root. */
async function buildTarball(
  archive: string,
  stagingRoot: string,
  rootDir: string,
  entries: Record<string, string>,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(entries)) {
    const target = join(stagingRoot, rootDir, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await mkdir(dirname(archive), { recursive: true });
  execFileSync("tar", ["-czf", archive, "-C", stagingRoot, rootDir]);
}

describe("dsh-routing-suite auto-load pipeline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs presets without mutating the official Web profile", async () => {
    const { ensureRoutingPresets } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-link-"));
    const suiteRoot = await createRoutingSuiteSnapshot(root);
    const dshHome = join(root, "dsh-home");

    const summary = await ensureRoutingPresets(dshHome, suiteRoot);

    expect(summary.presets.map((preset) => preset.id).sort()).toEqual([
      "router-spec",
      "router-standard",
    ]);
    for (const preset of summary.presets) {
      expect(preset.status).toBe("installed");
    }

    await expect(
      readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ).rejects.toThrow();
    await expect(
      readFile(join(dshHome, "profiles", "web", "cordis.patch.yml"), "utf8"),
    ).rejects.toThrow();

    // Authored presets are managed installs with ownership markers.
    for (const presetId of ["router-standard", "router-spec"]) {
      const installed = join(dshHome, ".agent-presets", presetId);
      const metadata = await readFile(join(installed, "preset.yml"), "utf8");
      expect(metadata).toContain("/");
      expect(metadata).not.toContain(`name: ${presetId}`);
      expect(metadata).not.toContain("暂无描述");
      expect(
        await readFile(join(installed, "agent.cordis.yml"), "utf8"),
      ).toContain("router-core.mjs");
      const marker = JSON.parse(
        await readFile(
          join(installed, ".deepseek-harness-code-managed.json"),
          "utf8",
        ),
      ) as Record<string, unknown>;
      expect(marker).toMatchObject({
        schemaVersion: 1,
        owner: "deepseek-harness-code",
        presetId,
        sourceVersion: "0.2.0",
      });
    }
  });

  it("is idempotent across restarts and never duplicates bundle entries", async () => {
    const { ensureRoutingPresets } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-idempotent-"));
    const suiteRoot = await createRoutingSuiteSnapshot(root);
    const dshHome = join(root, "dsh-home");

    await ensureRoutingPresets(dshHome, suiteRoot);
    const summary = await ensureRoutingPresets(dshHome, suiteRoot);

    expect(summary.presets.map((preset) => preset.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
  });

  it("leaves existing user profile state byte-for-byte unchanged", async () => {
    const { ensureRoutingPresets } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-user-patch-"));
    const suiteRoot = await createRoutingSuiteSnapshot(root);
    const dshHome = join(root, "dsh-home");
    const patchPath = join(dshHome, "profiles", "web", "cordis.patch.yml");
    await mkdir(dirname(patchPath), { recursive: true });
    await writeFile(
      patchPath,
      `# user-owned entry
- insert:
    - id: user-plugin
      name: './user-plugin.mjs'
      config:
        enabled: true
`,
    );

    const manifestPath = join(dshHome, "profiles", "web", "package.json");
    await writeJson(manifestPath, {
      dependencies: { "user-plugin": "1.0.0" },
      dsh: { profile: { bundles: ["user-plugin"] } },
    });

    await ensureRoutingPresets(dshHome, suiteRoot);

    expect(await readFile(patchPath, "utf8")).toContain("./user-plugin.mjs");
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toMatchObject({
      dependencies: { "user-plugin": "1.0.0" },
      dsh: { profile: { bundles: ["user-plugin"] } },
    });
  });

  it("degrades to 'unavailable' without ever blocking startup", async () => {
    const { installRoutingPresetsForStartup } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-missing-"));
    const dshHome = join(root, "dsh-home");
    const missingRoot = join(root, "no-such-snapshot");

    const result = await installRoutingPresetsForStartup(dshHome, missingRoot);

    expect(result.status).toBe("unavailable");
  });

  it("rejects untrusted cached archives before extracting executable code", async () => {
    const root = await mkdtemp(join(tmpdir(), "routing-suite-checksum-"));
    const cacheRoot = join(root, "cache");
    const outputRoot = join(root, "output");

    await buildTarball(
      join(cacheRoot, "dsh-external-dsh-super-injector-0.3.3.tgz"),
      join(root, "injector-staging"),
      "package",
      {
        "package.json": JSON.stringify({
          name: "@dsh-external/dsh-super-injector",
          version: "0.3.3",
        }),
        "lib/index.js": "throw new Error('untrusted injector executed')\n",
      },
    );
    await buildTarball(
      join(cacheRoot, "dsh-external-dsh-mode-boost-0.1.0.tgz"),
      join(root, "boost-staging"),
      "package",
      {
        "package.json": JSON.stringify({
          name: "@dsh-external/dsh-mode-boost",
          version: "0.1.0",
        }),
        "lib/index.js": "throw new Error('untrusted boost executed')\n",
      },
    );
    await buildTarball(
      join(cacheRoot, "dsh-router-standard-eff787e.tar.gz"),
      join(root, "preset-staging"),
      "dsh-router-standard-eff787e95132d6c7104214542104a84d656b497e",
      {
        "preset/router-standard/agent.cordis.yml":
          "- id: bootstrap\n  name: ./router-core.mjs\n",
        "preset/router-standard/router-core.mjs":
          "throw new Error('untrusted preset executed')\n",
      },
    );

    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), "scripts", "fetch-routing-suite.mjs"),
        "--cache",
        cacheRoot,
        "--out",
        outputRoot,
      ],
      { encoding: "utf8" },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SHA-256 mismatch");
    await expect(
      readFile(join(outputRoot, "injector", "lib", "index.js"), "utf8"),
    ).rejects.toThrow();
  });

  it("preserves bare injector resolution and makes mode boost an official bundle", async () => {
    const {
      validateInjectorPatchContent,
      createOfficialModeBoostManifest,
      MODE_BOOST_BUNDLE_PATCH,
    } = (await import(
      pathToFileURL(
        join(process.cwd(), "scripts", "routing-suite-contract.mjs"),
      ).href
    )) as {
      validateInjectorPatchContent: (content: string) => string;
      createOfficialModeBoostManifest: (
        manifest: Record<string, unknown>,
      ) => Record<string, unknown>;
      MODE_BOOST_BUNDLE_PATCH: string;
    };

    const upstreamInjectorPatch =
      "- insert:\n    - id: dsh-super-injector\n      name: '@dsh-external/dsh-super-injector'\n";
    expect(validateInjectorPatchContent(upstreamInjectorPatch)).toBe(
      upstreamInjectorPatch,
    );
    expect(() => validateInjectorPatchContent("- insert: []\n")).toThrow(
      "expected exactly one audited bare entry",
    );
    expect(
      createOfficialModeBoostManifest({
        name: "@dsh-external/dsh-mode-boost",
        version: "0.1.0",
      }),
    ).toMatchObject({
      dsh: { bundle: { patch: "./cordis.patch.yml" } },
    });
    expect(MODE_BOOST_BUNDLE_PATCH).toContain(
      "name: '@dsh-external/dsh-mode-boost'",
    );
  });
});
