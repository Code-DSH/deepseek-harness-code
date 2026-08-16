import { contextBridge, ipcRenderer } from "electron";

import {
  createDesktopBridge,
  installPasteShortcut,
  type PasteShortcutTarget,
} from "./preload-api.js";

contextBridge.exposeInMainWorld(
  "deepseekDesktop",
  createDesktopBridge({
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) =>
      ipcRenderer.removeListener(channel, listener),
  }),
);

installPasteShortcut(
  process.platform,
  window as unknown as PasteShortcutTarget,
  () => ipcRenderer.send("clipboard:paste"),
);
