// dsh-settings-tools — client bundle (通用设置增强).
//
// 1) 通用设置新增「重启 Harness」行（order 150）：桌面桥 runtime.restartHarness()，
//    实时状态（phase + 重启计数）。
// 2) 「局域网访问」行重构为左右开边（order 190，priority -1 遮蔽内置 dsh-lan-access
//    的 priority 0 同 id 行）：左文右控 + 规格统一开关 + 地址选择 + 复制链接。
// 3) 整页 CSS 归一化：全体行 16px 分隔线节奏、文字垂直居中于两线之间、描述/提示字调小、
//    开关与选项全部贴右（外观行改右侧药丸、提示词原则开关规格统一、检查更新按钮右移、
//    Desktop 区块去 border-top 双线并统一行高）。
window.__ModuleLoader__.load({
  id: "dsh-settings-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];

    const ZH =
      typeof navigator !== "undefined" &&
      /^zh/i.test(
        (navigator.languages && navigator.languages[0]) ||
          navigator.language ||
          "",
      );

    const T = {
      lanTitle: ZH ? "局域网访问" : "LAN access",
      lanDesc: ZH
        ? "在可信局域网内打开此会话的访问链接（链接包含会话令牌）"
        : "Open this session from another device on your trusted LAN (the link carries a session token)",
      lanSwitchLabel: ZH ? "开启或关闭局域网访问" : "Toggle LAN access",
      swOn: ZH ? "已开启" : "On",
      swOff: ZH ? "已关闭" : "Off",
      addressLabel: ZH ? "局域网地址" : "LAN address",
      copy: ZH ? "复制访问链接" : "Copy access link",
      copied: ZH ? "访问链接已复制到剪贴板" : "Access link copied to clipboard",
      copyFail: ZH ? "复制访问链接失败" : "Failed to copy access link",
      failRead: ZH ? "无法读取局域网访问状态" : "Cannot read LAN access state",
      failing: ZH ? "正在读取设置…" : "Reading settings…",
      enabling: ZH ? "正在开启…" : "Enabling…",
      disabling: ZH ? "正在关闭…" : "Disabling…",
      failOn: ZH ? "开启失败" : "Failed to enable",
      failOff: ZH ? "关闭失败" : "Failed to disable",
      onNoAddr: ZH
        ? "已开启：未检测到局域网 IPv4 地址"
        : "On: no LAN IPv4 address detected",
      offState: ZH ? "已关闭" : "Off",
      onState: ZH ? "已开启" : "On",
      unavailable: ZH ? "局域网访问不可用" : "LAN access unavailable",
      warning: ZH
        ? "连接使用未加密 HTTP。仅在可信局域网中开启；获得访问链接的任何人都可访问此会话，离开后请立即关闭。"
        : "The connection uses unencrypted HTTP. Enable only on a trusted LAN; anyone with the link can access this session — turn it off when done.",
      restartTitle: ZH ? "重启 Harness" : "Restart Harness",
      restartDescNa: ZH ? "仅桌面应用可用" : "Available in the desktop app only",
      restartStatus: ZH
        ? "Harness 运行时{phaseLabel}，已重启 {count} 次"
        : "Harness runtime {phaseLabel}, restarted {count} times",
      restartAction: ZH ? "重启" : "Restart",
      restartConfirm: ZH
        ? "确定要重启 Harness 吗？当前会话会短暂中断，重启后自动恢复。"
        : "Restart Harness now? The current session will briefly interrupt and resume automatically.",
      phaseLabels: {
        starting: ZH ? "启动中" : "starting",
        ready: ZH ? "就绪" : "ready",
        recovering: ZH ? "恢复中" : "recovering",
        failed: ZH ? "已失败" : "failed",
        stopping: ZH ? "停止中" : "stopping",
      },
    };

    function getBridge() {
      if (typeof window === "undefined") return undefined;
      const bridge = window.deepseekDesktop;
      return bridge && typeof bridge === "object" ? bridge : undefined;
    }
    function getLan() {
      const bridge = getBridge();
      const lan = bridge && bridge.lanAccess;
      if (
        !lan ||
        typeof lan.get !== "function" ||
        typeof lan.set !== "function" ||
        typeof lan.copyUrl !== "function"
      ) {
        return undefined;
      }
      return lan;
    }
    function pickAddresses(state) {
      if (!state || !Array.isArray(state.addresses)) return [];
      return state.addresses.filter((a) => typeof a === "string");
    }

    // ── 局域网访问行（左右开边：左文右控）──
    function LanAccessRow() {
      const [enabled, setEnabled] = React.useState(false);
      const [loaded, setLoaded] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [addresses, setAddresses] = React.useState([]);
      const [selected, setSelected] = React.useState("");
      const [message, setMessage] = React.useState(T.failing);

      const applyState = (state) => {
        const next = pickAddresses(state);
        setEnabled(state && state.enabled === true);
        setAddresses(next);
        setSelected((current) =>
          next.includes(current) ? current : (next[0] || ""),
        );
        setMessage(
          state && state.enabled === true
            ? next.length > 0
              ? T.onState
              : T.onNoAddr
            : T.offState,
        );
      };

      React.useEffect(() => {
        let active = true;
        const lan = getLan();
        if (!lan) {
          setMessage(T.unavailable);
          setLoaded(true);
          return () => {
            active = false;
          };
        }
        lan
          .get()
          .then((state) => {
            if (active) applyState(state);
          })
          .catch(() => {
            if (active) setMessage(T.failRead);
          })
          .finally(() => {
            if (active) setLoaded(true);
          });
        return () => {
          active = false;
        };
      }, []);

      const changeEnabled = async () => {
        const lan = getLan();
        if (!lan || busy) return;
        const next = !enabled;
        setBusy(true);
        setMessage(next ? T.enabling : T.disabling);
        try {
          applyState(await lan.set({ enabled: next }));
        } catch {
          setMessage(next ? T.failOn : T.failOff);
        } finally {
          setBusy(false);
        }
      };

      const copyLink = async () => {
        const lan = getLan();
        if (!lan || busy || !enabled || !selected) return;
        setBusy(true);
        try {
          await lan.copyUrl({ address: selected });
          setMessage(T.copied);
        } catch {
          setMessage(T.copyFail);
        } finally {
          setBusy(false);
        }
      };

      return React.createElement(
        "div",
        { className: "dsh-st-row dsh-st-lan" },
        React.createElement(
          "div",
          { className: "dsh-st-text" },
          React.createElement("div", { className: "dsh-st-title" }, T.lanTitle),
          React.createElement("div", { className: "dsh-st-desc" }, T.lanDesc),
          message
            ? React.createElement(
                "div",
                { className: "dsh-st-status", "aria-live": "polite" },
                message,
              )
            : null,
        ),
        React.createElement(
          "div",
          { className: "dsh-st-controls" },
          React.createElement(
            "span",
            { className: "dsh-st-switchWrap" },
            React.createElement(
              "button",
              {
                type: "button",
                role: "switch",
                "aria-checked": enabled,
                "aria-label": T.lanSwitchLabel,
                className: "dsh-st-switch",
                disabled: !loaded || busy,
                onClick: changeEnabled,
              },
              React.createElement("span", { className: "dsh-st-switchKnob" }),
            ),
            React.createElement(
              "span",
              { className: "dsh-st-switchText" },
              enabled ? T.swOn : T.swOff,
            ),
          ),
          enabled && addresses.length > 0
            ? React.createElement(
                "select",
                {
                  className: "dsh-st-select",
                  "aria-label": T.addressLabel,
                  value: selected,
                  disabled: busy,
                  onChange: (event) => setSelected(event.target.value),
                },
                addresses.map((address) =>
                  React.createElement(
                    "option",
                    { key: address, value: address },
                    address,
                  ),
                ),
              )
            : null,
          enabled && addresses.length > 0
            ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "dsh-st-action",
                  disabled: busy,
                  onClick: copyLink,
                },
                T.copy,
              )
            : null,
        ),
        enabled
          ? React.createElement("p", { className: "dsh-st-warn" }, T.warning)
          : null,
      );
    }

    // ── 重启 Harness 行 ──
    function RestartRow() {
      const [available, setAvailable] = React.useState(false);
      const [phase, setPhase] = React.useState("ready");
      const [count, setCount] = React.useState(0);
      const [busy, setBusy] = React.useState(false);

      React.useEffect(() => {
        let active = true;
        const bridge = getBridge();
        const runtime = bridge && bridge.runtime;
        const grouped =
          runtime && typeof runtime.restartHarness === "function";
        const legacy = bridge && typeof bridge.restartHarness === "function";
        if (!grouped && !legacy) {
          return () => {
            active = false;
          };
        }
        setAvailable(true);
        const apply = (state) => {
          if (!active || !state) return;
          if (typeof state.phase === "string") setPhase(state.phase);
          if (typeof state.restartCount === "number") setCount(state.restartCount);
        };
        if (grouped && typeof runtime.getState === "function") {
          runtime.getState().then(apply).catch(() => {});
          const unsubscribe =
            typeof runtime.subscribe === "function"
              ? runtime.subscribe(apply)
              : undefined;
          return () => {
            active = false;
            if (typeof unsubscribe === "function") unsubscribe();
          };
        }
        return () => {
          active = false;
        };
      }, []);

      const restart = () => {
        const bridge = getBridge();
        if (!bridge || busy) return;
        const confirmed =
          typeof window !== "undefined" && typeof window.confirm === "function"
            ? window.confirm(T.restartConfirm)
            : true;
        if (!confirmed) return;
        setBusy(true);
        const operation =
          bridge.runtime && typeof bridge.runtime.restartHarness === "function"
            ? bridge.runtime.restartHarness()
            : typeof bridge.restartHarness === "function"
              ? bridge.restartHarness()
              : Promise.resolve();
        Promise.resolve(operation).catch(() => setBusy(false));
      };

      const phaseLabel = T.phaseLabels[phase] || phase;

      return React.createElement(
        "div",
        { className: "dsh-st-row dsh-st-restart" },
        React.createElement(
          "div",
          { className: "dsh-st-text" },
          React.createElement(
            "div",
            { className: "dsh-st-title" },
            T.restartTitle,
          ),
          React.createElement(
            "div",
            { className: "dsh-st-desc" },
            available
              ? T.restartStatus
                  .replace("{phaseLabel}", phaseLabel)
                  .replace("{count}", String(count))
              : T.restartDescNa,
          ),
        ),
        React.createElement(
          "div",
          { className: "dsh-st-controls" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsh-st-action",
              disabled: !available || busy,
              onClick: restart,
            },
            T.restartAction,
          ),
        ),
      );
    }

    // ── 样式：本插件行 + 整页归一化 ──
    const CSS = `
/* ═══ 本插件行 ═══ */
.dsh-st-row {
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16));
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  display: flex;
  flex-wrap: wrap;
}
.dsh-st-text {
  flex-direction: column;
  flex: 1;
  gap: 4px;
  min-width: 0;
  padding-right: 24px;
  display: flex;
}
.dsh-st-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
}
.dsh-st-desc {
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,0.75));
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}
.dsh-st-status {
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,0.75));
  font-size: 11px;
  line-height: 16px;
}
.dsh-st-controls {
  flex: none;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.dsh-st-switchWrap {
  align-items: center;
  gap: 8px;
  display: inline-flex;
}
.dsh-st-switch {
  box-sizing: border-box;
  position: relative;
  width: 40px;
  height: 22px;
  flex: none;
  cursor: pointer;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28));
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.14));
  transition: background-color 0.16s, border-color 0.16s;
}
.dsh-st-switch[aria-checked="true"] {
  background: var(--dsw-alias-state-success-primary, #2e9e63);
  border-color: transparent;
}
.dsh-st-switch:disabled {
  cursor: default;
  opacity: 0.55;
}
.dsh-st-switchKnob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.28);
  transition: transform 0.16s;
}
.dsh-st-switch[aria-checked="true"] .dsh-st-switchKnob {
  transform: translateX(18px);
}
.dsh-st-switchText {
  min-width: 34px;
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,0.7));
  font-size: 11px;
  line-height: 16px;
}
.dsh-st-select {
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.14));
  height: 36px;
  max-width: 200px;
  font: inherit;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  border: none;
  border-radius: 18px;
  padding: 0 14px;
  font-size: 14px;
  line-height: 22px;
}
.dsh-st-select:disabled {
  cursor: default;
  opacity: 0.55;
}
.dsh-st-action {
  box-sizing: border-box;
  height: 36px;
  padding: 0 16px;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28));
  border-radius: 18px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  display: inline-flex;
  align-items: center;
}
.dsh-st-action:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.1));
}
.dsh-st-action:disabled {
  cursor: default;
  opacity: 0.55;
}
.dsh-st-warn {
  flex-basis: 100%;
  margin: 0;
  color: var(--dsw-alias-state-warn-primary, #a15c00);
  font-size: 12px;
  line-height: 18px;
}

/* ═══ 整页归一化 ═══ */
[data-slot="settings.general.item"] .dshDesktopSettings {
  border-top: none;
  padding: 16px 0 8px;
}
[data-slot="settings.general.item"] .dshDesktopSettingsRow {
  min-height: 0;
  padding: 16px 0;
}
[data-slot="settings.general.item"] .dshDesktopSettingsActions {
  justify-content: flex-end;
  padding-top: 16px;
}
[data-slot="settings.general.item"] .sp-row {
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16));
  padding: 16px 0;
  justify-content: center;
}
[data-slot="settings.general.item"] .sp-row-title {
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
[data-slot="settings.general.item"] .sp-row-desc {
  color: var(--dsw-alias-label-tertiary, rgba(127,127,127,0.75));
  font-size: 12px;
  line-height: 18px;
}
[data-slot="settings.general.item"] .ppRow {
  padding: 16px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16));
}
[data-slot="settings.general.item"] .ppTitle {
  font-weight: 400;
}
[data-slot="settings.general.item"] .ppState {
  font-size: 12px;
  line-height: 18px;
}
[data-slot="settings.general.item"] .ppSwitch {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28));
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.14));
}
[data-slot="settings.general.item"] .ppSwitch[data-on="true"] {
  background: var(--dsw-alias-state-success-primary, #2e9e63);
}
[data-slot="settings.general.item"] .ppKnob {
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
[data-slot="settings.general.item"] .ppSwitch[data-on="true"] .ppKnob {
  transform: translateX(18px);
}
[data-slot="settings.general.item"] ._8HJdBW_group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
[data-slot="settings.general.item"] ._8HJdBW_cubeRow {
  margin-left: auto;
  flex-wrap: nowrap;
}
[data-slot="settings.general.item"] ._8HJdBW_themeCube {
  flex: 0 0 auto;
  flex-direction: row;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
}
[data-slot="settings.general.item"] > :last-child:not(.dsh-st-row):not(.dshDesktopSettings) {
  padding: 16px 0 !important;
  border-bottom: none;
}
[data-slot="settings.general.item"] > :last-child:not(.dsh-st-row):not(.dshDesktopSettings) > span:first-child {
  flex: 1 1 auto !important;
  font-weight: 400 !important;
  font-size: 14px !important;
  color: var(--dsw-alias-label-primary) !important;
}
[data-slot="settings.general.item"] > :last-child:not(.dsh-st-row):not(.dshDesktopSettings) > button {
  margin-left: auto;
  height: 36px !important;
  padding: 0 16px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  border-radius: 18px !important;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.28)) !important;
  background: transparent !important;
  color: var(--dsw-alias-label-primary) !important;
}
[data-slot="settings.general.item"] > :last-child:not(.dsh-st-row):not(.dshDesktopSettings) > span:not(:first-child) {
  flex: 0 1 auto !important;
  font-size: 12px !important;
}
`;

    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = "dsh-settings-tools";
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          try {
            tag.remove();
          } catch (_) {
            /* fiber tearing down */
          }
        };
      }, "dsh-settings-tools: styles");

      ctx.effect(() => {
        const dispose = ctx.slots.inject("settings.general.item", () =>
          ctx.slots.register(
            {
              name: "settings.general.item",
              id: "restart-harness",
              order: 150,
            },
            RestartRow,
          ),
        );
        return () => {
          try {
            dispose();
          } catch (_) {
            /* fiber tearing down */
          }
        };
      }, "dsh-settings-tools: restart row");

      ctx.effect(() => {
        const dispose = ctx.slots.inject("settings.general.item", () =>
          ctx.slots.register(
            {
              name: "settings.general.item",
              // 同 id + 更低 priority：遮蔽内置 dsh-lan-access（priority 0）行
              id: "dsh-lan-access",
              order: 190,
              priority: -1,
            },
            LanAccessRow,
          ),
        );
        return () => {
          try {
            dispose();
          } catch (_) {
            /* fiber tearing down */
          }
        };
      }, "dsh-settings-tools: lan row");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});