import { createHash } from "node:crypto";
import { createServer, request, type IncomingHttpHeaders } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { networkInterfaces } from "node:os";
import type { Duplex } from "node:stream";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

interface LanProxyStartResult {
  port: number;
  accessUrl: string;
}

interface LanProxyHostLike {
  start(loopbackOrigin: string): Promise<LanProxyStartResult>;
  stop(): Promise<void>;
}

interface UpstreamRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

interface HttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

type LanProxyHostConstructor = new () => LanProxyHostLike;

async function loadLanProxyHost(): Promise<LanProxyHostConstructor> {
  const module = await import("../../apps/desktop/src/lifecycle/lan-proxy.js");
  return module.LanProxyHost;
}

function listen(
  server: ReturnType<typeof createServer>,
  host: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

function httpRequest(
  url: string | URL,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const outbound = request(
      url,
      { method: options.method, headers: options.headers },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outbound.setTimeout(2_000, () =>
      outbound.destroy(new Error("request timed out")),
    );
    outbound.once("error", reject);
    if (options.body !== undefined) outbound.write(options.body);
    outbound.end();
  });
}

function viaLoopback(accessUrl: string): URL {
  const url = new URL(accessUrl);
  url.hostname = "127.0.0.1";
  return url;
}

function sessionCookie(response: HttpResult): string {
  const setCookie = response.headers["set-cookie"]?.[0];
  if (setCookie === undefined) throw new Error("missing session cookie");
  return setCookie.split(";", 1)[0] ?? "";
}

async function exchangeToken(accessUrl: string): Promise<{
  cookie: string;
  redirect: string;
  response: HttpResult;
}> {
  const response = await httpRequest(viaLoopback(accessUrl));
  const redirect = response.headers.location;
  if (redirect === undefined) throw new Error("missing redirect location");
  return { cookie: sessionCookie(response), redirect, response };
}

function firstLanIpv4Address(): string | undefined {
  for (const records of Object.values(networkInterfaces())) {
    for (const record of records ?? []) {
      if (!record.internal && record.family === "IPv4") {
        return record.address;
      }
    }
  }
  return undefined;
}

function websocketUpgrade(
  host: string,
  port: number,
  cookie: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    let received = "";
    let completed = false;
    let failure: Error | undefined;
    let receivedReadyMarker = false;
    const timer = setTimeout(() => {
      failure = new Error("websocket upgrade timed out");
      socket.destroy();
    }, 2_000);
    const finish = (): void => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (failure !== undefined) reject(failure);
      else if (receivedReadyMarker) resolve(received);
      else reject(new Error("websocket upgrade closed before becoming ready"));
    };
    socket.setEncoding("utf8");
    socket.once("error", (error) => {
      failure = error;
      socket.destroy();
    });
    socket.once("close", finish);
    socket.on("data", (chunk: string) => {
      received += chunk;
      if (!received.includes("upstream-ready")) return;
      receivedReadyMarker = true;
      socket.destroy();
    });
    socket.once("connect", () => {
      socket.write(
        [
          "GET /socket?visible=yes HTTP/1.1",
          `Host: ${host}:${port}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Version: 13",
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
          `Cookie: ${cookie}`,
          "",
          "",
        ].join("\r\n"),
      );
    });
  });
}

function waitForSocketClose(socket: Duplex): Promise<boolean> {
  if (socket.destroyed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (closed: boolean): void => {
      clearTimeout(timer);
      socket.off("close", onClose);
      resolve(closed);
    };
    const onClose = (): void => finish(true);
    const timer = setTimeout(() => finish(socket.destroyed), 500);
    socket.once("close", onClose);
  });
}

describe("LAN proxy", () => {
  const upstreamRequests: UpstreamRequest[] = [];
  const upstreamUpgradeSockets = new Set<Duplex>();
  const upstream = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      const observed: UpstreamRequest = {
        method: incoming.method ?? "",
        url: incoming.url ?? "",
        headers: incoming.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      upstreamRequests.push(observed);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(observed));
    });
  });
  let upstreamOrigin = "";
  let proxy: LanProxyHostLike | undefined;

  upstream.on("upgrade", (incoming, socket) => {
    upstreamUpgradeSockets.add(socket);
    socket.once("end", () => socket.destroy());
    socket.once("error", () => socket.destroy());
    socket.once("close", () => upstreamUpgradeSockets.delete(socket));
    const key = incoming.headers["sec-websocket-key"] ?? "";
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    upstreamRequests.push({
      method: incoming.method ?? "",
      url: incoming.url ?? "",
      headers: incoming.headers,
      body: "",
    });
    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Connection: Upgrade",
        "Upgrade: websocket",
        `Sec-WebSocket-Accept: ${accept}`,
        "",
        "upstream-ready",
      ].join("\r\n"),
    );
  });

  beforeAll(async () => {
    const port = await listen(upstream, "127.0.0.1");
    upstreamOrigin = `http://127.0.0.1:${port}`;
  });

  beforeEach(async () => {
    upstreamRequests.length = 0;
    const LanProxyHost = await loadLanProxyHost();
    proxy = new LanProxyHost();
  });

  afterEach(async () => {
    const upgradeSockets = [...upstreamUpgradeSockets];
    const downstreamClosed = upgradeSockets.map(waitForSocketClose);
    await proxy?.stop();
    proxy = undefined;
    const closedByProxy = await Promise.all(downstreamClosed);
    for (const socket of upstreamUpgradeSockets) socket.destroy();
    upstreamUpgradeSockets.clear();
    expect(closedByProxy.every(Boolean)).toBe(true);
  });

  afterAll(async () => {
    await close(upstream);
  });

  it("rejects an unauthenticated request without reaching Harness", async () => {
    const started = await proxy!.start(upstreamOrigin);
    const url = viaLoopback(started.accessUrl);
    url.search = "";

    const response = await httpRequest(url);

    expect(response.status).toBe(401);
    expect(response.body).toBe("Unauthorized");
    expect(upstreamRequests).toHaveLength(0);
  });

  it("exchanges the query token for a scoped cookie and redirects to a redacted URL", async () => {
    const started = await proxy!.start(upstreamOrigin);
    const accessUrl = viaLoopback(started.accessUrl);
    accessUrl.pathname = "/workspace";
    accessUrl.searchParams.set("visible", "yes");

    const response = await httpRequest(accessUrl);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/workspace?visible=yes");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["set-cookie"]?.[0]).toMatch(
      /^dsh_lan_session=[A-Za-z0-9_-]+; HttpOnly; SameSite=Strict; Path=\/$/u,
    );
    expect(response.headers.location).not.toContain("lanToken");
    expect(upstreamRequests).toHaveLength(0);
  });

  it("forwards authenticated HTTP while removing proxy credentials and hop-by-hop headers", async () => {
    const started = await proxy!.start(upstreamOrigin);
    const exchanged = await exchangeToken(started.accessUrl);
    const target = viaLoopback(started.accessUrl);
    target.pathname = "/api/run";
    target.search = "?visible=yes";

    const response = await httpRequest(target, {
      method: "POST",
      headers: {
        cookie: `${exchanged.cookie}; harness_session=kept`,
        connection: "keep-alive, x-remove-me",
        "x-remove-me": "secret-hop-value",
        "proxy-authorization": "Basic must-not-forward",
        "x-forwarded-for": "spoofed-client",
        origin: `http://127.0.0.1:${started.port}`,
        "content-type": "text/plain",
      },
      body: "real-body",
    });

    expect(response.status).toBe(200);
    const observed = JSON.parse(response.body) as UpstreamRequest;
    expect(observed).toMatchObject({
      method: "POST",
      url: "/api/run?visible=yes",
      body: "real-body",
    });
    expect(observed.headers.host).toBe(new URL(upstreamOrigin).host);
    expect(observed.headers.cookie).toBe("harness_session=kept");
    expect(observed.headers.origin).toBe(upstreamOrigin);
    expect(observed.headers["x-remove-me"]).toBeUndefined();
    expect(observed.headers["proxy-authorization"]).toBeUndefined();
    expect(observed.headers["x-forwarded-for"]).toBeUndefined();
    expect(observed.url).not.toContain("lanToken");
  });

  it("listens on all interfaces instead of only loopback", async () => {
    const started = await proxy!.start(upstreamOrigin);
    const exchanged = await exchangeToken(started.accessUrl);
    const lanAddress = firstLanIpv4Address() ?? "0.0.0.0";

    expect(new URL(started.accessUrl).hostname).toBe("0.0.0.0");
    const response = await httpRequest(
      `http://${lanAddress}:${started.port}/lan`,
      {
        headers: { cookie: exchanged.cookie },
      },
    );
    expect(response.status).toBe(200);
  });

  it("forwards an authenticated WebSocket upgrade to the loopback origin", async () => {
    const started = await proxy!.start(upstreamOrigin);
    const exchanged = await exchangeToken(started.accessUrl);

    const response = await websocketUpgrade(
      "127.0.0.1",
      started.port,
      exchanged.cookie,
    );

    expect(response).toContain("HTTP/1.1 101 Switching Protocols");
    expect(response).toContain("upstream-ready");
    const observed = upstreamRequests.at(-1);
    expect(observed?.url).toBe("/socket?visible=yes");
    expect(observed?.headers.host).toBe(new URL(upstreamOrigin).host);
    expect(observed?.headers.cookie).toBeUndefined();
  });

  it("refuses connections after stop and invalidates the old cookie", async () => {
    const first = await proxy!.start(upstreamOrigin);
    const oldSession = await exchangeToken(first.accessUrl);
    await proxy!.stop();

    await expect(
      httpRequest(`http://127.0.0.1:${first.port}/`, {
        headers: { cookie: oldSession.cookie },
      }),
    ).rejects.toThrow();

    const restarted = await proxy!.start(upstreamOrigin);
    const response = await httpRequest(`http://127.0.0.1:${restarted.port}/`, {
      headers: { cookie: oldSession.cookie },
    });
    expect(response.status).toBe(401);
  });
});
