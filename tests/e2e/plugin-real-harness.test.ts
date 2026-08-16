import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
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
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import { afterEach, describe, expect, it } from "vitest";

import { reserveLoopbackPort } from "../../apps/desktop/src/lifecycle/port-retry.js";
import { ensureAnchoredStandardPreset } from "../../apps/desktop/src/lifecycle/desktop-plugin-link.js";

const repositoryRoot = process.cwd();
const require = createRequire(join(repositoryRoot, "package.json"));
const dshEntry = require.resolve("@deepseek-ai/dsh/lib/bin.js");
const pluginRoot = join(repositoryRoot, "packages", "desktop-plugin");
const anchoredPluginRoot = join(
  repositoryRoot,
  "packages",
  "anchored-standard-plugin",
);
const children = new Set<ChildProcess>();
const mockServers = new Set<Server>();
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
    [...mockServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  mockServers.clear();
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

async function callHarnessApi(
  origin: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<{
  result:
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } };
}> {
  const response = await fetch(`${origin}/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "client-request",
      rpcId: randomUUID(),
      method,
      payload,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    result:
      | { ok: true; value: unknown }
      | { ok: false; error: { code: string; message: string } };
  };
}

async function waitForHarnessApiRoute(
  origin: string,
  method: string,
  payload: Record<string, unknown>,
  timeoutMs = 15_000,
): ReturnType<typeof callHarnessApi> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/api/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "client-request",
        rpcId: randomUUID(),
        method,
        payload,
      }),
    });
    if (response.status === 200) {
      return (await response.json()) as Awaited<
        ReturnType<typeof callHarnessApi>
      >;
    }
    if (response.status !== 404) {
      throw new Error(
        `Harness API ${method} returned HTTP ${response.status} during startup`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Harness API ${method} did not become ready at ${origin}`);
}

type MockProviderRequest = {
  tools?: Array<{ function?: { name?: string } }>;
};

async function startMockDeepSeekProvider(): Promise<{
  baseURL: string;
  conversationRequests: MockProviderRequest[];
}> {
  const conversationRequests: MockProviderRequest[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as
      | MockProviderRequest
      | undefined;
    if (Array.isArray(body?.tools)) conversationRequests.push(body);
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.end(
      [
        'data: {"id":"mock","object":"chat.completion.chunk","created":0,"model":"mock","choices":[{"index":0,"delta":{"role":"assistant","content":"ok"},"finish_reason":null}]}',
        'data: {"id":"mock","object":"chat.completion.chunk","created":0,"model":"mock","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2,"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":1}}',
        "data: [DONE]",
        "",
      ].join("\n\n"),
    );
  });
  mockServers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Mock provider did not bind a TCP address");
  }
  return {
    baseURL: `http://127.0.0.1:${address.port}`,
    conversationRequests,
  };
}

async function waitForConversationRequests(
  requests: readonly MockProviderRequest[],
  count: number,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (requests.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Mock provider did not receive ${count} agent requests`);
}

async function waitForSessionIdle(
  origin: string,
  sessionId: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listed = await callHarnessApi(origin, "session.list", {});
    if (listed.result.ok) {
      const value = listed.result.value as {
        items: Array<{ sessionId: string; running: boolean }>;
      };
      const session = value.items.find((item) => item.sessionId === sessionId);
      if (session !== undefined && !session.running) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Harness session ${sessionId} did not become idle`);
}

describe("desktop plugin with the real pinned Harness", () => {
  it("is discovered as a healthy optional preset by the pinned rc.6 roster", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-anchored-preset-real-"));
    temporaryRoots.add(root);
    const dshHome = join(root, "home");
    const installed = await ensureAnchoredStandardPreset(
      dshHome,
      anchoredPluginRoot,
    );
    expect(installed.status).toBe("installed");
    const mockProvider = await startMockDeepSeekProvider();
    await writeFile(
      join(dshHome, "settings.yaml"),
      [
        "llm-deepseek:",
        `  baseURL: ${mockProvider.baseURL}`,
        "  thinking: disabled",
        "  reasoningEffort: off",
        "  maxTokens: 1024",
        "",
      ].join("\n"),
    );

    const dshRequire = createRequire(dshEntry);
    const webAppManifest = dshRequire.resolve(
      "@deepseek-ai/dsh-web-app/package.json",
    );
    const presetEntry = createRequire(webAppManifest).resolve(
      "@deepseek-ai/dsh-agent-presets",
    );
    const presetModule = (await import(pathToFileURL(presetEntry).href)) as {
      discoverPresets(
        roots: ReadonlyArray<{ path: string; trust: "user" }>,
      ): Promise<
        Array<{
          id: string;
          name?: string;
          description?: string;
          broken?: string;
        }>
      >;
    };
    const presets = await presetModule.discoverPresets([
      { path: join(dshHome, ".agent-presets"), trust: "user" },
    ]);

    expect(presets).toEqual([
      expect.objectContaining({
        id: "anchored-standard",
        name: "渐进式标准模式 / Anchored Standard (Progressive)",
        description: expect.stringContaining("Minimal's real tool pair"),
      }),
    ]);
    expect(presets[0]?.broken).toBeUndefined();

    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(
      process.execPath,
      [dshEntry, "web", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          DSH_HOME: dshHome,
          DEEPSEEK_API_KEY: "test-placeholder",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    children.add(child);
    await waitForIndex(origin);

    // The Web root is registered slightly before Cordis finishes publishing
    // domain routes. Wait for the specific roster route instead of guessing a
    // fixed delay; repeated startup probes observe an occasional 404 then 200.
    const roster = await waitForHarnessApiRoute(origin, "agentPreset.list", {});
    expect(roster.result.ok, JSON.stringify(roster.result)).toBe(true);
    if (!roster.result.ok) return;
    const rosterValue = roster.result.value as {
      presets: Array<{ id: string; isDefault: boolean; broken?: string }>;
    };
    expect(rosterValue.presets).toContainEqual(
      expect.objectContaining({
        id: "anchored-standard",
        isDefault: false,
      }),
    );
    expect(rosterValue.presets).toContainEqual(
      expect.objectContaining({ id: "standard", isDefault: true }),
    );

    const created = await callHarnessApi(origin, "session.create", {
      agentPreset: "anchored-standard",
      cwd: repositoryRoot,
    });
    expect(created.result.ok, JSON.stringify(created.result)).toBe(true);
    if (created.result.ok) {
      expect(created.result.value).toEqual(
        expect.objectContaining({ agentPreset: "anchored-standard" }),
      );
      const { sessionId } = created.result.value as { sessionId: string };
      for (const [index, text] of [
        "first request",
        "second request",
      ].entries()) {
        const prompted = await callHarnessApi(origin, "session.prompt", {
          sessionId,
          mode: "queue",
          content: [{ type: "text", text }],
        });
        expect(prompted.result.ok, JSON.stringify(prompted.result)).toBe(true);
        await waitForConversationRequests(
          mockProvider.conversationRequests,
          index + 1,
        );
        await waitForSessionIdle(origin, sessionId);
      }
      const toolNames = mockProvider.conversationRequests
        .slice(0, 2)
        .map((request) => request.tools?.map((tool) => tool.function?.name));
      expect(toolNames[0]).toEqual(["bash", "str_replace_editor"]);
      expect(toolNames[1]?.toSorted()).toEqual(
        [
          "bash",
          "str_replace_editor",
          "dev_tool_search",
          "skill_search",
          "skill_load",
        ].toSorted(),
      );
    }
  }, 15_000);

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
