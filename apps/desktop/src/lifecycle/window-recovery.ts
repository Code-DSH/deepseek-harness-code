export interface RecoverableWindow {
  destroy(): void;
  loadURL(url: string): Promise<unknown> | void;
}

/** Replace a failed renderer without ever leaving Electron with zero windows. */
export function replaceWindowKeepingHostAlive<T extends RecoverableWindow>(
  oldWindow: RecoverableWindow | undefined,
  createWindow: () => T,
  origin: string,
): T {
  const freshWindow = createWindow();
  oldWindow?.destroy();
  if (origin !== "") void freshWindow.loadURL(origin);
  return freshWindow;
}
