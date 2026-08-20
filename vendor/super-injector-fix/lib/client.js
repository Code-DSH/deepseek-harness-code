window.__ModuleLoader__.load({
  id: "@dsh-external/dsh-super-injector",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    //#region \0rolldown/runtime.js
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __copyProps = (to, from, except, desc) => {
      if ((from && typeof from === "object") || typeof from === "function")
        for (
          var keys = __getOwnPropNames(from), i = 0, n = keys.length, key;
          i < n;
          i++
        ) {
          key = keys[i];
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, {
              get: ((k) => from[k]).bind(null, key),
              enumerable:
                !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
            });
        }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (
      (target = mod != null ? __create(__getProtoOf(mod)) : {}),
      __copyProps(
        isNodeMode ||
          !mod ||
          !mod.__esModule ||
          !__hasOwnProp.call(mod, "default")
          ? __defProp(target, "default", {
              value: mod,
              enumerable: true,
            })
          : target,
        mod,
      )
    );
    //#endregion
    let react = require("react");
    react = __toESM(react, 1);
    //#region src/client/index.ts
    /**
     * dsh-super-injector 插件管理 UI（settings.section 页面）。
     * 功能：已注入插件列表 + 一键卸载 + 添加（路径输入/拖放提示）——
     *   - 直接注入：目录已是插件包（package.json + lib/）→ 立即注入
     *   - 内化：任意文件夹 → 新建 agent 会话 → AI 把内容变成插件
     * 通信：同源 fetch → host webServer API（/super-injector/api）
     *
     * 修复说明（rc.6 slot API）：`slots.register(options, component)` 的
     * component 是「第二个位置参数」，且必须是一个返回 React 节点的函数组件。
     * 旧实现把 `component: () => ({ render() {...} })` 塞进 options 里——
     * 该字段被 register 忽略 → entry.component === undefined → 渲染边界抛错 →
     * entry 被弃权（active:false）→ 设置页右侧空白。这里改为传入真正的
     * React 函数组件。
     */
    const inject = ["slots"];
    const API = "/super-injector/api";
    const styles = `
.spi-page{font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;padding:14px 16px;max-width:720px;display:flex;flex-direction:column;gap:12px}
.spi-page h3{margin:0;font-size:13px}
.spi-stats{color:var(--theme-text-secondary,#888);font-size:11px;margin:0}
.spi-add{border:1.5px dashed var(--theme-border,#555);border-radius:8px;padding:12px;text-align:center;color:var(--theme-text-secondary,#999)}
.spi-add.drag{border-color:var(--theme-accent,#4a9eff);background:rgba(74,158,255,.08)}
.spi-row{display:flex;gap:6px;margin-top:10px}
.spi-input{flex:1;background:var(--theme-input-bg,#111);color:var(--theme-text,#ddd);border:1px solid var(--theme-border,#333);border-radius:6px;padding:6px 8px;font-size:12px;min-width:0}
.spi-btn{background:var(--theme-accent,#4a9eff);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;white-space:nowrap}
.spi-btn.ghost{background:transparent;border:1px solid var(--theme-border,#444);color:var(--theme-text,#ccc)}
.spi-btn.danger{background:transparent;border:1px solid #d33;color:#d33}
.spi-btn:disabled{opacity:.45;cursor:not-allowed}
.spi-list{list-style:none;margin:0;padding:0}
.spi-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--theme-border,#333);border-radius:8px;margin-bottom:6px}
.spi-item .name{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi-item .dir{color:var(--theme-text-secondary,#888);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.spi-item .st{font-size:10px;padding:2px 6px;border-radius:10px}
.spi-item .st.on{background:rgba(46,204,113,.15);color:#2ecc71}
.spi-item .st.off{background:rgba(255,193,7,.12);color:#f1c40f}
.spi-msg{margin:0;padding:8px 10px;border-radius:6px;background:var(--theme-input-bg,#111);border:1px solid var(--theme-border,#333);white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px}
.spi-msg.err{border-color:#d33}
.spi-note{color:var(--theme-text-secondary,#888);font-size:11px;margin:0}
.spi-catalog{display:flex;flex-direction:column;gap:6px}
.spi-cat-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--theme-border,#333);border-radius:8px;margin-bottom:6px}
.spi-cat-item .name{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spi-cat-item .desc{color:var(--theme-text-secondary,#888);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
`;
    function fetchJson(path, init) {
      return fetch(API + path, {
        headers: { "content-type": "application/json" },
        ...init,
      }).then((r) => r.json());
    }
    function SuperInjectorPage() {
      const [state, setState] = react.default.useState({
        status: "loading",
        entries: [],
        stats: null,
        msg: "",
        error: false,
      });
      const [dir, setDir] = react.default.useState("");
      const [busy, setBusy] = react.default.useState(false);
      const [catalog, setCatalog] = react.default.useState([]);
      const refresh = react.default.useCallback(() => {
        fetchJson("/list")
          .then((d) => {
            if (!d?.ok) {
              setState((s) => ({
                ...s,
                status: "ready",
                msg: JSON.stringify(d),
                error: true,
              }));
              return;
            }
            setState({
              status: "ready",
              entries: d.entries ?? [],
              stats: d.stats ?? null,
              msg: "",
              error: false,
            });
          })
          .catch((err) =>
            setState((s) => ({
              ...s,
              status: "ready",
              msg: "加载失败: " + err,
              error: true,
            })),
          );
      }, []);
      react.default.useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 6e4);
        return () => window.clearInterval(timer);
      }, [refresh]);
      react.default.useEffect(() => {
        var bridge = window.deepseekDesktop;
        if (
          bridge &&
          bridge.bundledPlugins &&
          typeof bridge.bundledPlugins.list === "function"
        ) {
          bridge.bundledPlugins
            .list()
            .then((items) => setCatalog(items || []))
            .catch(() => {});
        }
      }, []);
      const say = (text, isErr = false) =>
        setState((s) => ({
          ...s,
          msg: text,
          error: isErr,
        }));
      const uninstall = (name) => {
        say("卸载中: " + name);
        fetchJson("/uninstall", {
          method: "POST",
          body: JSON.stringify({ match: name }),
        })
          .then((r) => {
            say(
              r?.result !== void 0 ? String(r.result) : JSON.stringify(r),
              !r?.ok,
            );
            if (r?.ok) window.setTimeout(refresh, 600);
          })
          .catch((err) => say("卸载请求失败: " + err, true));
      };
      const installBundled = (item) => {
        say("安装中: " + item.name);
        fetchJson("/inject", {
          method: "POST",
          body: JSON.stringify({ dir: item.dir, title: item.name }),
        })
          .then((r) => {
            say(
              r?.result !== void 0 ? String(r.result) : JSON.stringify(r),
              !r?.ok,
            );
            if (r?.ok) window.setTimeout(refresh, 1200);
          })
          .catch((err) => say("安装请求失败: " + err, true));
      };
      const doAction = (path, label) => {
        const value = dir.trim();
        if (!value) {
          say("请先输入文件夹路径", true);
          return;
        }
        setBusy(true);
        fetchJson(path, {
          method: "POST",
          body: JSON.stringify({
            dir: value,
            title: label,
          }),
        })
          .then((r) => {
            say(
              r?.result !== void 0 ? String(r.result) : JSON.stringify(r),
              !r?.ok,
            );
            if (r?.ok) window.setTimeout(refresh, 1200);
          })
          .catch((err) => say("请求失败: " + err, true))
          .finally(() => setBusy(false));
      };
      const s = state.stats;
      const statsText = s
        ? `inject ${s?.inject?.ok ?? 0}✓/${s?.inject?.fail ?? 0}✗ · reload ${s?.reload?.ok ?? 0}✓ · uninject ${s?.uninject?.ok ?? 0}✓/${s?.uninject?.fail ?? 0}✗ · 共 ${state.entries.length} 个注入插件`
        : "正在读取…";
      const rows = state.entries.map((entry) =>
        react.default.createElement(
          "li",
          {
            key: entry.name,
            className: "spi-item",
          },
          react.default.createElement(
            "span",
            { className: "name" },
            String(entry.name),
          ),
          react.default.createElement(
            "span",
            { className: "dir" },
            String(entry.dir),
          ),
          react.default.createElement(
            "span",
            { className: "st " + (entry.active ? "on" : "off") },
            entry.active ? "运行中" : "未激活",
          ),
          react.default.createElement(
            "button",
            {
              type: "button",
              className: "spi-btn danger",
              onClick: () => uninstall(entry.name),
            },
            "卸载",
          ),
        ),
      );
      return react.default.createElement(
        "div",
        { className: "spi-page" },
        react.default.createElement("style", null, styles),
        react.default.createElement(
          "h3",
          null,
          "插件管理（dsh-super-injector）",
        ),
        react.default.createElement("p", { className: "spi-stats" }, statsText),
        react.default.createElement(
          "div",
          { className: "spi-add" },
          "拖入文件夹，或输入路径——「内化」= 新建会话让 AI 把内容变成插件；「注入」= 目录已是插件包直接注入",
          react.default.createElement(
            "div",
            { className: "spi-row" },
            react.default.createElement("input", {
              className: "spi-input",
              placeholder: "D:/path/to/folder",
              value: dir,
              onChange: (e) => setDir(e.currentTarget.value),
            }),
            react.default.createElement(
              "button",
              {
                type: "button",
                className: "spi-btn",
                disabled: busy,
                onClick: () => doAction("/ingest", "内化插件"),
              },
              "内化（AI 造插件）",
            ),
            react.default.createElement(
              "button",
              {
                type: "button",
                className: "spi-btn ghost",
                disabled: busy,
                onClick: () => doAction("/inject", "直接注入"),
              },
              "直接注入",
            ),
          ),
        ),
        catalog.length > 0
          ? react.default.createElement(
              "div",
              { className: "spi-catalog" },
              react.default.createElement("h3", null, "内置插件"),
              catalog.map(function (item) {
                var injected = state.entries.some(function (e) {
                  return e.name === item.name;
                });
                return react.default.createElement(
                  "div",
                  { key: item.name, className: "spi-cat-item" },
                  react.default.createElement(
                    "span",
                    { className: "name" },
                    String(item.name),
                  ),
                  react.default.createElement(
                    "span",
                    { className: "desc" },
                    String(item.description),
                  ),
                  react.default.createElement(
                    "span",
                    { className: "st " + (injected ? "on" : "off") },
                    injected ? "已安装" : "未安装",
                  ),
                  injected
                    ? react.default.createElement(
                        "button",
                        {
                          type: "button",
                          className: "spi-btn danger",
                          onClick: function () {
                            uninstall(item.name);
                          },
                        },
                        "卸载",
                      )
                    : react.default.createElement(
                        "button",
                        {
                          type: "button",
                          className: "spi-btn",
                          onClick: function () {
                            installBundled(item);
                          },
                        },
                        "安装",
                      ),
                );
              }),
            )
          : null,
        state.entries.length === 0
          ? react.default.createElement(
              "p",
              { className: "spi-note" },
              "（暂无注入插件——拖入文件夹或输入路径开始）",
            )
          : react.default.createElement("ul", { className: "spi-list" }, rows),
        state.msg
          ? react.default.createElement(
              "div",
              { className: "spi-msg" + (state.error ? " err" : "") },
              state.msg,
            )
          : null,
      );
    }
    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.slots.inject("settings.section", () =>
            ctx.slots.register(
              {
                name: "settings.section",
                id: "super-injector-plugins",
                order: 50,
                label: () => "插件",
              },
              SuperInjectorPage,
            ),
          ),
        "super-injector: settings page",
      );
    }
    //#endregion
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

//# sourceMappingURL=client.js.map
