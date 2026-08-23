/**
 * dsh-plugin-market — host half（完整 Node 环境）。
 *
 * 职责（文档 plugin-market-development.md §10.2 最小 host 原则）：
 *  1. GET  /health          client 探测用（在不在、端口对不对）
 *  2. GET  /api/v1/*        Hub API 只读代理（CSP 兜底通道；仅放行 /api/v1/ 前缀）
 *  3. POST /install         窄权限安装 IPC：结构化 spec 硬校验 → 官方 dsh plugin CLI
 *                           （参数数组 + shell:false，绝不执行任意命令字符串）
 *
 * 只监听 127.0.0.1 loopback（不暴露公网）；不访问 token/session/settings；
 * 不读写任意用户文件；不记录凭据或完整响应体。
 *
 * 安全规则（§8.3）：
 *  - 拒绝任何 command/script 字段与白名单外入参；
 *  - install spec 只接受 { package, version, kind }，package 必须是合法本地目录
 *    或包名形状（禁止 null 字节/控制字符/shell 元字符）；
 *  - 安装结果 stdout/stderr 只截断回传，不原样透传；
 *  - 安装失败 ≠ 市场 API 失败（返回明确错误，不抛跨域异常）。
 */

import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";

// 生产 Hub：远程服务器（systemd 常驻，ufw 已放行 8741）；
// 开发期可用 DSHC_HUB_BASE 覆盖为本地 mock（http://127.0.0.1:8741）。
const HUB_BASE = process.env.DSHC_HUB_BASE || "http://38.76.196.236:8741";
const BASE_PORT = Number(process.env.DSHC_HOST_PORT || 8742);
const MAX_PORT_TRY = 8;
const PROXY_TIMEOUT_MS = 8000;
const INSTALL_TIMEOUT_MS = 120000;
const ACTIVE_PROFILE = process.env.DSHC_PROFILE || "web";

export const name = "@dsh-external/deepseek-harness-plugin-market";
export const inject = [];

const SHORT = "dsh-plugin-market";

/* ─────────────── 结构化安装规格校验（§8.3） ─────────────── */

const PKG_DIR_RE = /^\/[^\0\n\r\t|&;<>'"`$(){}\[\]]{1,400}$/;
const PKG_NAME_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]{0,120}$/i;
const GIT_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;

function validateInstallSpec(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "install spec 必须是对象" };
  }
  // 拒绝任何可执行字段（Hub 契约不提供，客户端也不接受）
  const forbidden = ["command", "script", "shell", "args", "cmd", "exec"];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      return { ok: false, error: `拒绝非白名单字段: ${key}` };
    }
  }
  const pkg = raw.package;
  const version = raw.version;
  const kind = raw.kind;
  if (typeof pkg !== "string" || pkg.length === 0 || pkg.length > 400) {
    return { ok: false, error: "package 字段缺失或非法" };
  }
  if (pkg.includes("\0")) return { ok: false, error: "package 含 null 字节" };
  if (kind === "local-dir") {
    if (!PKG_DIR_RE.test(pkg)) return { ok: false, error: "package 不是合法本地目录路径" };
  } else if (kind === "git") {
    if (!GIT_URL_RE.test(pkg)) return { ok: false, error: "package 不是合法 GitHub 仓库 URL" };
  } else if (kind === "npm") {
    if (!PKG_NAME_RE.test(pkg)) return { ok: false, error: "package 不是合法包名" };
  } else {
    return { ok: false, error: `kind 必须是 local-dir|npm|git，收到: ${String(kind)}` };
  }
  if (version !== undefined && (typeof version !== "string" || version.length > 64)) {
    return { ok: false, error: "version 字段非法" };
  }
  return { ok: true, spec: { package: pkg, version: version || "", kind } };
}

/* ─────────────── 官方 CLI 安装执行（§8.2） ─────────────── */

// 探测 dsh 可执行文件：宿主 Node 进程的 PATH 未必包含 Homebrew 路径，
// 用常见绝对路径候选 + PATH 扫描兜底；找不到则安装返回可读错误。
const DSH_CANDIDATES = [
  "/opt/homebrew/bin/dsh",
  "/usr/local/bin/dsh",
  "/usr/bin/dsh",
  "/bin/dsh",
];

function findDsh() {
  for (const candidate of DSH_CANDIDATES) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  const pathParts = (process.env.PATH || "").split(":").filter(Boolean);
  for (const dir of pathParts) {
    const candidate = dir.replace(/\/+$/, "") + "/dsh";
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return "dsh";
}

function runDshInstall(spec) {
  return new Promise((resolve) => {
    const dshBin = findDsh();
    const args = ["plugin", "--profile", ACTIVE_PROFILE, "add", spec.package];
    execFile(dshBin, args, {
      timeout: INSTALL_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: "1" },
    }, (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      resolve({
        ok: code === 0,
        code,
        summary: trimOutput(code === 0 ? stdout : stderr),
        error: code === 0 ? null : (error?.message || "安装失败").slice(0, 200),
      });
    });
  });
}

function trimOutput(raw) {
  if (!raw) return "";
  const lines = String(raw).split("\n").map((l) => l.trim()).filter(Boolean);
  const tail = lines.slice(-6).join("\n");
  return tail.length > 600 ? tail.slice(-600) : tail;
}

/* ─────────────── Hub 只读代理 ─────────────── */

function hexEscape(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=% ]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

async function proxyHub(req, res, url) {
  const upstream = HUB_BASE + url.pathname + url.search;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  let hubRes;
  try {
    hubRes = await fetch(upstream, {
      method: "GET",
      headers: req.headers["if-none-match"] ? { "If-None-Match": String(req.headers["if-none-match"]) } : {},
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: { code: "hub_unavailable", message: "市场服务暂不可达" } }));
    return;
  }
  clearTimeout(timer);
  const body = Buffer.from(await hubRes.arrayBuffer());
  const headers = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" };
  const etag = hubRes.headers.get("etag");
  if (etag) headers["ETag"] = etag;
  res.writeHead(hubRes.status, headers);
  res.end(body);
}

/* ─────────────── HTTP 服务 ─────────────── */

function jsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

export function apply(ctx) {
  let server;
  try {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${BASE_PORT}`);
      const origin = req.headers.origin;
      const cors = origin
        ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, If-None-Match" }
        : { "Access-Control-Allow-Origin": "*" };

      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...cors });
        res.end(JSON.stringify({ ok: true, plugin: "dsh-plugin-market", hub: HUB_BASE, profile: ACTIVE_PROFILE }));
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/v1/")) {
        return proxyHub(req, res, url);
      }

      if (req.method === "POST" && url.pathname === "/install") {
        const body = await jsonBody(req);
        const check = validateInstallSpec(body);
        if (!check.ok) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...cors });
          res.end(JSON.stringify({ ok: false, error: check.error }));
          return;
        }
        ctx.logger?.info?.("[%s] install requested: %s (kind=%s)", SHORT, check.spec.package, check.spec.kind);
        const result = await runDshInstall(check.spec);
        ctx.logger?.info?.("[%s] install finished: ok=%s code=%s", SHORT, result.ok, result.code);
        res.writeHead(result.ok ? 200 : 502, { "Content-Type": "application/json; charset=utf-8", ...cors });
        res.end(JSON.stringify({ ok: result.ok, code: result.code, summary: result.summary, error: result.error }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...cors });
      res.end(JSON.stringify({ error: { code: "not_found" } }));
    });

    // loopback only；从 BASE_PORT 起尝试递增端口
    server.on("error", () => { /* 端口被占时由 listen 错误处理 */ });
    server.listen(BASE_PORT, "127.0.0.1");
  } catch (e) {
    ctx.logger?.warn?.("[%s] loopback server 启动失败: %s", SHORT, String(e));
    server = null;
  }

  ctx.effect(() => {
    if (!server) return;
    // 端口被占时递增重试
    let tries = 0;
    server.on("error", (e) => {
      if (e.code === "EADDRINUSE" && tries < MAX_PORT_TRY) {
        tries += 1;
        try {
          server.close();
        } catch {}
        server.listen(BASE_PORT + tries, "127.0.0.1");
      } else {
        ctx.logger?.warn?.("[%s] loopback server error: %s", SHORT, String(e));
      }
    });
    server.on("listening", () => {
      const addr = server.address();
      ctx.logger?.info?.("[%s] loopback API 就绪: http://127.0.0.1:%s", SHORT, addr && addr.port);
    });
  });

  ctx.effect(() => () => {
    try {
      server?.close();
    } catch {}
  }, "dsh-plugin-market: loopback server dispose");

  ctx.logger?.info?.("[%s] host half ready (hub=%s, profile=%s)", SHORT, HUB_BASE, ACTIVE_PROFILE);
}

export const Config = null;