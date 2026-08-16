import type { MenuItemConstructorOptions } from "electron";

export interface ApplicationMenuActions {
  open(): void;
  publishStatus(): void;
  restartHarness(): void;
  openLogs(): void;
  quit(): void;
  pasteFocused(): void;
}

export interface ShortcutInput {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
}

export function isMacControlPaste(
  platform: NodeJS.Platform,
  input: ShortcutInput,
): boolean {
  return (
    platform === "darwin" &&
    input.type === "keyDown" &&
    input.control &&
    !input.meta &&
    input.key.toLowerCase() === "v"
  );
}

export function createApplicationMenuTemplate(
  platform: NodeJS.Platform,
  actions: ApplicationMenuActions,
): MenuItemConstructorOptions[] {
  const editMenu: MenuItemConstructorOptions[] = [
    { role: "undo" },
    { role: "redo" },
    { type: "separator" },
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    ...(platform === "darwin"
      ? [
          {
            label: "Paste with Control+V",
            accelerator: "Control+V",
            acceleratorWorksWhenHidden: true,
            visible: false,
            click: actions.pasteFocused,
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    { role: "pasteAndMatchStyle" },
    { role: "delete" },
    { type: "separator" },
    { role: "selectAll" },
  ];

  return [
    {
      label: "DeepSeek Harness Code",
      submenu: [
        { label: "Open", click: actions.open },
        { label: "Status", click: actions.publishStatus },
        { label: "Restart Harness", click: actions.restartHarness },
        { label: "Open Logs", click: actions.openLogs },
        { type: "separator" },
        { label: "Quit", click: actions.quit },
      ],
    },
    { label: "Edit", submenu: editMenu },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
  ];
}
