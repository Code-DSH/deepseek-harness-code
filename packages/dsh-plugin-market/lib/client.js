// dsh-plugin-market — client half（Web bundle）。
//
// 市场页（设置 → 插件市场，settings.section id=plugin-market）：
//   - 数据：优先直连 DSHC-Hub（127.0.0.1:8741），受 CSP 拦截时自动降级到
//     host loopback 代理（127.0.0.1:8742，lib/index.js）；两者皆不可达时
//     显示「市场暂时不可用 + 重试」，不影响 Harness 其他功能。
//   - GitHub 外链：二次校验 https://github.com/... 后 window.open 系统浏览器。
//   - 安装（A2 冻结自动安装）：详情页展示结构化规格 + 风险提示 → 用户明确确认
//     → POST 到 host 窄权限 /install（host 校验后调官方 dsh plugin CLI）；
//     host 通道不可达时降级为「复制官方安装命令」（package 经白名单校验后才
//     进入命令文本）。绝不执行 Hub 返回的任何 command/script 字段。
//   - 中英双语（navigator.language），只操作自己注册的 slot 与自己的 DOM。
window.__ModuleLoader__.load({
  id: "@dsh-external/deepseek-harness-plugin-market",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;

    const inject = ["slots"];

    // 生产 Hub：远程服务器；受 CSP 拦截时自动降级 host 代理（HUB_HOST）。
    const HUB_DIRECT = "http://38.76.196.236:8741";
    const HUB_HOST = "http://127.0.0.1:8742";
    const SCHEMA_VERSION = "1";
    const PAGE_SIZE = 24;

    const ZH = typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "");
    const T = {
      nav: ZH ? "插件市场" : "Plugin market",
      tagline: ZH
        ? "浏览、查看和获取 DSH 插件（DSHC-Hub）"
        : "Browse, inspect and install DSH plugins (DSHC-Hub)",
      submit: ZH ? "提交插件" : "Submit a plugin",
      sources: ZH ? "插件来源" : "Sources",
      searchPlaceholder: ZH ? "搜索插件名称、作者或描述…" : "Search by name, author or description…",
      allCats: ZH ? "全部" : "All",
      sort: ZH ? "排序" : "Sort",
      sortFeatured: ZH ? "推荐" : "Featured",
      sortUpdated: ZH ? "最近更新" : "Recently updated",
      sortName: ZH ? "名称" : "Name",
      sortRelevance: ZH ? "相关度" : "Relevance",
      loadMore: ZH ? "加载更多" : "Load more",
      details: ZH ? "查看详情" : "Details",
      github: ZH ? "打开 GitHub" : "Open GitHub",
      install: ZH ? "安装" : "Install",
      back: ZH ? "返回列表" : "Back to list",
      version: ZH ? "版本" : "Version",
      author: ZH ? "作者" : "Author",
      license: ZH ? "License" : "License",
      source: ZH ? "来源" : "Source",
      synced: ZH ? "最后同步" : "Last synced",
      verified: ZH ? "已审核" : "Verified",
      officialBadge: ZH ? "官方" : "Official",
      communityBadge: ZH ? "社区" : "Community",
      repoPath: ZH ? "源码位置" : "Source location",
      readme: ZH ? "说明" : "About",
      noResults: ZH ? "没有匹配的插件，换个关键词试试" : "No matching plugins — try another query",
      emptyMarket: ZH ? "市场暂无条目" : "The market has no entries yet",
      rateLimited: ZH ? "请求过于频繁，请稍后重试" : "Too many requests — please retry later",
      unavailable: ZH ? "市场暂时不可用" : "Market temporarily unavailable",
      retry: ZH ? "重试" : "Retry",
      notFound: ZH ? "插件不存在或已下架" : "Plugin not found or removed",
      readmeUnavailable: ZH ? "该仓库没有 README 或暂不可读" : "No README available for this repository",
      schemaMismatch: ZH ? "市场 API 版本不兼容" : "Market API version mismatch",
      riskTitle: ZH ? "安装前请阅读" : "Before you install",
      riskBody: ZH
        ? "DSHC-Hub 不托管插件源码。安装前请查看 GitHub 仓库、license 与下列结构化安装规格；插件由官方 dsh plugin 流程安装（向当前 profile 添加包）。"
        : "DSHC-Hub does not host plugin source. Review the GitHub repository, license and the structured install spec below; installation runs through the official dsh plugin flow (adds the package to the active profile).",
      specTitle: ZH ? "结构化安装规格" : "Structured install spec",
      confirmInstall: ZH ? "确认安装" : "Confirm install",
      cancel: ZH ? "取消" : "Cancel",
      installing: ZH ? "正在安装…（官方 dsh plugin）" : "Installing… (official dsh plugin)",
      installDone: ZH ? "安装完成" : "Install complete",
      installDoneHint: ZH
        ? "插件已加入当前 profile。重启 Harness 后生效；或到 设置 → 插件 查看。"
        : "The plugin was added to the active profile. Restart Harness to activate; or check Settings → Plugins.",
      installFailed: ZH ? "安装失败" : "Install failed",
      hostUnreachable: ZH ? "未能连接本机安装通道" : "Local install bridge unreachable",
      copyCmd: ZH ? "复制官方安装命令" : "Copy official install command",
      cmdCopied: ZH ? "已复制到剪贴板 — 在终端粘贴执行" : "Copied — paste into your terminal",
      cmdHint: ZH ? "在终端执行以下命令即可完成安装（当前 profile: web）：" : "Run the command below in a terminal to install (profile: web):",
      githubBlocked: ZH ? "浏览器拦截了弹窗 — 可复制链接：《" : "Popup blocked — copy the link instead: ",
      githubVerifyFail: ZH ? "链接校验未通过，已阻止打开" : "Link failed verification; not opened",
      loading: ZH ? "加载中…" : "Loading…",
      detailLoading: ZH ? "加载详情…" : "Loading details…",
      noInstallSpec: ZH ? "该插件暂无可安装的安装规格" : "No install spec available for this plugin",
      statusHub: ZH ? "Hub 直连" : "Direct",
      statusProxy: ZH ? "经本机代理" : "via local bridge",
      statusOffline: ZH ? "离线" : "offline",
      notProvided: ZH ? "未提供" : "Not provided",
    };

    const CSS = `
[data-dshc-mk-root] { --dshc-mk-accent: var(--dsw-alias-state-business-primary, #4176e6); }
[data-dshc-mk-root] { display: flex; flex-direction: column; gap: 14px; padding: 4px 2px 20px; font-size: 13px; line-height: 1.55; }
.dshc-mk-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.dshc-mk-title { font-size: 16px; font-weight: 650; margin: 0; }
.dshc-mk-tag { font-size: 12px; opacity: .62; }
.dshc-mk-status { margin-left: auto; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--dsw-border, rgba(0,0,0,.12)); }
.dshc-mk-status[data-st="ok"] { color: #1f7a3d; }
.dshc-mk-status[data-st="err"] { color: #a15c00; }
.dshc-mk-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.dshc-mk-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dshc-mk-search { flex: 1 1 220px; min-width: 180px; padding: 6px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--dsw-border, rgba(0,0,0,.16)); background: var(--dsw-surface, transparent); color: inherit; }
.dshc-mk-search:focus { outline: 2px solid var(--dshc-mk-accent); outline-offset: 0; border-color: transparent; }
.dshc-mk-select { padding: 5px 10px; font-size: 12px; border-radius: 8px; border: 1px solid var(--dsw-border, rgba(0,0,0,.16)); background: var(--dsw-surface, transparent); color: inherit; }
.dshc-mk-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.dshc-mk-chip { padding: 3px 11px; font-size: 12px; border-radius: 999px; border: 1px solid var(--dsw-border, rgba(0,0,0,.16)); background: transparent; color: inherit; cursor: pointer; }
.dshc-mk-chip[data-on="true"] { background: color-mix(in srgb, var(--dshc-mk-accent) 14%, transparent); border-color: color-mix(in srgb, var(--dshc-mk-accent) 45%, transparent); color: var(--dshc-mk-accent); font-weight: 600; }
.dshc-mk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.dshc-mk-card { display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; border: 1px solid var(--dsw-border, rgba(0,0,0,.12)); border-radius: 12px; background: var(--dsw-surface, transparent); }
.dshc-mk-card-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dshc-mk-name { font-size: 14px; font-weight: 650; margin: 0; }
.dshc-mk-badge { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--dsw-border, rgba(0,0,0,.14)); opacity: .85; }
.dshc-mk-badge[data-off="true"] { color: var(--dshc-mk-accent); border-color: color-mix(in srgb, var(--dshc-mk-accent) 40%, transparent); }
.dshc-mk-ver { font-size: 11px; opacity: .6; }
.dshc-mk-desc { font-size: 12.5px; opacity: .8; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dshc-mk-actions { display: flex; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
.dshc-mk-btn { padding: 4px 13px; font-size: 12px; font-weight: 550; border-radius: 8px; border: 1px solid var(--dsw-border, rgba(0,0,0,.16)); background: var(--dsw-surface, transparent); color: inherit; cursor: pointer; }
.dshc-mk-btn:hover:not(:disabled) { border-color: var(--dshc-mk-accent); color: var(--dshc-mk-accent); }
.dshc-mk-btn-primary { background: var(--dshc-mk-accent); border-color: transparent; color: #fff; }
.dshc-mk-btn-primary:hover:not(:disabled) { color: #fff; opacity: .9; }
.dshc-mk-btn:disabled { opacity: .5; cursor: default; }
.dshc-mk-state { padding: 18px 0; text-align: center; opacity: .72; font-size: 13px; }
.dshc-mk-state-err { color: #a15c00; }
.dshc-mk-more { align-self: center; }
.dshc-mk-detail { display: flex; flex-direction: column; gap: 14px; max-width: 680px; }
.dshc-mk-detail-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.dshc-mk-detail h2 { font-size: 18px; margin: 0; }
.dshc-mk-kv { display: grid; grid-template-columns: 96px 1fr; gap: 5px 10px; font-size: 12.5px; }
.dshc-mk-kv dt { opacity: .6; }
.dshc-mk-kv dd { margin: 0; word-break: break-all; }
.dshc-mk-box { border: 1px solid var(--dsw-border, rgba(0,0,0,.12)); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.dshc-mk-box-warn { border-color: color-mix(in srgb, var(--dsw-warning, #a15c00) 45%, transparent); background: color-mix(in srgb, var(--dsw-warning, #a15c00) 7%, transparent); }
.dshc-mk-install-spec { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; background: rgba(0,0,0,.05); border-radius: 8px; padding: 9px 11px; white-space: pre-wrap; word-break: break-all; }
[data-ds-dark-theme] .dshc-mk-install-spec { background: rgba(255,255,255,.07); }
.dshc-mk-cmd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; background: rgba(0,0,0,.05); border-radius: 8px; padding: 9px 11px; word-break: break-all; user-select: all; }
.dshc-mk-readme { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; max-height: 420px; overflow: auto; margin: 0; background: rgba(0,0,0,.045); border-radius: 8px; padding: 10px 12px; }
[data-ds-dark-theme] .dshc-mk-cmd { background: rgba(255,255,255,.07); }
.dshc-mk-foot { border-top: 1px solid var(--dsw-border, rgba(0,0,0,.1)); padding-top: 10px; font-size: 12px; opacity: .75; display: flex; flex-direction: column; gap: 6px; }
.dshc-mk-link { color: var(--dshc-mk-accent); cursor: pointer; text-decoration: none; }
.dshc-mk-link:hover { text-decoration: underline; }
@media (prefers-reduced-motion: reduce) { [data-dshc-mk-root] * { transition: none !important; animation: none !important; } }
`;

    /* ─────────────── API client（直连 → host 代理降级） ─────────────── */

    function MarketUnavailableError(message) {
      const e = new Error(message);
      e.kind = "unavailable";
      return e;
    }
    function RateLimitedError(message) {
      const e = new Error(message);
      e.kind = "rate";
      return e;
    }

    async function fetchJson(url, init, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}
        return { status: res.status, json, etag: res.headers.get("etag") };
      } finally {
        clearTimeout(timer);
      }
    }

    // 主请求：直连 Hub → 失败降级 host 代理 → 都失败抛分类错误
    async function apiRequest(path, init) {
      let lastErr = null;
      for (const base of [HUB_DIRECT, HUB_HOST]) {
        try {
          const { status, json } = await fetchJson(base + path, init);
          if (status === 304) throw MarketUnavailableError(T.unavailable); // 无本地缓存：304 视为不可用
          if (status === 429) throw RateLimitedError(T.rateLimited);
          if (status >= 500) throw MarketUnavailableError(T.unavailable);
          if (status === 404) throw Object.assign(new Error(T.notFound), { kind: "notfound" });
          if (json && json.error) {
            const code = json.error.code;
            if (code === "schema_mismatch") throw Object.assign(new Error(T.schemaMismatch), { kind: "schema" });
            if (status === 429) throw RateLimitedError(T.rateLimited);
            throw MarketUnavailableError(T.unavailable);
          }
          if (json && json.schemaVersion && json.schemaVersion !== SCHEMA_VERSION) {
            throw Object.assign(new Error(T.schemaMismatch), { kind: "schema" });
          }
          return json;
        } catch (e) {
          if (e && (e.kind === "rate" || e.kind === "notfound" || e.kind === "schema")) throw e;
          lastErr = e;
        }
      }
      throw lastErr || MarketUnavailableError(T.unavailable);
    }

    async function apiList(input) {
      const params = new URLSearchParams();
      if (input.query) params.set("q", input.query);
      if (input.category) params.set("category", input.category);
      if (input.source) params.set("source", input.source);
      if (input.sort) params.set("sort", input.sort);
      if (input.cursor) params.set("cursor", input.cursor);
      params.set("limit", String(Math.min(100, Math.max(1, input.limit || PAGE_SIZE))));
      return apiRequest("/api/v1/plugins?" + params.toString());
    }

    /* ─────────────── GitHub 二次校验（§8.1） ─────────────── */

    function isVerifiedGithubUrl(raw) {
      if (typeof raw !== "string" || raw.length > 1024) return false;
      let url;
      try {
        url = new URL(raw);
      } catch {
        return false;
      }
      if (url.protocol !== "https:") return false;
      if (url.hostname !== "github.com") return false;
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return false;
      if (!/^[A-Za-z0-9_.-]+$/.test(segments[0]) || !/^[A-Za-z0-9_.-]+$/.test(segments[1])) return false;
      return true;
    }

    function openGithub(raw) {
      if (!isVerifiedGithubUrl(raw)) return { ok: false, blocked: false };
      const win = window.open(raw, "_blank", "noopener,noreferrer");
      return { ok: true, blocked: win === null };
    }

    /* ─────────────── 安装（§8.2/8.3） ─────────────── */

    const PKG_DIR_RE = /^\/[^\0\n\r\t|&;<>'"`$(){}\[\]]{1,400}$/;
    const PKG_NAME_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]{0,120}$/i;
    const GIT_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;

    function buildInstallCommand(spec) {
      const pkg = spec && typeof spec.package === "string" ? spec.package : "";
      if (!(PKG_DIR_RE.test(pkg) || PKG_NAME_RE.test(pkg) || GIT_URL_RE.test(pkg))) return null;
      return `dsh plugin --profile web add "${pkg}"`;
    }

    async function requestInstall(spec) {
      // host 窄权限通道：POST /install，结构化 spec 硬校验在 host 侧
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 130000);
      try {
        const res = await fetch(HUB_HOST + "/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package: spec.package, version: spec.version || "", kind: spec.kind || "local-dir" }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        return { reachable: true, status: res.status, json };
      } catch {
        return { reachable: false, status: 0, json: null };
      } finally {
        clearTimeout(timer);
      }
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    /* ─────────────── 页面组件 ─────────────── */

    function useMarketData() {
      const [status, setStatus] = React.useState("idle"); // idle|ok|err
      const [statusText, setStatusText] = React.useState("");
      const [mode, setMode] = React.useState("direct"); // direct|proxy
      const [cats, setCats] = React.useState([]);
      const [sources, setSources] = React.useState([]);
      const [list, setList] = React.useState({ rows: [], total: 0, next: null });
      const [q, setQ] = React.useState("");
      const [cat, setCat] = React.useState("");
      const [sort, setSort] = React.useState("featured");
      const [loading, setLoading] = React.useState(false);
      const [err, setErr] = React.useState(null);
      const [empty, setEmpty] = React.useState(null); // "noResults" | "emptyMarket"
      const reqSeq = React.useRef(0);

      const load = React.useCallback(async (cursor) => {
        const seq = ++reqSeq.current;
        setLoading(true);
        setErr(null);
        try {
          const res = await apiList({ query: q, category: cat, sort, cursor });
          if (seq !== reqSeq.current) return;
          setStatus("ok");
          setMode(res.viaHost ? "proxy" : "direct");
          setList((prev) => ({
            rows: cursor ? prev.rows.concat(res.data || []) : res.data || [],
            total: typeof res.total === "number" ? res.total : 0,
            next: res.nextCursor || null,
          }));
          const rows = cursor ? null : res.data || [];
          if (rows !== null) {
            setEmpty(rows.length === 0 ? (res.total === 0 ? "emptyMarket" : "noResults") : null);
          }
        } catch (e) {
          if (seq !== reqSeq.current) return;
          setStatus("err");
          setErr(e && e.message ? e.message : T.unavailable);
        } finally {
          if (seq === reqSeq.current) setLoading(false);
        }
      }, [q, cat, sort]);

      const loadMeta = React.useCallback(async () => {
        try {
          const [c, s] = await Promise.all([
            apiRequest("/api/v1/categories"),
            apiRequest("/api/v1/sources"),
          ]);
          setCats((c && c.data) || []);
          setSources((s && s.data) || []);
        } catch {}
      }, []);

      React.useEffect(() => {
        loadMeta();
        const timer = setTimeout(() => load(), 250);
        return () => clearTimeout(timer);
      }, [load, loadMeta]);

      return {
        status, statusText, setStatusText, mode, cats, sources,
        list, setList, q, setQ, cat, setCat, sort, setSort,
        loading, err, setErr, empty, load, refresh: () => load(),
      };
    }

    function StateBlock({ text, isErr, children }) {
      const cls = "dshc-mk-state" + (isErr ? " dshc-mk-state-err" : "");
      return h(
        "div",
        { className: cls },
        h("div", null, text),
        children || null,
      );
    }

    function MarketList({ m, goDetail }) {
      const rows = m.list.rows;
      const catsById = Object.fromEntries((m.cats || []).map((c) => [c.id, c]));
      const sourcesById = Object.fromEntries((m.sources || []).map((s) => [s.id, s]));
      const catLabel = (id) => {
        const c = catsById[id];
        if (!c) return id;
        return ZH ? c.name : c.nameEn || c.name;
      };
      const srcLabel = (id) => {
        const s = sourcesById[id];
        if (!s) return id;
        return ZH ? s.name : s.nameEn || s.name;
      };

      return h("div", { "data-dshc-mk-root": "" },
        h("div", { className: "dshc-mk-head" },
          h("h3", { className: "dshc-mk-title" }, T.nav),
          h("span", { className: "dshc-mk-tag" }, T.tagline),
          h("span", { className: "dshc-mk-status", "data-st": m.status === "ok" ? "ok" : "err" },
            h("span", { className: "dshc-mk-dot" }),
            m.status === "ok"
              ? (m.mode === "proxy" ? T.statusProxy : T.statusHub)
              : T.statusOffline),
        ),
        h("div", { className: "dshc-mk-tools" },
          h("input", {
            className: "dshc-mk-search",
            type: "search",
            placeholder: T.searchPlaceholder,
            value: m.q,
            onChange: (e) => m.setQ(e.target.value),
          }),
          h("select", {
            className: "dshc-mk-select",
            value: m.sort,
            onChange: (e) => m.setSort(e.target.value),
            "aria-label": T.sort,
          },
            h("option", { value: "featured" }, T.sortFeatured),
            h("option", { value: "updated" }, T.sortUpdated),
            h("option", { value: "name" }, T.sortName),
            m.q ? h("option", { value: "relevance" }, T.sortRelevance) : null,
          ),
        ),
        h("div", { className: "dshc-mk-chips" },
          h("button", {
            className: "dshc-mk-chip",
            "data-on": m.cat === "" ? "true" : "false",
            onClick: () => m.setCat(""),
          }, T.allCats),
          (m.cats || []).map((c) => h("button", {
            key: c.id,
            className: "dshc-mk-chip",
            "data-on": m.cat === c.id ? "true" : "false",
            onClick: () => m.setCat(c.id),
          }, ZH ? c.name : c.nameEn || c.name)),
        ),
        m.loading && rows.length === 0
          ? h(StateBlock, { text: T.loading })
          : null,
        !m.loading && m.err
          ? h(StateBlock, { text: m.err, isErr: true },
              h("button", { className: "dshc-mk-btn", onClick: () => m.refresh() }, T.retry))
          : null,
        !m.loading && !m.err && (m.empty || (rows.length === 0 && m.status === "ok"))
          ? h(StateBlock, { text: m.empty === "noResults" ? T.noResults : T.emptyMarket })
          : null,
        rows.length > 0
          ? h("div", { className: "dshc-mk-grid" },
              rows.map((p) => h("div", { key: p.id, className: "dshc-mk-card" },
                h("div", { className: "dshc-mk-card-row" },
                  h("h4", { className: "dshc-mk-name" }, ZH ? p.name : p.nameEn || p.name),
                  (p.sourceIds || []).map((sid) => h("span", {
                    key: sid,
                    className: "dshc-mk-badge",
                    "data-off": sid === "official" ? "true" : "false",
                  }, sid === "official" ? T.officialBadge : (sid === "github" ? "GitHub" : T.communityBadge))),
                  p.version ? h("span", { className: "dshc-mk-ver" }, "v" + p.version) : null,
                  p.stars ? h("span", { className: "dshc-mk-ver", style: { fontSize: 11 } }, "⭐ " + p.stars) : null,
                ),
                h("p", { className: "dshc-mk-desc" }, ZH ? p.description.zh : p.description.en),
                h("div", { className: "dshc-mk-card-row" },
                  (p.categories || []).map((cid) => h("span", { key: cid, className: "dshc-mk-badge" }, catLabel(cid))),
                  h("span", { className: "dshc-mk-ver" }, srcLabel(p.sourceIds && p.sourceIds[0])),
                ),
                h("div", { className: "dshc-mk-actions" },
                  h("button", { className: "dshc-mk-btn", onClick: () => goDetail(p.id) }, T.details),
                  h("button", {
                    className: "dshc-mk-btn",
                    onClick: () => {
                      const r = openGithub(p.repositoryUrl);
                      if (!r.ok || r.blocked) {
                        if (r.ok && r.blocked) alert(T.githubBlocked + p.repositoryUrl + "》");
                        else alert(T.githubVerifyFail);
                      }
                    },
                  }, T.github),
                ),
              )))
          : null,
        rows.length > 0 && m.list.next
          ? h("button", {
              className: "dshc-mk-btn dshc-mk-more",
              disabled: m.loading,
              onClick: () => m.load(m.list.next),
            }, m.loading ? T.loading : T.loadMore)
          : null,
        h("div", { className: "dshc-mk-foot" },
          h("div", null,
            T.submit + "：",
            h("a", {
              className: "dshc-mk-link",
              onClick: () => {
                const s = (m.sources || []).find((x) => x.id === "official") || (m.sources || [])[0];
                if (s && s.submissionUrl) {
                  const r = openGithub(s.submissionUrl);
                  if (r.ok && r.blocked) alert(T.githubBlocked + s.submissionUrl + "》");
                }
              },
            }, "DSHC-Hub 投稿页"),
          ),
          m.sources && m.sources.length
            ? h("div", null,
                T.sources + "：",
                m.sources.map((s) => h("span", { key: s.id }, ZH ? s.name : s.nameEn || s.name)).reduce((acc, el) => (acc === null ? [el] : [...acc, " / ", el]), null))
            : null,
        ),
      );
    }

    function InstallPanel({ spec, sourceName }) {
      const [phase, setPhase] = React.useState("idle"); // idle|confirm|running|done|failed|copy
      const [result, setResult] = React.useState(null);
      const [cmd, setCmd] = React.useState(null);
      const [copied, setCopied] = React.useState(false);

      if (!spec) {
        return h("div", { className: "dshc-mk-box" },
          h("div", { className: "dshc-mk-kv" },
            h("dt", null, T.install), h("dd", null, T.noInstallSpec)));
      }

      const specText = JSON.stringify(
        { package: spec.package, version: spec.version || "", kind: spec.kind, source: sourceName },
        undefined, 2,
      );

      const run = async () => {
        setPhase("running");
        const r = await requestInstall(spec);
        if (!r.reachable) {
          const c = buildInstallCommand(spec);
          setCmd(c);
          setResult(null);
          setPhase(c ? "copy" : "failed");
          return;
        }
        if (r.json && r.json.ok) {
          setResult({ ok: true, summary: r.json.summary || "" });
          setPhase("done");
        } else {
          setResult({ ok: false, error: (r.json && r.json.error) || T.installFailed, summary: (r.json && r.json.summary) || "" });
          setPhase("failed");
        }
      };

      return h("div", { className: "dshc-mk-box dshc-mk-box-warn" },
        h("strong", null, T.riskTitle),
        h("div", { style: { fontSize: 12.5, opacity: 0.85 } }, T.riskBody),
        h("div", null,
          h("strong", null, T.specTitle),
          h("div", { className: "dshc-mk-install-spec" }, specText),
        ),
        phase === "idle"
          ? h("button", { className: "dshc-mk-btn dshc-mk-btn-primary", onClick: () => setPhase("confirm") }, T.install)
          : null,
        phase === "confirm"
          ? h("div", { className: "dshc-mk-actions" },
              h("button", { className: "dshc-mk-btn dshc-mk-btn-primary", onClick: run }, T.confirmInstall),
              h("button", { className: "dshc-mk-btn", onClick: () => setPhase("idle") }, T.cancel))
          : null,
        phase === "running"
          ? h(StateBlock, { text: T.installing })
          : null,
        phase === "done"
          ? h("div", null,
              h("div", { style: { color: "#1f7a3d", fontWeight: 600 } }, "✓ " + T.installDone),
              h("div", { style: { fontSize: 12, opacity: 0.8 } }, T.installDoneHint),
              result && result.summary ? h("pre", { className: "dshc-mk-install-spec" }, result.summary) : null)
          : null,
        phase === "failed"
          ? h("div", null,
              h("div", { style: { color: "#a15c00", fontWeight: 600 } }, "✗ " + T.installFailed + (result && result.error ? "：" + result.error : "")),
              result && result.summary ? h("pre", { className: "dshc-mk-install-spec" }, result.summary) : null,
              h("div", { className: "dshc-mk-actions" },
                h("button", { className: "dshc-mk-btn", onClick: () => setPhase("idle") }, T.retry),
                h("button", { className: "dshc-mk-btn", onClick: () => setPhase("idle") }, T.cancel)))
          : null,
        phase === "copy"
          ? h("div", null,
              h("div", { style: { fontWeight: 600, color: "#a15c00" } }, "⚠ " + T.hostUnreachable),
              h("div", { style: { fontSize: 12.5, opacity: 0.85 } }, T.cmdHint),
              h("div", { className: "dshc-mk-cmd" }, cmd),
              h("div", { className: "dshc-mk-actions" },
                h("button", {
                  className: "dshc-mk-btn",
                  onClick: async () => {
                    const ok = await copyText(cmd);
                    if (ok) setCopied(true);
                  },
                }, copied ? T.cmdCopied : T.copyCmd)))
          : null,
      );
    }

    function MarketDetail({ m, id, goBack }) {
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [err, setErr] = React.useState(null);
      const [reloadKey, setReloadKey] = React.useState(0);
      const [ghReadme, setGhReadme] = React.useState(null); // { loading, text, via }
      const seq = React.useRef(0);

      React.useEffect(() => {
        const my = ++seq.current;
        setLoading(true);
        setErr(null);
        setData(null);
        setGhReadme(null);
        apiRequest("/api/v1/plugins/" + encodeURIComponent(id))
          .then((res) => {
            if (my !== seq.current) return;
            setData(res && res.data ? res.data : null);
          })
          .catch((e) => {
            if (my !== seq.current) return;
            setErr(e && e.message ? e.message : T.unavailable);
          })
          .finally(() => {
            if (my === seq.current) setLoading(false);
          });
      }, [id, reloadKey]);

      // GitHub 插件 README：用户本地直读 GitHub（首选）→ 服务器转发（CSP/网络兜底）
      React.useEffect(() => {
        if (!data || !data.readmeUrl) return;
        let cancelled = false;
        setGhReadme({ loading: true, text: null, via: null });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        fetch(data.readmeUrl, { signal: controller.signal })
          .then((res) => (res.ok ? res.text() : Promise.reject(new Error("http " + res.status))))
          .then((text) => {
            if (!cancelled) setGhReadme({ loading: false, text, via: "github" });
          })
          .catch(() => {
            // 服务器转发通道：/api/v1/plugins/{id}/readme（内存缓存，不落盘）
            return apiRequest("/api/v1/plugins/" + encodeURIComponent(id) + "/readme")
              .then((res) => {
                if (cancelled) return;
                const d = res && res.data;
                setGhReadme({ loading: false, text: d ? d.text : null, via: "server" });
              })
              .catch(() => {
                if (!cancelled) setGhReadme({ loading: false, text: null, via: "unavailable" });
              });
          })
          .finally(() => clearTimeout(timer));
        return () => {
          cancelled = true;
          clearTimeout(timer);
          controller.abort();
        };
      }, [data]);

      const sourcesById = Object.fromEntries((m.sources || []).map((s) => [s.id, s]));
      const catsById = Object.fromEntries((m.cats || []).map((c) => [c.id, c]));
      const catLabel = (cid) => {
        const c = catsById[cid];
        return c ? (ZH ? c.name : c.nameEn || c.name) : cid;
      };
      const src = data ? sourcesById[data.sourceIds && data.sourceIds[0]] : undefined;
      const fmtDate = (iso) => {
        try {
          return iso ? new Date(iso).toLocaleString(ZH ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : T.notProvided;
        } catch {
          return T.notProvided;
        }
      };

      return h("div", { "data-dshc-mk-root": "" },
        h("div", { className: "dshc-mk-head" },
          h("button", { className: "dshc-mk-btn", onClick: goBack }, "← " + T.back),
        ),
        loading
          ? h(StateBlock, { text: T.detailLoading })
          : null,
        !loading && err
          ? h(StateBlock, { text: err, isErr: true },
              h("button", { className: "dshc-mk-btn", onClick: () => setReloadKey((k) => k + 1) }, T.retry))
          : null,
        !loading && !err && data
          ? h("div", { className: "dshc-mk-detail" },
              h("div", { className: "dshc-mk-detail-head" },
                h("h2", null, ZH ? data.name : data.nameEn || data.name),
                (data.sourceIds || []).map((sid) => h("span", {
                  key: sid,
                  className: "dshc-mk-badge",
                  "data-off": sid === "official" ? "true" : "false",
                }, sid === "official" ? T.officialBadge : (sid === "github" ? "GitHub" : T.communityBadge))),
                data.stars ? h("span", { className: "dshc-mk-badge" }, "⭐ " + data.stars) : null,
                data.verified ? h("span", { className: "dshc-mk-badge" }, "✓ " + T.verified) : null,
              ),
              h("dl", { className: "dshc-mk-kv" },
                h("dt", null, T.author), h("dd", null, data.authorName || T.notProvided),
                h("dt", null, T.version), h("dd", null, data.version || T.notProvided),
                h("dt", null, T.license), h("dd", null, data.license || T.notProvided),
                h("dt", null, T.source), h("dd", null, (src ? (ZH ? src.name : src.nameEn || src.name) : T.notProvided) + (src && src.lastSyncedAt ? "（" + T.synced + " " + fmtDate(src.lastSyncedAt) + "）" : "")),
                h("dt", null, T.repoPath), h("dd", null, data.repoPath || T.notProvided),
                h("dt", null, T.categories), h("dd", null, (data.categories || []).map(catLabel).join(" / ") || T.notProvided),
              ),
              data.readme
                ? h("div", { className: "dshc-mk-box" },
                    h("strong", null, T.readme),
                    h("div", { style: { fontSize: 12.5, opacity: 0.85 } }, ZH ? data.readme.zh : data.readme.en))
                : null,
              ghReadme && ghReadme.loading
                ? h("div", { className: "dshc-mk-box" },
                    h("strong", null, T.readme), h(StateBlock, { text: T.detailLoading }))
                : null,
              ghReadme && !ghReadme.loading && ghReadme.text
                ? h("div", { className: "dshc-mk-box" },
                    h("strong", null, T.readme),
                    h("div", { style: { fontSize: 11, opacity: 0.55, marginBottom: 4 } },
                      ghReadme.via === "github" ? "GitHub README（本地直读）" : "GitHub README（服务器转发，内存缓存不落盘）"),
                    h("pre", {
                      className: "dshc-mk-readme",
                      // README 原文以文本渲染，绝不注入 HTML
                    }, ghReadme.text))
                : null,
              ghReadme && !ghReadme.loading && !ghReadme.text
                ? h("div", { className: "dshc-mk-box" },
                    h("strong", null, T.readme),
                    h("div", { style: { fontSize: 12.5, opacity: 0.7 } }, T.readmeUnavailable))
                : null,
              h("dl", { className: "dshc-mk-kv" },
                h("dt", null, T.github),
                h("dd", null,
                  h("a", {
                    className: "dshc-mk-link",
                    onClick: () => {
                      const r = openGithub(data.repositoryUrl);
                      if (r.ok && r.blocked) alert(T.githubBlocked + data.repositoryUrl + "》");
                      if (!r.ok) alert(T.githubVerifyFail);
                    },
                  }, data.repositoryUrl)),
              ),
              h(InstallPanel, { spec: data.installSpec, sourceName: src ? (ZH ? src.name : src.nameEn || src.name) : T.notProvided }),
            )
          : null,
      );
    }

    function MarketPage() {
      const m = useMarketData();
      const [view, setView] = React.useState("list");
      const [detailId, setDetailId] = React.useState(null);

      const goDetail = (id) => {
        setDetailId(id);
        setView("detail");
      };
      const goBack = () => {
        setView("list");
        setDetailId(null);
        m.refresh();
      };

      if (view === "detail" && detailId) {
        return h(MarketDetail, { m, id: detailId, goBack });
      }
      return h(MarketList, { m, goDetail });
    }

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      ctx.effect(() => {
        const styles = ctx.get("styles");
        if (styles && typeof styles.insert === "function") {
          return styles.insert(CSS);
        }
        const style = document.createElement("style");
        style.setAttribute("data-dshc-mk-style", "");
        style.textContent = CSS;
        document.head.appendChild(style);
        return () => {
          try {
            style.remove();
          } catch {}
        };
      }, "dsh-plugin-market: styles");

      ctx.effect(() => ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "plugin-market",
          order: 62,
          label: () => T.nav,
        }, MarketPage),
      ), "dsh-plugin-market: settings section");
    }

    module.exports = { apply, inject, name: "@dsh-external/deepseek-harness-plugin-market" };
    return module.exports;
  },
});