import {
  desktopPreferencesSchema,
  desktopPreferencesStateSchema,
  lanAccessSetSchema,
  lanAccessStateSchema,
  runtimeStateSchema,
  type BundledPluginEntry,
  type DeepSeekDesktopBridge,
  type UpdaterCheckOutcome,
} from "./shared/contracts.js";

export interface RendererIpc {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ): void;
  removeListener(
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ): void;
}

export interface PasteShortcutEvent {
  type: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  readonly isTrusted: boolean;
  preventDefault(): void;
}

export interface PasteShortcutTarget {
  addEventListener(
    type: "keydown",
    listener: (event: PasteShortcutEvent) => void,
    capture: boolean,
  ): void;
  removeEventListener(
    type: "keydown",
    listener: (event: PasteShortcutEvent) => void,
    capture: boolean,
  ): void;
}

export function installPasteShortcut(
  platform: NodeJS.Platform,
  target: PasteShortcutTarget,
  sendPaste: () => void,
): () => void {
  const onKeyDown = (event: PasteShortcutEvent) => {
    if (
      !event.isTrusted ||
      platform !== "darwin" ||
      !event.ctrlKey ||
      event.metaKey ||
      event.key.toLowerCase() !== "v"
    ) {
      return;
    }
    event.preventDefault();
    sendPaste();
  };
  target.addEventListener("keydown", onKeyDown, true);
  return () => target.removeEventListener("keydown", onKeyDown, true);
}

export function createDesktopBridge(ipc: RendererIpc): DeepSeekDesktopBridge {
  return {
    preferences: {
      async get() {
        return desktopPreferencesStateSchema.parse(
          await ipc.invoke("preferences:get"),
        );
      },
      async set(value) {
        await ipc.invoke(
          "preferences:set",
          desktopPreferencesSchema.parse(value),
        );
      },
    },
    lanAccess: {
      async get() {
        return lanAccessStateSchema.parse(await ipc.invoke("lan-access:get"));
      },
      async set(value) {
        return lanAccessStateSchema.parse(
          await ipc.invoke("lan-access:set", lanAccessSetSchema.parse(value)),
        );
      },
      async copyUrl() {
        await ipc.invoke("lan-access:copy-url");
      },
    },
    runtime: {
      async getState() {
        return runtimeStateSchema.parse(await ipc.invoke("runtime:get"));
      },
      async restartHarness() {
        await ipc.invoke("runtime:restart");
      },
      async openLogs() {
        await ipc.invoke("logs:open");
      },
      subscribe(listener) {
        const wrapped = (_event: unknown, payload: unknown) =>
          listener(runtimeStateSchema.parse(payload));
        ipc.on("runtime:changed", wrapped);
        return () => ipc.removeListener("runtime:changed", wrapped);
      },
    },
    updater: {
      async check() {
        return (await ipc.invoke("updater:check")) as UpdaterCheckOutcome;
      },
    },
    bundledPlugins: {
      async list() {
        return (await ipc.invoke(
          "bundled-plugins:list",
        )) as BundledPluginEntry[];
      },
    },
  };
}
