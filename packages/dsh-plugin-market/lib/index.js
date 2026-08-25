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
import path from "node:path";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// 生产 Hub：远程服务器（systemd 常驻，ufw 已放行 8741）；
// 开发期可用 DSHC_HUB_BASE 覆盖为本地 mock（http://127.0.0.1:8741）。
const HUB_BASE = process.env.DSHC_HUB_BASE || "http://38.76.196.236:8741";
const SCHEMA_VERSION = "1";
const BASE_PORT = Number(process.env.DSHC_HOST_PORT || 8742);
const MAX_PORT_TRY = 8;
const PROXY_TIMEOUT_MS = 8000;
const INSTALL_TIMEOUT_MS = 120000;
const ACTIVE_PROFILE = process.env.DSHC_PROFILE || "web";

export const name = "@dsh-external/deepseek-harness-plugin-market";
export const inject = [];

const SHORT = "dsh-plugin-market";

// 离线目录兜底：远程 Hub 不可达时改用随包携带的本地种子目录，保证市场页
// 不依赖公网也可浏览/搜索/查看详情（安装仍走同一 host 窄权限通道）。
const OFFLINE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "offline.json");
let OFFLINE = null;
try {
  OFFLINE = JSON.parse(fs.readFileSync(OFFLINE_PATH, "utf8"));
} catch {}

/* ─────────────── 结构化安装规格校验（§8.3） ─────────────── */

const PKG_DIR_RE = /^(\/|[A-Za-z]:[\\/])[^\0\n\r\t|&;<>'"`$(){}\[\]]{1,400}$/;
const NAME_SEG_RE = /[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*/;
const PKG_NAME_RE = new RegExp(`^(@${NAME_SEG_RE.source}\\/)?${NAME_SEG_RE.source}$`);
const GIT_URL_RE = new RegExp(
  `^https:\\/\\/github\\.com\\/${NAME_SEG_RE.source}\\/${NAME_SEG_RE.source}(\\.git)?$`,
);

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

/* ─────────────── 离线目录兜底（Hub 不可达时） ─────────────── */

function offlineSummary(p) {
  return {
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    description: p.description || { zh: "", en: "" },
    authorName: p.authorName,
    categories: p.categories || [],
    version: p.version,
    repositoryUrl: p.repositoryUrl,
    sourceIds: p.sourceIds || [],
    featured: !!p.featured,
    stars: p.stars || null,
  };
}

function offlineDetail(p) {
  const src = (OFFLINE.sources || []).find((s) => s.id === (p.sourceIds || [])[0]);
  return {
    ...offlineSummary(p),
    license: p.license || null,
    verified: !!p.verified,
    verifiedAt: p.verifiedAt || null,
    repoPath: p.repoPath || null,
    readme: p.readme || null,
    readmeUrl: p.readmeUrl || null,
    installSpec: p.installSpec || null,
    lastSyncedAt: src?.lastSyncedAt || null,
  };
}

function offlineDecodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") return 0;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const m = /^offset:(\d+)$/.exec(raw);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function offlineEncodeCursor(offset) {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

function offlineList(url) {
  if (!OFFLINE) return null;
  const qs = Object.fromEntries(url.searchParams.entries());
  const { q = "", category = "", source = "", sort = "featured", cursor = "", limit = "24" } = qs;
  const limitN = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 24));
  const offset = offlineDecodeCursor(cursor);
  const query = q.trim().toLowerCase();
  const cats = category.split(",").filter(Boolean);
  const sources = source.split(",").filter(Boolean);

  const rows = (OFFLINE.plugins || []).filter((p) => {
    if (query) {
      const hay = [p.name, p.nameEn, p.authorName, p.description?.zh, p.description?.en]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (cats.length && !cats.every((c) => (p.categories || []).includes(c))) return false;
    if (sources.length && !sources.some((s) => (p.sourceIds || []).includes(s))) return false;
    return true;
  });

  const relevance = new Map();
  rows.forEach((p) => {
    let score = 0;
    if (query) {
      if ((p.name || "").toLowerCase().includes(query)) score += 100;
      if ((p.nameEn || "").toLowerCase().includes(query)) score += 80;
      if ((p.description?.zh || "").toLowerCase().includes(query)) score += 40;
      if ((p.description?.en || "").toLowerCase().includes(query)) score += 30;
      if ((p.authorName || "").toLowerCase().includes(query)) score += 10;
    }
    relevance.set(p.id, score);
  });

  rows.sort((a, b) => {
    switch (sort) {
      case "relevance":
        return (relevance.get(b.id) || 0) - (relevance.get(a.id) || 0) || String(a.name || "").localeCompare(String(b.name || ""));
      case "updated":
        return String(b.verifiedAt || "").localeCompare(String(a.verifiedAt || ""));
      case "name":
        return String(a.name || "").localeCompare(String(b.name || ""));
      case "featured":
      default:
        return Number(b.featured) - Number(a.featured) || (b.stars || 0) - (a.stars || 0) || String(a.name || "").localeCompare(String(b.name || ""));
    }
  });

  const page = rows.slice(offset, offset + limitN);
  return {
    data: page.map(offlineSummary),
    nextCursor: offset + limitN < rows.length ? offlineEncodeCursor(offset + limitN) : null,
    total: rows.length,
    schemaVersion: SCHEMA_VERSION,
  };
}

function offlineSendJson(res, status, body, cors) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    ...cors,
  });
  res.end(payload);
}

function serveOffline(req, res, url, cors) {
  if (!OFFLINE) {
    offlineSendJson(res, 503, { error: { code: "hub_unavailable", message: "市场服务暂不可达" } }, cors);
    return;
  }
  if (url.pathname === "/api/v1/plugins") {
    const body = offlineList(url);
    return body
      ? offlineSendJson(res, 200, body, cors)
      : offlineSendJson(res, 503, { error: { code: "hub_unavailable", message: "市场服务暂不可达" } }, cors);
  }
  if (url.pathname === "/api/v1/categories") {
    return offlineSendJson(res, 200, { data: OFFLINE.categories || [], schemaVersion: SCHEMA_VERSION }, cors);
  }
  if (url.pathname === "/api/v1/sources") {
    return offlineSendJson(res, 200, { data: OFFLINE.sources || [], schemaVersion: SCHEMA_VERSION }, cors);
  }
  const readmeMatch = /^\/api\/v1\/plugins\/([^/]+)\/readme$/.exec(url.pathname);
  if (readmeMatch) {
    let id;
    try {
      id = decodeURIComponent(readmeMatch[1]);
    } catch {
      return offlineSendJson(res, 400, { error: { code: "bad_request" } }, cors);
    }
    const p = (OFFLINE.plugins || []).find((x) => x.id === id);
    if (!p) return offlineSendJson(res, 404, { error: { code: "not_found" } }, cors);
    if (!p.readme) return offlineSendJson(res, 404, { error: { code: "readme_unavailable" } }, cors);
    return offlineSendJson(res, 200, { data: p.readme, schemaVersion: SCHEMA_VERSION }, cors);
  }
  const detailMatch = /^\/api\/v1\/plugins\/([^/]+)$/.exec(url.pathname);
  if (detailMatch) {
    let id;
    try {
      id = decodeURIComponent(detailMatch[1]);
    } catch {
      return offlineSendJson(res, 400, { error: { code: "bad_request" } }, cors);
    }
    const p = (OFFLINE.plugins || []).find((x) => x.id === id);
    if (!p) return offlineSendJson(res, 404, { error: { code: "not_found" } }, cors);
    return offlineSendJson(res, 200, { data: offlineDetail(p), schemaVersion: SCHEMA_VERSION }, cors);
  }
  return offlineSendJson(res, 404, { error: { code: "not_found" } }, cors);
}

/* ─────────────── Hub 只读代理 ─────────────── */

async function proxyHub(req, res, url, cors) {
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
    return serveOffline(req, res, url, cors);
  }
  clearTimeout(timer);
  if (hubRes.status >= 500 || hubRes.status === 304) {
    try { await hubRes.arrayBuffer(); } catch {}
    return serveOffline(req, res, url, cors);
  }
  const body = Buffer.from(await hubRes.arrayBuffer());
  const headers = { "Content-Type": "application/json; charset=utf-8", ...cors };
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
      const rawOrigin = req.headers.origin;
      const rawHost = String(req.headers.host || "");

      // ── 访问控制（C1 review 修复）────────────────────────────
      // Host 必须解析为环回（防伪造 Host / DNS rebinding 绕过）。
      if (!/^(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/.test(rawHost)) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: { code: "bad_host" } }));
        return;
      }
      // Origin 存在时必须是本机环回页面；其它任何网站 Origin → 403 且不带
      // 任何 CORS 头（浏览器因 JSON 请求触发预检，预检 403 直接拦截请求，
      // 恶意站点无法发出安装请求，也无法读取任何响应）。
      let cors = {};
      if (rawOrigin) {
        if (!/^https?:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/.test(rawOrigin)) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: { code: "forbidden" } }));
          return;
        }
        cors = {
          "Access-Control-Allow-Origin": rawOrigin,
          Vary: "Origin",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
        };
      }
      // 无 Origin 请求（curl / 本地进程）在 Host 环回校验通过后放行，
      // 不带 ACAO 头——浏览器场景必有 Origin，此路径不可被网页复用。

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
        return proxyHub(req, res, url, cors);
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