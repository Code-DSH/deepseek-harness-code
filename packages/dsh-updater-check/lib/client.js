// dsh-updater-check — client half (检查更新入口).
//
// Injects a single row at the very bottom of 设置 → 通用 (settings.general.item,
// order 200 — below the close-window row at order 100). The row renders a label
// + a "检查更新" button. Clicking it calls the desktop bridge's updater.check()
// IPC; the main process shows its own update-available/no-update dialog and, on
// consent, downloads + verifies + swaps the bundle + relaunches. This row only
// adds a manual trigger + a local status line; the auto-pop-on-detect flow is
// driven by the main-process updater-host scheduler.
window.__ModuleLoader__.load({
  id: "dsh-updater-check",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];

    const ROW_STYLE = {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "10px 0",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", Roboto, sans-serif',
    };
    const LABEL_STYLE = { flex: "0 0 auto", fontWeight: 600, fontSize: 13 };
    const BTN_STYLE = {
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
    const MSG_STYLE = { flex: "1 1 auto", fontSize: 12, opacity: 0.7 };

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;

      function CheckUpdatesRow() {
        const [status, setStatus] = React.useState("idle"); // idle | checking | done | error
        const [message, setMessage] = React.useState("");

        const check = async () => {
          if (status === "checking") return;
          setStatus("checking");
          setMessage("正在检查…");
          try {
            const bridge = window.deepseekDesktop;
            if (
              !bridge ||
              !bridge.updater ||
              typeof bridge.updater.check !== "function"
            ) {
              setStatus("error");
              setMessage("更新器不可用");
              return;
            }
            const result = await bridge.updater.check();
            if (result && result.available) {
              setStatus("done");
              setMessage(
                result.version
                  ? `发现新版本 ${result.version}，请在弹窗中确认更新`
                  : "发现新版本，请在弹窗中确认更新",
              );
            } else {
              setStatus("done");
              setMessage("已是最新版本");
            }
          } catch (error) {
            setStatus("error");
            setMessage(
              "检查失败：" +
                (error && error.message ? error.message : String(error)),
            );
          }
        };

        const label = "检查更新";
        const btnText = status === "checking" ? "检查中…" : "检查更新";
        return React.createElement(
          "div",
          { style: ROW_STYLE },
          React.createElement("span", { style: LABEL_STYLE }, label),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: check,
              disabled: status === "checking",
              style: {
                ...BTN_STYLE,
                ...(status === "checking"
                  ? { cursor: "default", opacity: 0.6 }
                  : {}),
              },
            },
            btnText,
          ),
          message
            ? React.createElement("span", { style: MSG_STYLE }, message)
            : null,
        );
      }

      ctx.effect(() => {
        const dispose = slots.inject("settings.general.item", () =>
          slots.register(
            {
              name: "settings.general.item",
              id: "dsh-updater-check",
              order: 200,
            },
            CheckUpdatesRow,
          ),
        );
        return () => {
          try {
            dispose();
          } catch (_) {
            /* plugin fiber tearing down — ignore */
          }
        };
      }, "dsh-updater-check: check-updates row");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
