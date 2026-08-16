import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ensureAnchoredStandardPluginLink,
  ensureDesktopPluginBundle,
  ensureDesktopPluginLink,
} from "../../apps/desktop/src/lifecycle/desktop-plugin-link.js";

describe("desktop plugin profile link", () => {
  it("makes the bundled package resolvable from the app-owned web profile", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-link-"));
    const pluginRoot = join(root, "resources", "desktop-plugin");
    const dshHome = join(root, "dsh-home");
    await mkdir(pluginRoot, { recursive: true });

    const link = await ensureDesktopPluginLink(dshHome, pluginRoot);

    expect(link).toBe(
      join(
        dshHome,
        "profiles",
        "web",
        "node_modules",
        "deepseek-harness-desktop-plugin",
      ),
    );
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    expect(resolve(dirname(link), await readlink(link))).toBe(
      await realpath(pluginRoot),
    );
  });

  it("registers the plugin as an official web profile bundle idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-bundle-"));
    const dshHome = join(root, "dsh-home");

    await ensureDesktopPluginBundle(dshHome, { anchoredStandard: true });
    await ensureDesktopPluginBundle(dshHome, { anchoredStandard: true });

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
      "dsh-anchored-standard",
    ]);
  });

  it("removes the anchored bundle from the profile when the preference is disabled", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-disabled-"));
    const dshHome = join(root, "dsh-home");

    await ensureDesktopPluginBundle(dshHome, { anchoredStandard: true });
    await ensureDesktopPluginBundle(dshHome, { anchoredStandard: false });

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
    ]);
  });

  it("links the integrated anchored-standard bundle into the Web profile", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-anchored-link-"));
    const pluginRoot = join(root, "resources", "anchored-standard-plugin");
    const dshHome = join(root, "dsh-home");
    await mkdir(pluginRoot, { recursive: true });

    const link = await ensureAnchoredStandardPluginLink(dshHome, pluginRoot);

    expect(link).toBe(
      join(dshHome, "profiles", "web", "node_modules", "dsh-anchored-standard"),
    );
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
  });
});
