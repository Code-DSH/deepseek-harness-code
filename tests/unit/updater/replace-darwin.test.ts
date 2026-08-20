import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDarwinHelperScript,
  findExtractedAppBasename,
  resolveDarwinInstallPaths,
} from "../../../apps/desktop/src/updater/replace/darwin.js";

const EXEC =
  "/Applications/DeepSeek Harness Code.app/Contents/MacOS/DeepSeek Harness Code";

describe("updater/replace/darwin resolveDarwinInstallPaths", () => {
  it("walks execPath up to the .app bundle root and install dir", () => {
    const paths = resolveDarwinInstallPaths(EXEC);
    expect(paths.appName).toBe("DeepSeek Harness Code.app");
    expect(paths.bundlePath).toBe("/Applications/DeepSeek Harness Code.app");
    expect(paths.installDir).toBe("/Applications");
  });

  it("uses / when the app lives at the filesystem root", () => {
    const paths = resolveDarwinInstallPaths(
      "/DeepSeek Harness Code.app/Contents/MacOS/DeepSeek Harness Code",
    );
    expect(paths.installDir).toBe("/");
    expect(paths.appName).toBe("DeepSeek Harness Code.app");
  });

  it("rejects a DMG mount under /Volumes", () => {
    expect(() =>
      resolveDarwinInstallPaths(
        "/Volumes/DeepSeek Harness Code/DeepSeek Harness Code.app/Contents/MacOS/DeepSeek Harness Code",
      ),
    ).toThrow(/transient path/);
  });

  it("rejects Gatekeeper translocation under /private/tmp", () => {
    expect(() =>
      resolveDarwinInstallPaths(
        "/private/tmp/AppTranslocation/DeepSeek Harness Code.app/Contents/MacOS/DeepSeek Harness Code",
      ),
    ).toThrow(/transient path/);
  });

  it("rejects a path that is not inside a .app bundle", () => {
    expect(() => resolveDarwinInstallPaths("/usr/local/bin/node")).toThrow(
      /not running from a .app bundle/,
    );
  });
});

describe("updater/replace/darwin buildDarwinHelperScript", () => {
  it("embeds the PID and wait loop, swap, quarantine clear, relaunch, and rollback", () => {
    const script = buildDarwinHelperScript({
      pid: 12345,
      newAppPath: "/tmp/staging/DeepSeek Harness Code.app",
      installDir: "/Applications",
      appName: "DeepSeek Harness Code.app",
    });
    expect(script).toContain("PID=12345");
    expect(script).toContain('while kill -0 "$PID" 2>/dev/null');
    expect(script).toContain('mv "$APP_NAME" "$APP_NAME.old"');
    expect(script).toContain('xattr -cr "$APP_NAME"');
    expect(script).toContain('open "$INSTALL_DIR/$APP_NAME"');
    // Rollback branch restores the old bundle if the move fails.
    expect(script).toMatch(
      /mv "\$APP_NAME\.old" "\$APP_NAME" 2>\/dev\/null \|\| true\n\s{2}open/,
    );
    // Paths with spaces are JSON-quoted for bash.
    expect(script).toContain('APP_NAME="DeepSeek Harness Code.app"');
  });
});

describe("updater/replace/darwin findExtractedAppBasename", () => {
  let dir: string;
  beforeEach(() => {
    dir = join(
      tmpdir(),
      `dsh-replace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dir, { recursive: true });
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the single .app entry in the staging dir", () => {
    mkdirSync(join(dir, "DeepSeek Harness Code.app", "Contents", "MacOS"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "DeepSeek Harness Code.app", "Contents", "Info.plist"),
      "x",
    );
    writeFileSync(join(dir, "stray.txt"), "y");
    expect(findExtractedAppBasename(dir)).toBe("DeepSeek Harness Code.app");
  });

  it("throws when no .app was extracted", () => {
    writeFileSync(join(dir, "not-an-app.txt"), "z");
    expect(() => findExtractedAppBasename(dir)).toThrow(
      /no \.app bundle found/,
    );
  });
});
