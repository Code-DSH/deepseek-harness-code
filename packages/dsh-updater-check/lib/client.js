// dsh-updater-check — client half (检查更新入口 + 状态面板).
// The official Harness source stays untouched; this plugin owns update UI.
window.__ModuleLoader__.load({
  id: "dsh-updater-check",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const inject = ["slots"];
    const PANEL_ID = "dsh-updater-check-panel";
    const UPDATE_EVENTS_PATH = "/__dsh/update/events";
    const UPDATE_STATUS_PATH = "/__dsh/update/status";
    const ROW_STYLE = {
      display: "flex",
      alignItems: "center",
      gap: "12px",
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
    const MESSAGE_STYLE = { flex: "1 1 auto", fontSize: 12, opacity: 0.7 };

    function isDesktopBridge(value) {
      return Boolean(
        value &&
          value.updater &&
          typeof value.updater.getStatus === "function" &&
          typeof value.updater.subscribe === "function" &&
          typeof value.updater.check === "function" &&
          typeof value.updater.apply === "function" &&
          typeof value.updater.restart === "function",
      );
    }

    function formatBytes(value) {
      if (!Number.isFinite(value) || value < 0) return "0 B";
      if (value < 1024) return `${Math.round(value)} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      if (value < 1024 * 1024 * 1024)
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    function createStatusPanel() {
      if (
        typeof document === "undefined" ||
        document.getElementById(PANEL_ID) !== null
      ) {
        return {
          check: async () => ({ available: false }),
          dispose: () => undefined,
        };
      }

      const root = document.createElement("section");
      root.id = PANEL_ID;
      root.setAttribute("aria-live", "polite");
      root.style.cssText = [
        "display:none",
        "position:fixed",
        "z-index:2147483647",
        "top:52px",
        "right:24px",
        "width:360px",
        "padding:18px",
        "border:1px solid rgba(0,0,0,.12)",
        "border-radius:14px",
        "background:var(--dsw-surface, rgba(255,255,255,.97))",
        "box-shadow:0 12px 40px rgba(0,0,0,.18)",
        "font:14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
        "color:inherit",
      ].join(";");
      const title = document.createElement("strong");
      const message = document.createElement("div");
      message.style.cssText =
        "margin-top:8px;line-height:1.5;white-space:pre-wrap";
      const progress = document.createElement("progress");
      progress.max = 100;
      progress.value = 0;
      progress.style.cssText = "width:100%;margin-top:14px;display:none";
      const actions = document.createElement("div");
      actions.style.cssText =
        "display:flex;gap:8px;justify-content:flex-end;margin-top:14px";
      const primary = document.createElement("button");
      const secondary = document.createElement("button");
      primary.style.cssText = BUTTON_STYLE;
      secondary.style.cssText = BUTTON_STYLE;
      actions.append(primary, secondary);
      root.append(title, message, progress, actions);
      (document.body || document.documentElement).append(root);

      let disposed = false;
      let eventSource;
      let pollTimer;
      let unsubscribe = () => undefined;
      const bridge =
        typeof window !== "undefined" ? window.deepseekDesktop : undefined;
      const desktop = isDesktopBridge(bridge);
      const hide = () => {
        root.style.display = "none";
      };
      const show = () => {
        if (!disposed) root.style.display = "block";
      };
      const failure = (error) => {
        show();
        title.textContent = "更新状态不可用";
        message.textContent =
          error && error.message ? error.message : String(error);
        primary.style.display = "none";
        secondary.textContent = "关闭";
      };
      const render = (status) => {
        if (disposed || !status || typeof status.phase !== "string") return;
        const phase = status.phase;
        if (phase === "idle") {
          hide();
          return;
        }
        show();
        primary.disabled = false;
        primary.style.display = "inline-block";
        progress.style.display = "none";
        secondary.textContent = "稍后";
        if (phase === "checking") {
          title.textContent = "正在检查更新";
          message.textContent = "正在获取最新版本信息…";
          primary.style.display = "none";
          secondary.textContent = "隐藏";
        } else if (phase === "available") {
          title.textContent = `发现新版本 ${status.version || ""}`;
          message.textContent = desktop
            ? status.notes || "现在下载并安装更新？"
            : "发现新版本，请在主机桌面确认更新。";
          if (desktop) {
            primary.textContent = "下载更新";
            primary.dataset.action = "apply";
          } else {
            primary.style.display = "none";
            secondary.textContent = "关闭";
          }
        } else if (phase === "downloading") {
          title.textContent = "正在下载更新";
          const total = Number(status.totalBytes);
          const downloaded = Number(status.downloadedBytes || 0);
          const hasTotal = Number.isFinite(total) && total > 0;
          const percent = hasTotal
            ? Math.min(100, Math.max(0, (downloaded / total) * 100))
            : 0;
          message.textContent = hasTotal
            ? `${Math.round(percent)}% · ${formatBytes(downloaded)} / ${formatBytes(total)}\n${desktop ? "更新完成后可重启应用" : "请在主机桌面等待更新完成"}`
            : `已下载 ${formatBytes(downloaded)}\n${desktop ? "更新完成后可重启应用" : "请在主机桌面等待更新完成"}`;
          progress.style.display = hasTotal ? "block" : "none";
          progress.value = percent;
          primary.style.display = "none";
          secondary.textContent = desktop ? "后台下载" : "关闭";
        } else if (phase === "verifying") {
          title.textContent = "正在校验更新";
          message.textContent = desktop
            ? "正在验证下载文件完整性，请稍候…"
            : "主机正在验证下载文件完整性，请稍候…";
          primary.style.display = "none";
          secondary.textContent = "请稍候";
        } else if (phase === "ready-to-restart") {
          title.textContent = "更新已准备好";
          message.textContent = desktop
            ? "更新文件已下载并验证完成。重启应用后生效。"
            : "更新文件已下载并验证完成，请在主机桌面重启应用。";
          if (desktop) {
            primary.textContent = "重启并完成更新";
            primary.dataset.action = "restart";
          } else {
            primary.style.display = "none";
            secondary.textContent = "关闭";
          }
        } else if (phase === "up-to-date") {
          title.textContent = "已是最新版本";
          message.textContent = "当前应用已经是最新版本。";
          primary.style.display = "none";
          secondary.textContent = "关闭";
          window.setTimeout(hide, 2_400);
        } else if (phase === "failed") {
          title.textContent = "更新失败";
          message.textContent = status.error || "更新过程中发生未知错误。";
          primary.style.display = "none";
          secondary.textContent = "关闭";
        }
      };
      const check = async () => {
        if (!desktop) {
          show();
          title.textContent = "请在主机桌面检查更新";
          message.textContent = "内网设备只能查看更新状态，不能触发主机更新。";
          primary.style.display = "none";
          secondary.textContent = "关闭";
          return { available: false };
        }
        try {
          const result = await bridge.updater.check();
          if (!result.available) render({ phase: "up-to-date" });
          return result;
        } catch (error) {
          failure(error);
          throw error;
        }
      };

      secondary.onclick = hide;
      primary.onclick = async () => {
        if (!desktop) return;
        primary.disabled = true;
        try {
          if (primary.dataset.action === "apply") await bridge.updater.apply();
          else if (primary.dataset.action === "restart")
            await bridge.updater.restart();
        } catch (error) {
          failure(error);
        } finally {
          primary.disabled = false;
        }
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        if (eventSource) eventSource.close();
        if (pollTimer) window.clearInterval(pollTimer);
        root.remove();
      };

      if (desktop) {
        unsubscribe = bridge.updater.subscribe(render);
        void bridge.updater.getStatus().then(render).catch(failure);
      } else {
        const poll = async () => {
          try {
            const response = await fetch(
              new URL(UPDATE_STATUS_PATH, window.location.href),
              { cache: "no-store" },
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            render(await response.json());
          } catch (error) {
            failure(error);
          }
        };
        if (typeof EventSource !== "undefined") {
          eventSource = new EventSource(
            new URL(UPDATE_EVENTS_PATH, window.location.href),
          );
          eventSource.addEventListener("update", (event) => {
            try {
              render(JSON.parse(event.data));
            } catch (error) {
              failure(error);
            }
          });
          eventSource.onerror = () => {
            eventSource.close();
            void poll();
            pollTimer = window.setInterval(() => void poll(), 5_000);
          };
        } else {
          void poll();
          pollTimer = window.setInterval(() => void poll(), 5_000);
        }
      }
      return { check, dispose };
    }

    function apply(ctx) {
      const slots = ctx.get("slots");
      if (slots === undefined) return;
      const panel = createStatusPanel();
      function CheckUpdatesRow() {
        const [status, setStatus] = React.useState("idle");
        const [message, setMessage] = React.useState("");
        const check = async () => {
          if (status === "checking") return;
          setStatus("checking");
          setMessage("正在检查…");
          try {
            const result = await panel.check();
            setStatus("done");
            setMessage(
              result && result.available
                ? result.version
                  ? `发现新版本 ${result.version}`
                  : "发现新版本"
                : "已是最新版本",
            );
          } catch (error) {
            setStatus("error");
            setMessage(
              "检查失败：" +
                (error && error.message ? error.message : String(error)),
            );
          }
        };
        return React.createElement(
          "div",
          { style: ROW_STYLE },
          React.createElement("span", { style: LABEL_STYLE }, "检查更新"),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: check,
              disabled: status === "checking",
              style: {
                ...BUTTON_STYLE,
                ...(status === "checking"
                  ? { cursor: "default", opacity: 0.6 }
                  : {}),
              },
            },
            status === "checking" ? "检查中…" : "检查更新",
          ),
          message
            ? React.createElement("span", { style: MESSAGE_STYLE }, message)
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
          panel.dispose();
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
