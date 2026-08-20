// dsh-superpowers — 客户端半。
// (Coding) 三态按钮（输入框工具行，权限/访问模式控件右侧）+ 设置 → 常规 一行。
// 状态经官方 settings 服务与宿主双向同步（客户端用官方 Remote API）：
//   读：api.settings.describe({}) → { result: { ok, value: { namespaces, writable } } }
//   写：api.settings.mutate({ ns, ops: [{ op:'set', path:[field], value }] })  ← 官方客户端路径
//   宿主回写 judged/reason；effective 双方各自派生。
// v3：修根因（update→mutate）+ 方块三态（白=关 / 蓝+白勾=开 / 全黑=自动）+ 括注当前状态
//     + 悬浮框承载同步错误（红字模式词置于「同步错误」前，无红色外圈）。
window.__ModuleLoader__.load({
  id: "dsh-superpowers",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    var _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    var Button = _primitives.Button;
    var IconChevronDownOutline14 = _primitives.IconChevronDownOutline14;
    var Menu = _primitives.Menu;

    const NS = "dsh-superpowers";
    const DEFAULTS = { mode: "auto", judged: false, reason: "" };
    const TOOLTIP =
      "Superpowers（重型编码模式）：这是为 Coding 和重型任务开发的专注模式，会让 Agent 更专注地专注于代码和 Coding（编码）。" +
      "自动模式按任务难度判定——高难度（复杂数学 / 复杂多步推理 / 重度编码）自动启用重型模式，并挂载 subagent、workflow 等重型工具；" +
      "点击可强制 开 / 关（再次点击回到自动）。";

    // ── tiny store ────────────────────────────────────────────────
    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        get: () => state,
        set: (next) => {
          state = next;
          for (const fn of listeners) {
            try {
              fn(state);
            } catch (_) {
              /* ignore listener error */
            }
          }
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
    }

    function useStoreState(store) {
      const [state, setState] = React.useState(store.get());
      React.useEffect(() => store.subscribe(setState), [store]);
      return state;
    }

    function findNs(describeValue) {
      const list = Array.isArray(describeValue)
        ? describeValue
        : describeValue && Array.isArray(describeValue.namespaces)
          ? describeValue.namespaces
          : [];
      return list.find((d) => d && d.ns === NS);
    }

    function createModel(api) {
      const store = createStore({
        status: "loading",
        ...DEFAULTS,
        error: undefined,
      });
      // 写代次守卫：异步 load 不得覆盖更新写的乐观状态
      let writeGen = 0;

      async function load() {
        const gen = writeGen;
        try {
          const response = await api.settings.describe({});
          const result = response && response.result;
          if (!result || !result.ok)
            throw new Error("settings describe failed");
          const ours = findNs(result.value);
          const value = (ours && ours.value) || {};
          if (gen !== writeGen) return;
          store.set({
            status: "ready",
            mode: value.mode || "auto",
            judged: !!value.judged,
            reason: value.reason || "",
            error: undefined,
          });
        } catch (err) {
          if (gen !== writeGen) return;
          try {
            console.error("[dsh-superpowers] describe failed:", err);
          } catch (_) {
            /* noop */
          }
          store.set({
            status: "error",
            ...DEFAULTS,
            error: String((err && err.message) || err),
          });
        }
      }

      // 乐观更新：先本地改 UI（立即生效），再经官方 mutate 同步宿主；失败回滚并暴露错误。
      async function setMode(mode) {
        const myGen = ++writeGen;
        const before = store.get();
        if (before.mode === mode) return;
        store.set({ ...before, mode, status: "ready", error: undefined });
        try {
          const response = await api.settings.mutate({
            ns: NS,
            ops: [{ op: "set", path: ["mode"], value: mode }],
          });
          const result = response && response.result;
          if (!result || !result.ok) throw new Error("settings mutate failed");
        } catch (err) {
          if (writeGen !== myGen) return; // 期间有更新的写入，不回滚
          try {
            console.error("[dsh-superpowers] mutate failed:", err);
          } catch (_) {
            /* noop */
          }
          store.set({
            ...store.get(),
            mode: before.mode,
            error: String((err && err.message) || err),
          });
        }
      }

      void load();
      return { store, load, setMode };
    }

    function effectiveOf(s) {
      return s.mode === "on" ? true : s.mode === "off" ? false : !!s.judged;
    }

    function nextMode(mode) {
      return mode === "auto" ? "on" : mode === "on" ? "off" : "auto";
    }

    function stateTextOf(s, effective) {
      if (s.mode === "auto")
        return "自动（" + (effective ? "重型" : "轻度") + "）";
      if (s.mode === "on") return "开（重型）";
      return "关（轻度）";
    }

    // ── (Coding) 三态按钮 ─────────────────────────────────────────
    function CodingToggle({ model }) {
      const s = useStoreState(model.store);
      const effective = effectiveOf(s);
      const boxState =
        s.mode === "auto" ? "auto" : s.mode === "on" ? "on" : "off";
      const stateText = stateTextOf(s, effective);
      const modeWord =
        s.mode === "auto" ? "自动" : s.mode === "on" ? "开" : "关";

      const cycle = (ev) => {
        ev.preventDefault();
        if (s.status === "loading") return;
        void model.setMode(nextMode(s.mode));
      };
      const onKeyDown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          if (s.status === "loading") return;
          void model.setMode(nextMode(s.mode));
        }
      };

      // 悬浮框内容：无错误 = 说明；有错误 = [红字模式词] 同步错误：msg + 说明
      let tooltipNodes = [];
      if (s.error) {
        tooltipNodes.push(
          React.createElement(
            "div",
            { className: "sp-tooltip-err", key: "err" },
            React.createElement(
              "span",
              { className: "sp-tooltip-err-mode" },
              modeWord,
            ),
            " 同步错误：" + s.error,
          ),
        );
      }
      tooltipNodes.push(
        React.createElement(
          "div",
          { className: "sp-tooltip-body", key: "body" },
          TOOLTIP,
        ),
      );
      tooltipNodes.push(
        React.createElement(
          "div",
          { className: "sp-tooltip-hint", key: "hint" },
          "当前：" + stateText + "（点击可强制 开 / 关，再次点击回到自动）",
        ),
      );

      return React.createElement(
        "label",
        {
          className: "sp-toggle",
          onClick: cycle,
          onKeyDown,
          role: "button",
          tabIndex: 0,
          title: TOOLTIP,
          "aria-label": "Superpowers（重型编码模式）" + stateText,
          "data-sp-status": s.status,
          "data-sp-mode": s.mode,
        },
        React.createElement(
          "span",
          { className: "sp-box sp-box-" + boxState, "aria-hidden": true },
          boxState === "on"
            ? React.createElement(
                "svg",
                { viewBox: "0 0 12 12", width: 10, height: 10 },
                React.createElement("path", {
                  d: "M2 6.4 L4.8 9.2 L10 3.2",
                  fill: "none",
                  stroke: "#fff",
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }),
              )
            : null,
        ),
        React.createElement(
          "span",
          { className: "sp-toggle-label" },
          "(Coding)",
        ),
        React.createElement(
          "span",
          { className: "sp-toggle-state" },
          stateText,
        ),
        React.createElement(
          "span",
          { className: "sp-tooltip", role: "tooltip" },
          tooltipNodes,
        ),
      );
    }

    // ── 设置 → 常规 一行 ───────────────────────────────────────────
    function SettingsRow({ model }) {
      const s = useStoreState(model.store);
      const effective = effectiveOf(s);
      const judgeText =
        s.reason || (s.judged ? "高难度 → 重型" : "低难度 → 轻度");
      const [menuOpen, setMenuOpen] = React.useState(false);
      var modeItems = [
        { id: "auto", label: "自动（按任务难度）" },
        { id: "on", label: "开（重型）" },
        { id: "off", label: "关（轻度）" },
      ];
      var found = modeItems.find(function (i) {
        return i.id === s.mode;
      });
      var currentLabel = found ? found.label : s.mode;
      return React.createElement(
        "div",
        { className: "sp-row" },
        React.createElement(
          "div",
          { className: "sp-row-head" },
          React.createElement(
            "span",
            { className: "sp-row-title" },
            "重型编码模式（Coding）",
          ),
          React.createElement(Menu, {
            open: menuOpen,
            anchor: React.createElement(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "md",
                className: "sp-row-menu",
                "aria-label": "重型编码模式",
                "aria-haspopup": "menu",
                "aria-expanded": menuOpen,
                disabled: s.status === "loading",
                onClick: function () {
                  setMenuOpen(!menuOpen);
                },
              },
              React.createElement(
                "span",
                { className: "sp-row-menu-label" },
                currentLabel,
              ),
              React.createElement(IconChevronDownOutline14, {
                className: "sp-row-menu-icon",
              }),
            ),
            items: modeItems,
            selectedId: s.mode,
            align: "end",
            portal: true,
            compact: true,
            onClose: function () {
              setMenuOpen(false);
            },
            onSelect: function (id) {
              setMenuOpen(false);
              void model.setMode(id);
            },
          }),
        ),
        React.createElement(
          "p",
          { className: "sp-row-desc" },
          "Superpowers：为 Coding 和重型任务开发的专注模式，会让 Agent 更专注地专注于代码和 Coding（编码）。重型模式挂载 subagent / workflow 等重型工具并注入 Coding Focus 提示；轻度模式不挂载重型工具。",
        ),
        React.createElement(
          "p",
          { className: "sp-row-judge" },
          "最近判定：" +
            judgeText +
            "（当前生效：" +
            (effective ? "重型" : "轻度") +
            "）",
        ),
        s.error
          ? React.createElement(
              "p",
              { className: "sp-row-error" },
              "同步错误：" + String(s.error),
            )
          : null,
      );
    }

    // ── 样式（贴合应用设计令牌，浅色/深色均可用） ─────────────────
    const CSS = `
.sp-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-text-primary, inherit);
  font-size: 12px;
  white-space: nowrap;
  outline: none;
  border-radius: 6px;
}
.sp-toggle:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-button-business-fill, #4a9eff) 45%, transparent);
}
/* 方块三态 */
.sp-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--dsw-alias-text-secondary, #888);
  box-sizing: border-box;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.sp-box-off {
  background: transparent;
  border-color: var(--dsw-alias-text-secondary, #888);
}
.sp-box-on {
  background: var(--dsw-alias-button-business-fill, #4a9eff);
  border-color: transparent;
}
.sp-box-auto {
  background: #000;
  border-color: #000;
}
/* 自动态 = 黑色方块 + 中间一条白色横杠（不确定态） */
.sp-box-auto::before {
  content: '';
  width: 9px;
  height: 2px;
  border-radius: 1px;
  background: #fff;
}
.sp-toggle-label {
  opacity: 0.92;
  letter-spacing: 0.01em;
}
.sp-toggle-state {
  font-size: 10px;
  opacity: 0.62;
  padding: 1px 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-text-primary, #888) 12%, transparent);
}
/* 悬浮说明框 */
.sp-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 9999;
  max-width: 340px;
  width: max-content;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--dsw-alias-surface-raised, #1f1f1f);
  color: var(--dsw-alias-text-primary, #eee);
  font-size: 12px;
  line-height: 1.6;
  white-space: normal;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-text-primary, #fff) 14%, transparent);
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.sp-toggle:hover .sp-tooltip,
.sp-toggle:focus-visible .sp-tooltip {
  opacity: 1;
  transform: translateY(0);
}
.sp-tooltip-err {
  margin-bottom: 4px;
  color: #e5484d;
  font-weight: 600;
}
.sp-tooltip-err-mode {
  color: #e5484d;
}
.sp-tooltip-body {
  opacity: 0.95;
}
.sp-tooltip-hint {
  margin-top: 5px;
  opacity: 0.72;
  font-size: 11px;
}
.sp-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sp-row-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sp-row-title {
  font-weight: 600;
}
.sp-row-menu {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.sp-row-menu-label {
  white-space: nowrap;
}
.sp-row-menu-icon {
  flex: none;
}
.sp-row-desc {
  color: var(--dsw-alias-text-secondary, rgba(127,127,127,0.9));
  font-size: 13px;
  line-height: 1.6;
}
.sp-row-judge {
  color: var(--dsw-alias-text-secondary, rgba(127,127,127,0.9));
  font-size: 12px;
}
.sp-row-error {
  color: #e5484d;
  font-size: 12px;
}
`;

    function apply(ctx) {
      const connection = ctx.get("connection");
      const api = connection && connection.api;
      if (!api) return;
      const model = createModel(api);

      // 订阅宿主端状态变更（难度判定回写 / 自身写后回读）
      const remote = ctx.get("remote");
      if (remote && typeof remote.$on === "function") {
        ctx.effect(() => {
          let off = null;
          try {
            off = remote.$on("settings/document-updated", (ns) => {
              if (ns === NS) void model.load();
            });
          } catch (_) {
            /* remote 不可用 — 忽略，仍可手动刷新 */
          }
          return () => {
            try {
              off && off();
            } catch (_) {
              /* ignore */
            }
          };
        });
      }

      // 样式
      ctx.effect(() => {
        const el = document.createElement("style");
        el.setAttribute("data-plugin", "dsh-superpowers");
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => {
          el.remove();
        };
      });

      const slots = ctx.get("slots");
      if (slots !== undefined) {
        slots.inject("conversation.input.left", () =>
          slots.register(
            {
              name: "conversation.input.left",
              id: "sp-coding-toggle",
              order: 10,
              inject: () => ({ model }),
            },
            CodingToggle,
          ),
        );
        slots.inject("settings.general.item", () =>
          slots.register(
            {
              name: "settings.general.item",
              id: "sp-coding",
              order: 30,
              inject: () => ({ model }),
            },
            SettingsRow,
          ),
        );
      }
    }

    exports.inject = ["slots", "connection"];
    exports.apply = apply;
    exports.CodingToggle = CodingToggle;
    exports.SettingsRow = SettingsRow;
    exports.createModel = createModel;
    exports.effectiveOf = effectiveOf;
    exports.nextMode = nextMode;
    return module.exports;
  },
});
