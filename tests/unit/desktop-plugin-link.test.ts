import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
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

  it("registers only the desktop plugin as an official web profile bundle idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-bundle-"));
    const dshHome = join(root, "dsh-home");

    await ensureDesktopPluginBundle(dshHome);
    await ensureDesktopPluginBundle(dshHome);

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
    ]);
  });

  it("removes a legacy anchored web bundle registration", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-plugin-disabled-"));
    const dshHome = join(root, "dsh-home");

    const profileRoot = join(dshHome, "profiles", "web");
    await mkdir(profileRoot, { recursive: true });
    await writeFile(
      join(profileRoot, "package.json"),
      `${JSON.stringify({
        name: "dsh-profile-web",
        private: true,
        dsh: {
          profile: {
            bundles: [
              "@deepseek-ai/dsh-base",
              "@deepseek-ai/dsh-web-app",
              "dsh-anchored-standard",
            ],
          },
        },
      })}\n`,
    );
    await ensureDesktopPluginBundle(dshHome);

    const manifest = JSON.parse(
      await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"),
    ) as { dsh: { profile: { bundles: string[] } } };
    expect(manifest.dsh.profile.bundles).toEqual([
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "deepseek-harness-desktop-plugin",
    ]);
  });
});
