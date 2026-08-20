import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  installManagedPresetForStartup,
  type ManagedPresetStartupResult,
  type PresetDisplayMetadata,
} from "./desktop-plugin-link.js";

const ROUTING_PRESET_DIRECTORY = "preset";
const ROUTING_VERSIONS_FILE = "versions.json";

export const ROUTING_PRESET_METADATA: Record<string, PresetDisplayMetadata> = {
  "router-standard": {
    name: "路由标准模式",
    description:
      "根据任务自动选择「先执行」或「先分析」的首轮策略；首次调用工具后恢复完整标准工具集。",
  },
  "router-spec": {
    name: "路由深度思考模式",
    description:
      "先深入分析并梳理方案，再动手执行，适合修复、排查、重构等需要先理解问题的任务；首次调用工具后恢复完整标准工具集。",
  },
};

export type RoutingSuitePresetInstall = {
  id: string;
  status: ManagedPresetStartupResult["status"];
};

export type RoutingPresetInstallSummary = {
  presets: RoutingSuitePresetInstall[];
};

export type RoutingPresetStartupResult =
  | { status: "available"; summary: RoutingPresetInstallSummary }
  | { status: "unavailable"; path: string };

async function existingEntry(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function readRouterPresetVersion(
  routingSuiteRoot: string,
): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(
      await readFile(join(routingSuiteRoot, ROUTING_VERSIONS_FILE), "utf8"),
    ) as { components?: { id?: unknown; version?: unknown }[] };
    const router = manifest.components?.find(
      (component) => component.id === "router-preset",
    );
    return typeof router?.version === "string" ? router.version : undefined;
  } catch {
    return undefined;
  }
}

async function ensureRouterPresets(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingSuitePresetInstall[]> {
  const presetRoot = join(routingSuiteRoot, ROUTING_PRESET_DIRECTORY);
  const version =
    (await readRouterPresetVersion(routingSuiteRoot)) ?? "snapshot";
  const ids: string[] = [];
  for (const entry of (await readdir(presetRoot, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    if (
      entry.isDirectory() &&
      (await existingEntry(join(presetRoot, entry.name, "agent.cordis.yml")))
    ) {
      ids.push(entry.name);
    }
  }
  const presets: RoutingSuitePresetInstall[] = [];
  for (const id of ids) {
    const result = await installManagedPresetForStartup(
      dshHome,
      join(presetRoot, id),
      id,
      version,
      presetRoot,
      ROUTING_PRESET_METADATA[id],
    );
    presets.push({ id, status: result.status });
  }
  return presets;
}

/** Synchronize only the authored presets; plugins are owned by `dsh plugin`. */
export async function ensureRoutingPresets(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingPresetInstallSummary> {
  return { presets: await ensureRouterPresets(dshHome, routingSuiteRoot) };
}

/** Keep invalid optional presets from preventing Standard Harness startup. */
export async function installRoutingPresetsForStartup(
  dshHome: string,
  routingSuiteRoot: string,
): Promise<RoutingPresetStartupResult> {
  try {
    return {
      status: "available",
      summary: await ensureRoutingPresets(dshHome, routingSuiteRoot),
    };
  } catch (error) {
    const diagnostic =
      error instanceof Error
        ? error.message.slice(0, 500)
        : "routing presets unavailable";
    process.stderr.write(`[DeepSeek Harness Code] ${diagnostic}\n`);
    return { status: "unavailable", path: routingSuiteRoot };
  }
}
