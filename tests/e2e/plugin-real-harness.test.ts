import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import vm from "node:vm";

import { afterEach, describe, expect, it } from "vitest";

import { reserveLoopbackPort } from "../../apps/desktop/src/lifecycle/port-retry.js";

const repositoryRoot = process.cwd();
const require = createRequire(join(repositoryRoot, "package.json"));
const dshEntry = require.resolve("@deepseek-ai/dsh/lib/bin.js");
const pluginRoot = join(repositoryRoot, "packages", "desktop-plugin");
const children = new Set<ChildProcess>();
const temporaryRoots = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...children].map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once("exit", () => resolve());
          child.kill("SIGTERM");
        }),
    ),
  );
  children.clear();
  await Promise.all(
    [...temporaryRoots].map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
  temporaryRoots.clear();
});

async function waitForIndex(
  origin: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return response.text();
    } catch {
      // The loopback listener is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Harness index did not become ready at ${origin}`);
}

describe("desktop plugin with the real pinned Harness", () => {
  it("appears in the boot graph and serves its official client bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-desktop-plugin-"));
    temporaryRoots.add(root);
    const dshHome = join(root, "home");
    const initialized = spawnSync(
      process.execPath,
      [dshEntry, "web", "--dump-config"],
      {
        cwd: repositoryRoot,
        env: { ...process.env, DSH_HOME: dshHome },
        encoding: "utf8",
      },
    );
    expect(initialized.status, initialized.stderr).toBe(0);

    const profileRoot = join(dshHome, "profiles", "web");
    const manifestPath = join(profileRoot, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      dsh: { profile: { bundles: string[] } };
    };
    manifest.dsh.profile.bundles.push("deepseek-harness-desktop-plugin");
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, undefined, 2)}\n`,
    );
    const modules = join(profileRoot, "node_modules");
    await mkdir(modules, { recursive: true });
    await symlink(
      pluginRoot,
      join(modules, "deepseek-harness-desktop-plugin"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(
      process.execPath,
      [dshEntry, "web", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: repositoryRoot,
        env: { ...process.env, DSH_HOME: dshHome },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    children.add(child);

    const index = await waitForIndex(origin);
    expect(index).toContain("deepseek-harness-desktop-plugin");
    const bundle = await fetch(
      `${origin}/plugins/deepseek-harness-desktop-plugin/client.js`,
    );
    expect(bundle.status).toBe(200);
    const source = await bundle.text();
    expect(source).toContain("window.__ModuleLoader__.load");

    let registration:
      | { factory(require: (id: string) => unknown): Record<string, unknown> }
      | undefined;
    const document = {
      documentElement: { dataset: {} as Record<string, string> },
      head: { appendChild: () => undefined },
      getElementById: () => null,
      createElement: () => ({ id: "", textContent: "" }),
    };
    const window = {
      deepseekDesktop: {},
      location: { pathname: "/settings" },
      history: { pushState: () => undefined, replaceState: () => undefined },
      matchMedia: () => ({ matches: false }),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      __ModuleLoader__: {
        load(value: typeof registration) {
          registration = value;
        },
      },
    };
    vm.runInNewContext(source, { document, window });
    expect(registration).toBeDefined();
    const client = registration!.factory((id) => {
      if (id === "react") {
        return {
          createElement: () => undefined,
          useEffect: () => undefined,
          useLayoutEffect: () => undefined,
          useRef: (value: unknown) => ({ current: value }),
          useState: () => [undefined, () => undefined],
        };
      }
      if (id === "react/jsx-runtime") {
        return { jsx: () => undefined, jsxs: () => undefined };
      }
      if (id === "@deepseek-ai/dsh-client-ui-primitives") {
        return {
          Button: () => undefined,
          Menu: () => undefined,
          IconChevronDownOutline14: () => undefined,
        };
      }
      throw new Error(`unexpected client dependency: ${id}`);
    });
    const slots = {
      inject(_name: string, register: () => unknown) {
        register();
        return () => undefined;
      },
      register() {
        return undefined;
      },
    };
    const locale = {
      register() {
        return () => undefined;
      },
    };
    const strictContext = new Proxy(
      { slots, locale },
      {
        get(target, property, receiver) {
          if (
            typeof property === "string" &&
            !(client.inject as string[]).includes(property)
          ) {
            throw new Error(`cannot get property ${property} without inject`);
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const dispose = (client.apply as (ctx: typeof strictContext) => () => void)(
      strictContext,
    );
    dispose();
  }, 20_000);
});
