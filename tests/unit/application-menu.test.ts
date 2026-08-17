import { describe, expect, it, vi } from "vitest";

import {
  createApplicationMenuTemplate,
  isMacControlPaste,
} from "../../apps/desktop/src/application-menu.js";

function roles(template: ReturnType<typeof createApplicationMenuTemplate>) {
  const edit = template.find((item) => item.label === "Edit");
  if (!Array.isArray(edit?.submenu)) throw new Error("Edit menu is missing");
  return edit.submenu.map((item) => item.role).filter(Boolean);
}

describe("desktop application menu", () => {
  it.each(["darwin", "win32", "linux"] as const)(
    "provides native edit commands on %s",
    (platform) => {
      const template = createApplicationMenuTemplate(platform, {
        open: vi.fn(),
        publishStatus: vi.fn(),
        restartHarness: vi.fn(),
        openLogs: vi.fn(),
        adoptBundledGlobalPrompt: vi.fn(),
        quit: vi.fn(),
        pasteFocused: vi.fn(),
      });

      expect(roles(template)).toEqual(
        expect.arrayContaining([
          "undo",
          "redo",
          "cut",
          "copy",
          "paste",
          "selectAll",
        ]),
      );
    },
  );

  it("adds Control+V as a macOS paste alias while retaining the native paste role", () => {
    const pasteFocused = vi.fn();
    const template = createApplicationMenuTemplate("darwin", {
      open: vi.fn(),
      publishStatus: vi.fn(),
      restartHarness: vi.fn(),
      openLogs: vi.fn(),
      adoptBundledGlobalPrompt: vi.fn(),
      quit: vi.fn(),
      pasteFocused,
    });
    const edit = template.find((item) => item.label === "Edit");
    if (!Array.isArray(edit?.submenu)) throw new Error("Edit menu is missing");
    const alias = edit.submenu.find((item) => item.accelerator === "Control+V");

    expect(alias?.label).toBe("Paste with Control+V");
    expect(alias?.visible).toBe(false);
    alias?.click?.({} as never, {} as never, {} as never);
    expect(pasteFocused).toHaveBeenCalledOnce();
  });

  it("offers the bundled global prompt switch in the app menu", () => {
    const adoptBundledGlobalPrompt = vi.fn();
    const template = createApplicationMenuTemplate("darwin", {
      open: vi.fn(),
      publishStatus: vi.fn(),
      restartHarness: vi.fn(),
      openLogs: vi.fn(),
      adoptBundledGlobalPrompt,
      quit: vi.fn(),
      pasteFocused: vi.fn(),
    });
    const appMenu = template.find(
      (item) => item.label === "DeepSeek Harness Code",
    );
    if (!Array.isArray(appMenu?.submenu))
      throw new Error("App menu is missing");
    const promptItem = appMenu.submenu.find(
      (item) => item.label === "Use Bundled Global Prompt…",
    );

    expect(promptItem).toBeDefined();
    promptItem?.click?.({} as never, {} as never, {} as never);
    expect(adoptBundledGlobalPrompt).toHaveBeenCalledOnce();
  });

  it("keeps standard window commands so the desktop menu bar is not empty", () => {
    const template = createApplicationMenuTemplate("darwin", {
      open: vi.fn(),
      publishStatus: vi.fn(),
      restartHarness: vi.fn(),
      openLogs: vi.fn(),
      adoptBundledGlobalPrompt: vi.fn(),
      quit: vi.fn(),
      pasteFocused: vi.fn(),
    });
    const windowMenu = template.find((item) => item.role === "window");

    expect(windowMenu).toBeDefined();
  });

  it("recognizes only the additional macOS Control+V paste chord", () => {
    const controlV = {
      type: "keyDown",
      key: "v",
      control: true,
      meta: false,
    };

    expect(isMacControlPaste("darwin", controlV)).toBe(true);
    expect(isMacControlPaste("win32", controlV)).toBe(false);
    expect(isMacControlPaste("linux", controlV)).toBe(false);
    expect(
      isMacControlPaste("darwin", { ...controlV, control: false, meta: true }),
    ).toBe(false);
    expect(isMacControlPaste("darwin", { ...controlV, key: "c" })).toBe(false);
  });
});
