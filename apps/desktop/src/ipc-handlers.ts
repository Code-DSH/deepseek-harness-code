import {
  desktopPreferencesSchema,
  desktopPreferencesStateSchema,
  runtimeStateSchema,
  type DesktopPreferences,
  type DesktopPreferencesState,
  type RuntimeState,
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
  getRuntimeState(): RuntimeState;
  restartHarness(): Promise<void>;
  openLogs(): Promise<void>;
  getPreferences(): DesktopPreferencesState;
  setPreferences(value: DesktopPreferences): Promise<void>;
  paste(target: PasteTarget): void;
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
  ipc.handle("runtime:restart", () => actions.restartHarness());
  ipc.handle("logs:open", () => actions.openLogs());
  ipc.handle("preferences:get", () =>
    desktopPreferencesStateSchema.parse(actions.getPreferences()),
  );
  ipc.handle("preferences:set", async (_event, payload) =>
    actions.setPreferences(desktopPreferencesSchema.parse(payload)),
  );
  ipc.on("clipboard:paste", (event) => {
    const sender =
      typeof event === "object" && event !== null && "sender" in event
        ? event.sender
        : undefined;
    if (isPasteTarget(sender)) actions.paste(sender);
  });
}
