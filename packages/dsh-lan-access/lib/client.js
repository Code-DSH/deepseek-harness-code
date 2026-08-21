// dsh-lan-access — client-only LAN settings row.
//
// The bridge returns only redacted state. This module never derives, renders,
// stores, renders, or logs an access URL/token; clipboard handling stays in
// the desktop host behind the fixed copyUrl action.
window.__ModuleLoader__.load({
  id: "dsh-lan-access",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];
    const ROW_STYLE = {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px 12px",
      padding: "10px 0",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", Roboto, sans-serif',
    };
    const LABEL_STYLE = { flex: "0 0 auto", fontWeight: 600, fontSize: 13 };
    const BUTTON_STYLE = {
      flex: "0 0 auto",
      padding: "4px 14px",
      fontSize: 12,
      fontWeight: 500,
      borderRadius: 6,
      cursor: "pointer",
      border: "1px solid var(--dsw-border, rgba(0,0,0,0.12))",
      background: "var(--dsw-surface, transparent)",
      color: "inherit",
    };
    const MESSAGE_STYLE = { flex: "1 1 100%", fontSize: 12, opacity: 0.75 };
    const WARNING_STYLE = {
      flex: "1 1 100%",
      margin: 0,
      fontSize: 12,
      lineHeight: 1.5,
      color: "var(--dsw-warning, #a15c00)",
    };

    function getBridge() {
      const bridge = window.deepseekDesktop;
      if (
        !bridge ||
        !bridge.lanAccess ||
        typeof bridge.lanAccess.get !== "function" ||
        typeof bridge.lanAccess.set !== "function" ||
        typeof bridge.lanAccess.copyUrl !== "function"
      ) {
        return undefined;
      }
      return bridge.lanAccess;
    }

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      function LanAccessRow() {
        const [enabled, setEnabled] = React.useState(false);
        const [loaded, setLoaded] = React.useState(false);
        const [busy, setBusy] = React.useState(false);
        const [addresses, setAddresses] = React.useState([]);
        const [selectedAddress, setSelectedAddress] = React.useState("");
        const [message, setMessage] = React.useState("已关闭（正在读取设置…）");

        const applyState = (state) => {
          const nextAddresses = Array.isArray(state.addresses)
            ? state.addresses.filter((address) => typeof address === "string")
            : [];
          setEnabled(state.enabled === true);
          setAddresses(nextAddresses);
          setSelectedAddress((current) =>
            nextAddresses.includes(current)
              ? current
              : (nextAddresses[0] ?? ""),
          );
          setMessage(state.enabled ? "已开启" : "已关闭");
        };

        React.useEffect(() => {
          let active = true;
          const bridge = getBridge();
          if (!bridge) {
            setLoaded(true);
            setMessage("局域网访问不可用");
            return () => {
              active = false;
            };
          }
          bridge
            .get()
            .then((state) => {
              if (!active) return;
              applyState(state);
            })
            .catch(() => {
              if (active) setMessage("无法读取局域网访问状态");
            })
            .finally(() => {
              if (active) setLoaded(true);
            });
          return () => {
            active = false;
          };
        }, []);

        const changeEnabled = async () => {
          if (busy) return;
          const bridge = getBridge();
          if (!bridge) {
            setMessage("局域网访问不可用");
            return;
          }
          const nextEnabled = !enabled;
          setBusy(true);
          setMessage(nextEnabled ? "正在开启…" : "正在关闭…");
          try {
            const state = await bridge.set({ enabled: nextEnabled });
            applyState(state);
          } catch {
            setMessage(nextEnabled ? "开启失败" : "关闭失败");
          } finally {
            setBusy(false);
          }
        };

        const copyAccessLink = async () => {
          if (busy || !enabled || !selectedAddress) return;
          const bridge = getBridge();
          if (!bridge) {
            setMessage("局域网访问不可用");
            return;
          }
          setBusy(true);
          try {
            await bridge.copyUrl({ address: selectedAddress });
            setMessage("访问链接已复制到剪贴板");
          } catch {
            setMessage("复制访问链接失败");
          } finally {
            setBusy(false);
          }
        };

        return React.createElement(
          "div",
          { style: ROW_STYLE },
          React.createElement("span", { style: LABEL_STYLE }, "局域网访问"),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: changeEnabled,
              disabled: !loaded || busy,
              style: BUTTON_STYLE,
            },
            enabled ? "关闭" : "开启",
          ),
          enabled && addresses.length > 0
            ? React.createElement(
                "select",
                {
                  "aria-label": "局域网地址",
                  value: selectedAddress,
                  onChange: (event) => setSelectedAddress(event.target.value),
                  disabled: busy,
                  style: BUTTON_STYLE,
                },
                ...addresses.map((address) =>
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
                "span",
                { style: MESSAGE_STYLE },
                "可用地址：",
                ...addresses.map((address) =>
                  React.createElement(
                    "code",
                    {
                      key: address,
                      "data-lan-address": address,
                      style: { marginRight: 12 },
                    },
                    address,
                  ),
                ),
              )
            : null,
          React.createElement(
            "button",
            {
              type: "button",
              onClick: copyAccessLink,
              disabled: !loaded || busy || !enabled || !selectedAddress,
              style: BUTTON_STYLE,
            },
            "复制访问链接",
          ),
          React.createElement("span", { style: MESSAGE_STYLE }, message),
          enabled
            ? React.createElement(
                "p",
                { style: WARNING_STYLE },
                "连接使用未加密 HTTP。仅在可信局域网中开启；获得访问链接的任何人都可访问此会话，离开后请立即关闭。",
              )
            : null,
        );
      }

      ctx.effect(() => {
        const dispose = slots.inject("settings.general.item", () =>
          slots.register(
            {
              name: "settings.general.item",
              id: "dsh-lan-access",
              order: 190,
            },
            LanAccessRow,
          ),
        );
        return () => {
          try {
            dispose();
          } catch {
            // Plugin fiber tearing down.
          }
        };
      }, "dsh-lan-access: general settings row");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
