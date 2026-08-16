import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

type RoutingSuiteStartupResult = {
  status: "available" | "unavailable";
  path?: string;
  summary?: {
    bundles: { packageName: string; linked: boolean }[];
    modeBoost: { linked: boolean; patch: "added" | "present" };
    presets: { id: string; status: string }[];
  };
};

type LinkModule = {
  ensureRoutingSuite: (
    dshHome: string,
    routingSuiteRoot: string,
  ) => Promise<{
    bundles: { packageName: string; linked: boolean }[];
    modeBoost: { linked: boolean; patch: "added" | "present" };
    presets: { id: string; status: string }[];
  }>;
  installRoutingSuiteForStartup: (
    dshHome: string,
    routingSuiteRoot: string,
  ) => Promise<RoutingSuiteStartupResult>;
};

async function loadLinker(): Promise<LinkModule> {
  const module = (await import(
    "../../apps/desktop/src/lifecycle/routing-suite-link.js"
  )) as Record<string, unknown>;
  expect(module.ensureRoutingSuite).toBeTypeOf("function");
  expect(module.installRoutingSuiteForStartup).toBeTypeOf("function");
  return module as unknown as LinkModule;
}

type UpdateModule = {
  refreshRoutingSuiteCache: (userDataPath: string) => Promise<void>;
  resolveRoutingSuiteRoot: (
    userDataPath: string,
    bundledRoot: string,
  ) => Promise<string>;
  cacheIsComplete: (cacheRoot: string) => Promise<boolean>;
};

async function loadUpdater(): Promise<UpdateModule> {
  const module = (await import(
    "../../apps/desktop/src/lifecycle/routing-suite-update.js"
  )) as Record<string, unknown>;
  expect(module.refreshRoutingSuiteCache).toBeTypeOf("function");
  expect(module.resolveRoutingSuiteRoot).toBeTypeOf("function");
  return module as unknown as UpdateModule;
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
    "# injector patch layer\n[]\n",
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
  });
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

  it("assembles the bundled snapshot into the app-owned profile on startup", async () => {
    const { ensureRoutingSuite } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-link-"));
    const suiteRoot = await createRoutingSuiteSnapshot(root);
    const dshHome = join(root, "dsh-home");

    const summary = await ensureRoutingSuite(dshHome, suiteRoot);

    expect(summary.bundles).toEqual([
      { packageName: "@dsh-external/dsh-super-injector", linked: true },
    ]);
    expect(summary.modeBoost).toEqual({ linked: true, patch: "added" });
    expect(summary.presets.map((preset) => preset.id).sort()).toEqual([
      "router-spec",
      "router-standard",
    ]);
    for (const preset of summary.presets) {
      expect(preset.status).toBe("installed");
    }

    // The profile manifest carries the suite bundles after the host bundles.
    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toContain(
      "@dsh-external/dsh-super-injector",
    );
    expect(
      manifest.dsh.profile.bundles.indexOf("@dsh-external/dsh-super-injector"),
    ).toBeGreaterThan(
      manifest.dsh.profile.bundles.indexOf("deepseek-harness-desktop-plugin"),
    );

    // Both suite bundles are reachable through the profile's node_modules.
    const modules = join(dshHome, "profiles", "web", "node_modules");
    expect(
      await readlink(join(modules, "@dsh-external", "dsh-super-injector")),
    ).toBe(await realpath(join(suiteRoot, "injector")));
    expect(
      await readlink(join(modules, "@dsh-external", "dsh-mode-boost")),
    ).toBe(await realpath(join(suiteRoot, "mode-boost")));

    // The user patch layer registers the host-plane boost plugin.
    const patch = await readFile(
      join(dshHome, "profiles", "web", "cordis.patch.yml"),
      "utf8",
    );
    expect(patch).toContain("id: mode-boost");
    expect(patch).toContain("@dsh-external/dsh-mode-boost");

    // Authored presets are managed installs with ownership markers.
    for (const presetId of ["router-standard", "router-spec"]) {
      const installed = join(dshHome, ".agent-presets", presetId);
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
    const { ensureRoutingSuite } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-idempotent-"));
    const suiteRoot = await createRoutingSuiteSnapshot(root);
    const dshHome = join(root, "dsh-home");

    await ensureRoutingSuite(dshHome, suiteRoot);
    const summary = await ensureRoutingSuite(dshHome, suiteRoot);

    expect(summary.modeBoost.patch).toBe("present");
    expect(summary.presets.map((preset) => preset.status)).toEqual([
      "unchanged",
      "unchanged",
    ]);
    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(
      manifest.dsh.profile.bundles.filter(
        (bundle) => bundle === "@dsh-external/dsh-super-injector",
      ),
    ).toHaveLength(1);
    const patch = await readFile(
      join(dshHome, "profiles", "web", "cordis.patch.yml"),
      "utf8",
    );
    expect(patch.match(/id: mode-boost/g)).toHaveLength(1);
  });

  it("degrades to 'unavailable' without ever blocking startup", async () => {
    const { installRoutingSuiteForStartup } = await loadLinker();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-missing-"));
    const dshHome = join(root, "dsh-home");
    const missingRoot = join(root, "no-such-snapshot");

    const result = await installRoutingSuiteForStartup(dshHome, missingRoot);

    expect(result.status).toBe("unavailable");
  });

  it("prefers the refreshed user-level cache over the bundled snapshot", async () => {
    const { resolveRoutingSuiteRoot, cacheIsComplete } = await loadUpdater();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-resolve-"));
    const cacheRoot = join(root, "routing-suite-cache");
    const bundledRoot = join(root, "bundled");
    await mkdir(bundledRoot, { recursive: true });
    await writeFile(join(bundledRoot, "versions.json"), "{}");

    // Empty cache -> bundled snapshot.
    expect(await resolveRoutingSuiteRoot(root, bundledRoot)).toBe(bundledRoot);

    // Complete cache -> cache wins. The fixture builds at root/routing-suite,
    // so move it to the user-level cache location the resolver checks.
    await createRoutingSuiteSnapshot(root);
    await rename(join(root, "routing-suite"), cacheRoot);
    expect(await cacheIsComplete(cacheRoot)).toBe(true);
    expect(await resolveRoutingSuiteRoot(root, bundledRoot)).toBe(cacheRoot);
  });

  it("refreshes the cache from GitHub tarballs and then respects the 24h cadence", async () => {
    const { refreshRoutingSuiteCache, cacheIsComplete } = await loadUpdater();
    const root = await mkdtemp(join(tmpdir(), "routing-suite-refresh-"));
    const stagingRoot = join(root, "staging");
    await mkdir(stagingRoot, { recursive: true });
    const archives = new Map<string, Buffer>();

    // Build the three release tarballs exactly as the updater expects them.
    const injectorArchive = join(stagingRoot, "injector.tgz");
    await buildTarball(injectorArchive, stagingRoot, "package", {
      "package.json": JSON.stringify({
        name: "@dsh-external/dsh-super-injector",
        version: "0.3.3",
        main: "lib/index.js",
      }),
      "lib/index.js": "export const injector = true\n",
      "cordis.patch.yml": "# injector\n[]\n",
    });
    const boostArchive = join(stagingRoot, "boost.tgz");
    await buildTarball(boostArchive, stagingRoot, "package", {
      "package.json": JSON.stringify({
        name: "@dsh-external/dsh-mode-boost",
        version: "0.1.0",
        main: "lib/index.js",
      }),
      "lib/index.js": "export const boost = true\n",
    });
    const presetArchive = join(stagingRoot, "preset.tgz");
    await buildTarball(presetArchive, stagingRoot, "dsh-router-standard-main", {
      "preset/router-standard/agent.cordis.yml":
        "- id: bootstrap\n  name: ./router-core.mjs\n",
      "preset/router-standard/preset.yml": "name: router-standard\n",
      "preset/router-standard/router-core.mjs": "export const route = true\n",
      "preset/router-spec/agent.cordis.yml":
        "- id: bootstrap\n  name: ./router-core.mjs\n",
      "preset/router-spec/preset.yml": "name: router-spec\n",
      "preset/router-spec/router-core.mjs": "export const route = true\n",
    });

    archives.set(
      "dsh-external-dsh-super-injector-0.3.3.tgz",
      await readFile(injectorArchive),
    );
    archives.set(
      "dsh-external-dsh-mode-boost-0.1.0.tgz",
      await readFile(boostArchive),
    );
    archives.set(
      "dsh-router-standard-main.tar.gz",
      await readFile(presetArchive),
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const fileName = url.slice(url.lastIndexOf("/") + 1);
      const body = fileName.endsWith("main.tar.gz")
        ? archives.get("dsh-router-standard-main.tar.gz")
        : archives.get(fileName);
      if (body === undefined) {
        return new Response("not found", { status: 404 });
      }
      return new Response(new Uint8Array(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await refreshRoutingSuiteCache(root);

    const cacheRoot = join(root, "routing-suite-cache");
    expect(await cacheIsComplete(cacheRoot)).toBe(true);
    expect(
      await readFile(join(cacheRoot, "injector", "package.json"), "utf8"),
    ).toContain("dsh-super-injector");
    expect(
      await readFile(join(cacheRoot, "mode-boost", "package.json"), "utf8"),
    ).toContain("dsh-mode-boost");
    expect((await readdir(join(cacheRoot, "preset"))).sort()).toEqual([
      "router-spec",
      "router-standard",
    ]);
    expect(await readFile(join(cacheRoot, "versions.json"), "utf8")).toContain(
      "router-preset",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // A second refresh within the 24h window must not download again.
    await refreshRoutingSuiteCache(root);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await rm(cacheRoot, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });
});
