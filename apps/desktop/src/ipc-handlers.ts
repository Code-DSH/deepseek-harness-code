import {
  appInfoSchema,
  desktopPreferencesSchema,
  desktopPreferencesStateSchema,
  lanAccessCopySchema,
  lanAccessSetSchema,
  lanAccessStateSchema,
  runtimeStateSchema,
  type BundledPluginEntry,
  type DesktopPreferences,
  type DesktopPreferencesState,
  type LanAccessSet,
  type LanAccessCopy,
  type LanAccessState,
  type RuntimeState,
  type UpdaterCheckOutcome,
} from "./shared/contracts.js";

export interface MainIpc {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown,
  ): void;
  on(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown,
  ): void;
}

export interface PasteTarget {
  paste(): void;
}

export interface DesktopIpcActions {
  getAppInfo(): { name: string; version: string };
  getRuntimeState(): RuntimeState;
  restartHarness(): Promise<void>;
  openLogs(): Promise<void>;
  getPreferences(): DesktopPreferencesState;
  setPreferences(value: DesktopPreferences): Promise<void>;
  getLanAccess(): LanAccessState;
  setLanAccess(value: LanAccessSet): Promise<LanAccessState>;
  copyLanAccessUrl(value: LanAccessCopy): Promise<void>;
  paste(target: PasteTarget): void;
  checkForUpdates(): Promise<UpdaterCheckOutcome>;
  applyUpdate(): Promise<UpdaterCheckOutcome>;
  restartForUpdate(): Promise<void>;
  listBundledPlugins(): BundledPluginEntry[];
}

function isPasteTarget(value: unknown): value is PasteTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "paste" in value &&
    typeof value.paste === "function"
  );
}

export function registerDesktopIpc(
  ipc: MainIpc,
  actions: DesktopIpcActions,
): void {
  ipc.handle("runtime:get", () =>
    runtimeStateSchema.parse(actions.getRuntimeState()),
  );
  ipc.handle("app:info", () => appInfoSchema.parse(actions.getAppInfo()));
  ipc.handle("runtime:restart", () => actions.restartHarness());
  ipc.handle("updater:check", () => actions.checkForUpdates());
  ipc.handle("updater:apply", () => actions.applyUpdate());
  ipc.handle("updater:restart", () => actions.restartForUpdate());
  ipc.handle("bundled-plugins:list", () => actions.listBundledPlugins());
  ipc.handle("logs:open", () => actions.openLogs());
  ipc.handle("preferences:get", () =>
    desktopPreferencesStateSchema.parse(actions.getPreferences()),
  );
  ipc.handle("preferences:set", async (_event, payload) =>
    actions.setPreferences(desktopPreferencesSchema.parse(payload)),
  );
  ipc.handle("lan-access:get", () =>
    lanAccessStateSchema.parse(actions.getLanAccess()),
  );
  ipc.handle("lan-access:set", async (_event, payload) =>
    lanAccessStateSchema.parse(
      await actions.setLanAccess(lanAccessSetSchema.parse(payload)),
    ),
  );
  ipc.handle("lan-access:copy-url", (_event, payload) =>
    actions.copyLanAccessUrl(
      lanAccessCopySchema.parse(payload === undefined ? {} : payload),
    ),
  );
  ipc.on("clipboard:paste", (event) => {
    const sender =
      typeof event === "object" && event !== null && "sender" in event
        ? event.sender
        : undefined;
    if (isPasteTarget(sender)) actions.paste(sender);
  });
}
