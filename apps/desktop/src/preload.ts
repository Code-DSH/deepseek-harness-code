import { contextBridge, ipcRenderer } from "electron";

import {
  createDesktopBridge,
  installPasteShortcut,
  type PasteShortcutTarget,
} from "./preload-api.js";

function installUpdaterOverlay(): void {
  const bridge = window.deepseekDesktop;
  if (bridge === undefined) return;

  const root = document.createElement("section");
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
    "background:rgba(255,255,255,.97)",
    "box-shadow:0 12px 40px rgba(0,0,0,.18)",
    "font:14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "color:#151515",
  ].join(";");
  const title = document.createElement("strong");
  const message = document.createElement("div");
  message.style.cssText = "margin-top:8px;line-height:1.5;white-space:pre-wrap";
  const progress = document.createElement("progress");
  progress.max = 100;
  progress.value = 0;
  progress.style.cssText = "width:100%;margin-top:14px";
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:8px;justify-content:flex-end;margin-top:14px";
  const primary = document.createElement("button");
  const secondary = document.createElement("button");
  actions.append(primary, secondary);
  root.append(title, message, progress, actions);
  document.documentElement.append(root);

  const hide = () => {
    root.style.display = "none";
  };
  secondary.onclick = hide;
  primary.onclick = () => {
    if (primary.dataset.action === "apply") {
      primary.disabled = true;
      void bridge.updater.apply();
    } else if (primary.dataset.action === "restart") {
      primary.disabled = true;
      void bridge.updater.restart();
    }
  };

  bridge.updater.subscribe((status) => {
    root.style.display = "block";
    primary.disabled = false;
    progress.style.display = "none";
    secondary.textContent = "稍后";
    primary.style.display = "inline-block";
    if (status.phase === "checking") {
      title.textContent = "正在检查更新";
      message.textContent = "正在获取最新版本信息…";
      primary.style.display = "none";
      secondary.textContent = "隐藏";
    } else if (status.phase === "available") {
      title.textContent = `发现新版本 ${status.version ?? ""}`;
      message.textContent = status.notes || "现在下载并安装更新？";
      primary.textContent = "下载更新";
      primary.dataset.action = "apply";
    } else if (status.phase === "downloading") {
      title.textContent = "正在下载更新";
      const percent = status.totalBytes
        ? Math.min(
            100,
            ((status.downloadedBytes ?? 0) / status.totalBytes) * 100,
          )
        : 0;
      message.textContent = `${Math.round(percent)}% · 更新完成后可重启应用`;
      progress.style.display = "block";
      progress.value = percent;
      primary.style.display = "none";
      secondary.textContent = "后台下载";
    } else if (status.phase === "verifying") {
      title.textContent = "正在校验更新";
      message.textContent = "正在验证下载文件完整性，请稍候…";
      primary.style.display = "none";
      secondary.textContent = "请稍候";
    } else if (status.phase === "ready-to-restart") {
      title.textContent = "更新已准备好";
      message.textContent = "更新文件已下载并验证完成。重启应用后生效。";
      primary.textContent = "重启并完成更新";
      primary.dataset.action = "restart";
      secondary.textContent = "稍后重启";
    } else if (status.phase === "up-to-date") {
      title.textContent = "已是最新版本";
      message.textContent = "当前应用已经是最新版本。";
      primary.style.display = "none";
      secondary.textContent = "关闭";
      window.setTimeout(hide, 2400);
    } else if (status.phase === "failed") {
      title.textContent = "更新失败";
      message.textContent = status.error ?? "更新过程中发生未知错误。";
      primary.style.display = "none";
      secondary.textContent = "关闭";
    }
  });
}

contextBridge.exposeInMainWorld(
  "deepseekDesktop",
  createDesktopBridge({
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) =>
      ipcRenderer.removeListener(channel, listener),
  }),
);

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", installUpdaterOverlay, {
    once: true,
  });
} else {
  installUpdaterOverlay();
}

installPasteShortcut(
  process.platform,
  window as unknown as PasteShortcutTarget,
  () => ipcRenderer.send("clipboard:paste"),
);
