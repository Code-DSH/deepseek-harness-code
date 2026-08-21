import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  request as requestHttp,
  type ClientRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";

const LISTEN_HOST = "0.0.0.0";
const SESSION_COOKIE = "dsh_lan_session";
const TOKEN_QUERY = "lanToken";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface LanProxyStartResult {
  port: number;
  accessUrl: string;
}

type AuthenticationResult =
  | { status: "authenticated"; path: string }
  | { status: "exchange"; location: string; cookie: string }
  | { status: "rejected" };

function parseRequestPath(requestUrl: string | undefined): URL {
  return new URL(requestUrl ?? "/", "http://lan-proxy.invalid");
}

function connectionHeaderNames(headers: IncomingHttpHeaders): Set<string> {
  const removed = new Set(HOP_BY_HOP_HEADERS);
  const values = Array.isArray(headers.connection)
    ? headers.connection
    : [headers.connection];
  for (const value of values) {
    for (const name of value?.split(",") ?? []) {
      const normalized = name.trim().toLowerCase();
      if (normalized !== "") removed.add(normalized);
    }
  }
  return removed;
}

function withoutProxyCookie(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const retained = value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (part === "") return false;
      const separator = part.indexOf("=");
      const name = separator === -1 ? part : part.slice(0, separator);
      return name !== SESSION_COOKIE;
    });
  return retained.length === 0 ? undefined : retained.join("; ");
}

function forwardingHeaders(
  headers: IncomingHttpHeaders,
  upstream: URL,
): OutgoingHttpHeaders {
  const removed = connectionHeaderNames(headers);
  const forwarded: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (removed.has(normalized) || normalized.startsWith("x-forwarded-")) {
      continue;
    }
    if (normalized === "cookie") {
      const cookie = withoutProxyCookie(
        Array.isArray(value) ? value.join("; ") : value,
      );
      if (cookie !== undefined) forwarded.cookie = cookie;
      continue;
    }
    if (value !== undefined) forwarded[normalized] = value;
  }
  forwarded.host = upstream.host;
  if (headers.origin !== undefined) forwarded.origin = upstream.origin;
  return forwarded;
}

function responseHeaders(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
  const removed = connectionHeaderNames(headers);
  const forwarded: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (removed.has(name.toLowerCase()) || value === undefined) continue;
    forwarded[name] = value;
  }
  return forwarded;
}

function writeSocketResponse(
  socket: Duplex,
  status: number,
  reason: string,
  headers: readonly string[],
): void {
  socket.end([`HTTP/1.1 ${status} ${reason}`, ...headers, "", ""].join("\r\n"));
}

function waitForSocketClose(socket: Duplex): Promise<void> {
  if (socket.destroyed) return Promise.resolve();
  return new Promise((resolve) => socket.once("close", resolve));
}

function isLoopbackOrigin(value: string): URL {
  const origin = new URL(value);
  const loopback =
    origin.hostname === "127.0.0.1" ||
    origin.hostname === "[::1]" ||
    origin.hostname === "::1";
  if (origin.protocol !== "http:" || !loopback) {
    throw new Error("LAN proxy upstream must be a loopback HTTP origin");
  }
  return new URL(origin.origin);
}

export class LanProxyHost {
  private server: Server | undefined;
  private tokenBytes: Buffer | undefined;
  private readonly sockets = new Set<Duplex>();
  private readonly outboundRequests = new Set<ClientRequest>();
  private readonly outboundResponses = new Set<IncomingMessage>();

  async start(loopbackOrigin: string): Promise<LanProxyStartResult> {
    if (this.server !== undefined) throw new Error("LAN proxy already started");
    const upstream = isLoopbackOrigin(loopbackOrigin);
    const tokenBytes = Buffer.from(randomBytes(32).toString("base64url"));
    this.tokenBytes = tokenBytes;

    const server = createServer((incoming, response) =>
      this.handleHttp(incoming, response, upstream),
    );
    this.server = server;
    server.on("connection", (socket) => this.trackSocket(socket));
    server.on("upgrade", (incoming, socket, head) =>
      this.handleUpgrade(incoming, socket, head, upstream),
    );

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(0, LISTEN_HOST, () => {
          server.off("error", onError);
          resolve();
        });
      });
    } catch (error) {
      this.server = undefined;
      this.invalidateToken();
      throw error;
    }

    const port = (server.address() as AddressInfo).port;
    return {
      port,
      accessUrl: `http://${LISTEN_HOST}:${port}/?${TOKEN_QUERY}=${tokenBytes.toString("utf8")}`,
    };
  }

  async stop(): Promise<void> {
    this.invalidateToken();
    const server = this.server;
    this.server = undefined;
    const socketClosures = [...this.sockets].map(waitForSocketClose);
    for (const response of this.outboundResponses) response.destroy();
    for (const request of this.outboundRequests) request.destroy();
    for (const socket of this.sockets) socket.destroy();
    const serverClosed =
      server === undefined
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error === undefined) resolve();
              else reject(error);
            });
            server.closeAllConnections();
          });
    await Promise.all([serverClosed, ...socketClosures]);
    this.sockets.clear();
    this.outboundRequests.clear();
    this.outboundResponses.clear();
  }

  private trackSocket(socket: Duplex): void {
    if (this.server === undefined || this.tokenBytes === undefined) {
      socket.destroy();
      return;
    }
    this.sockets.add(socket);
    socket.once("close", () => this.sockets.delete(socket));
  }

  private trackOutboundRequest(outbound: ClientRequest): void {
    if (this.server === undefined || this.tokenBytes === undefined) {
      outbound.destroy();
      return;
    }
    this.outboundRequests.add(outbound);
    outbound.once("close", () => this.outboundRequests.delete(outbound));
    outbound.once("socket", (socket) => this.trackSocket(socket));
  }

  private trackOutboundResponse(upstreamResponse: IncomingMessage): void {
    if (this.server === undefined || this.tokenBytes === undefined) {
      upstreamResponse.destroy();
      return;
    }
    this.outboundResponses.add(upstreamResponse);
    const retire = (): void => {
      this.outboundResponses.delete(upstreamResponse);
    };
    upstreamResponse.once("end", retire);
    upstreamResponse.once("close", retire);
  }

  private invalidateToken(): void {
    this.tokenBytes?.fill(0);
    this.tokenBytes = undefined;
  }

  private tokenMatches(candidate: string): boolean {
    const expected = this.tokenBytes;
    if (expected === undefined || candidate.length !== expected.length) {
      return false;
    }
    const actual = Buffer.from(candidate, "utf8");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private authenticate(incoming: IncomingMessage): AuthenticationResult {
    const url = parseRequestPath(incoming.url);
    const queryToken = url.searchParams.get(TOKEN_QUERY);
    if (queryToken !== null) {
      url.searchParams.delete(TOKEN_QUERY);
      if (!this.tokenMatches(queryToken)) return { status: "rejected" };
      return {
        status: "exchange",
        location: `${url.pathname}${url.search}`,
        cookie: `${SESSION_COOKIE}=${queryToken}; HttpOnly; SameSite=Strict; Path=/`,
      };
    }

    const cookies = incoming.headers.cookie?.split(";") ?? [];
    for (const cookie of cookies) {
      const separator = cookie.indexOf("=");
      if (separator === -1) continue;
      const name = cookie.slice(0, separator).trim();
      const value = cookie.slice(separator + 1).trim();
      if (name === SESSION_COOKIE && this.tokenMatches(value)) {
        return {
          status: "authenticated",
          path: `${url.pathname}${url.search}`,
        };
      }
    }
    return { status: "rejected" };
  }

  private handleHttp(
    incoming: IncomingMessage,
    response: ServerResponse,
    upstream: URL,
  ): void {
    const authentication = this.authenticate(incoming);
    if (authentication.status === "rejected") {
      response.writeHead(401, {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Unauthorized");
      return;
    }
    if (authentication.status === "exchange") {
      response.writeHead(302, {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        location: authentication.location,
        "set-cookie": authentication.cookie,
      });
      response.end();
      return;
    }

    const target = new URL(authentication.path, upstream);
    const outbound = requestHttp(
      target,
      {
        method: incoming.method,
        headers: forwardingHeaders(incoming.headers, upstream),
        agent: false,
      },
      (upstreamResponse) => {
        this.trackOutboundResponse(upstreamResponse);
        if (upstreamResponse.destroyed) {
          if (!response.destroyed) response.destroy();
          return;
        }
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.statusMessage,
          responseHeaders(upstreamResponse.headers),
        );
        response.once("close", () => upstreamResponse.destroy());
        upstreamResponse.pipe(response);
      },
    );
    this.trackOutboundRequest(outbound);
    outbound.once("error", () => {
      if (response.headersSent) response.destroy();
      else {
        response.writeHead(502, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Bad Gateway");
      }
    });
    incoming.once("aborted", () => outbound.destroy());
    incoming.pipe(outbound);
  }

  private handleUpgrade(
    incoming: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    upstream: URL,
  ): void {
    const authentication = this.authenticate(incoming);
    if (authentication.status === "rejected") {
      writeSocketResponse(socket, 401, "Unauthorized", [
        "Cache-Control: no-store",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Length: 0",
      ]);
      return;
    }
    if (authentication.status === "exchange") {
      writeSocketResponse(socket, 302, "Found", [
        "Cache-Control: no-store",
        "Referrer-Policy: no-referrer",
        `Location: ${authentication.location}`,
        `Set-Cookie: ${authentication.cookie}`,
        "Content-Length: 0",
      ]);
      return;
    }

    const target = new URL(authentication.path, upstream);
    const headers = forwardingHeaders(incoming.headers, upstream);
    headers.connection = "Upgrade";
    headers.upgrade = "websocket";
    const outbound = requestHttp(target, {
      method: incoming.method,
      headers,
      agent: false,
    });
    this.trackOutboundRequest(outbound);
    outbound.once(
      "upgrade",
      (upstreamResponse, upstreamSocket, upstreamHead) => {
        if (this.server === undefined || this.tokenBytes === undefined) {
          upstreamSocket.destroy();
          socket.destroy();
          return;
        }
        this.trackSocket(upstreamSocket);
        socket.once("end", () => upstreamSocket.destroy());
        socket.once("close", () => upstreamSocket.destroy());
        socket.once("error", () => upstreamSocket.destroy());
        upstreamSocket.once("end", () => socket.destroy());
        upstreamSocket.once("close", () => socket.destroy());
        upstreamSocket.once("error", () => socket.destroy());
        const handshakeHeaders: string[] = [
          "Connection: Upgrade",
          "Upgrade: websocket",
        ];
        const removed = connectionHeaderNames(upstreamResponse.headers);
        for (
          let index = 0;
          index < upstreamResponse.rawHeaders.length;
          index += 2
        ) {
          const name = upstreamResponse.rawHeaders[index];
          const value = upstreamResponse.rawHeaders[index + 1];
          if (
            name === undefined ||
            value === undefined ||
            removed.has(name.toLowerCase())
          ) {
            continue;
          }
          handshakeHeaders.push(`${name}: ${value}`);
        }
        socket.write(
          [
            `HTTP/1.1 ${upstreamResponse.statusCode ?? 101} ${upstreamResponse.statusMessage ?? "Switching Protocols"}`,
            ...handshakeHeaders,
            "",
            "",
          ].join("\r\n"),
        );
        if (head.length > 0) upstreamSocket.write(head);
        if (upstreamHead.length > 0) socket.write(upstreamHead);
        socket.pipe(upstreamSocket).pipe(socket);
      },
    );
    outbound.once("response", (upstreamResponse) => {
      upstreamResponse.resume();
      writeSocketResponse(socket, 502, "Bad Gateway", ["Content-Length: 0"]);
    });
    outbound.once("error", () => {
      if (!socket.destroyed) {
        writeSocketResponse(socket, 502, "Bad Gateway", ["Content-Length: 0"]);
      }
    });
    outbound.end();
  }
}
