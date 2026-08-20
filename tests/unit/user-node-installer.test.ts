import { posix, win32 } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPathExport,
  buildProfileMarker,
  getInstallDir,
  getNodeBinaryPath,
  getShellProfilePath,
  hasProfileMarker,
} from "../../apps/desktop/src/lifecycle/user-node-installer.js";

const VERSION = "22.13.0";
const DARWIN_HOME = "/Users/test";
const LINUX_HOME = "/home/test";
const WIN_HOME = "C:\\Users\\test";

describe("getInstallDir", () => {
  it("returns ~/.local/share/dsh-node/<version> on macOS", () => {
    expect(getInstallDir("darwin", DARWIN_HOME, VERSION)).toBe(
      posix.join(DARWIN_HOME, ".local", "share", "dsh-node", `v${VERSION}`),
    );
  });

  it("returns ~/.local/share/dsh-node/<version> on Linux", () => {
    expect(getInstallDir("linux", LINUX_HOME, VERSION)).toBe(
      posix.join(LINUX_HOME, ".local", "share", "dsh-node", `v${VERSION}`),
    );
  });

  it("returns %LOCALAPPDATA%\\dsh-node\\<version> on Windows", () => {
    const localAppData = win32.join(WIN_HOME, "AppData", "Local");
    expect(getInstallDir("win32", WIN_HOME, VERSION, localAppData)).toBe(
      win32.join(localAppData, "dsh-node", `v${VERSION}`),
    );
  });
});

describe("getNodeBinaryPath", () => {
  it("returns <installDir>/bin/node on unix", () => {
    const installDir = posix.join(
      DARWIN_HOME,
      ".local",
      "share",
      "dsh-node",
      `v${VERSION}`,
    );
    expect(getNodeBinaryPath("darwin", installDir)).toBe(
      posix.join(installDir, "bin", "node"),
    );
  });

  it("returns <installDir>\\node.exe on Windows", () => {
    const installDir = win32.join(
      WIN_HOME,
      "AppData",
      "Local",
      "dsh-node",
      `v${VERSION}`,
    );
    expect(getNodeBinaryPath("win32", installDir)).toBe(
      win32.join(installDir, "node.exe"),
    );
  });
});

describe("buildPathExport", () => {
  it("produces an export line with the bin dir on unix", () => {
    const installDir = posix.join(
      DARWIN_HOME,
      ".local",
      "share",
      "dsh-node",
      `v${VERSION}`,
    );
    const line = buildPathExport(installDir);
    expect(line).toContain(`v${VERSION}/bin`);
    expect(line).toMatch(/^export PATH=/);
    expect(line).toContain("$PATH");
  });
});

describe("getShellProfilePath", () => {
  it("returns ~/.zshrc when SHELL is zsh", () => {
    expect(
      getShellProfilePath("darwin", DARWIN_HOME, { SHELL: "/bin/zsh" }),
    ).toBe(posix.join(DARWIN_HOME, ".zshrc"));
  });

  it("returns ~/.bashrc when SHELL is bash", () => {
    expect(
      getShellProfilePath("linux", LINUX_HOME, { SHELL: "/bin/bash" }),
    ).toBe(posix.join(LINUX_HOME, ".bashrc"));
  });

  it("returns ~/.profile as fallback when SHELL is not set", () => {
    expect(getShellProfilePath("linux", LINUX_HOME, {})).toBe(
      posix.join(LINUX_HOME, ".profile"),
    );
  });

  it("returns undefined on Windows (registry is used instead)", () => {
    expect(getShellProfilePath("win32", WIN_HOME, {})).toBeUndefined();
  });
});

describe("profile marker", () => {
  it("builds a marker containing the version", () => {
    const marker = buildProfileMarker(VERSION);
    expect(marker).toContain(VERSION);
    expect(marker).toContain("dsh-node");
  });

  it("detects the marker in existing profile content", () => {
    const marker = buildProfileMarker(VERSION);
    const content = `export PATH="/usr/bin:$PATH"\n${marker}\nexport PATH="$HOME/.local/share/dsh-node/v${VERSION}/bin:$PATH"\n# <<< dsh-node v${VERSION} <<<\n`;
    expect(hasProfileMarker(content, VERSION)).toBe(true);
  });

  it("returns false when the marker for a different version is present", () => {
    const content = `# >>> dsh-node v99.0.0 >>>\nexport PATH="...:$PATH"\n# <<< dsh-node v99.0.0 <<<\n`;
    expect(hasProfileMarker(content, VERSION)).toBe(false);
  });

  it("returns false for a profile without any marker", () => {
    expect(hasProfileMarker("export PATH=/usr/bin:$PATH\n", VERSION)).toBe(
      false,
    );
  });
});
