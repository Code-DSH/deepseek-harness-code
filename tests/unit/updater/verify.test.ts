import { createHash } from "node:crypto";
import { rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  computeSha256,
  verifySha256,
} from "../../../apps/desktop/src/updater/verify.js";

describe("updater/verify", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(
      tmpdir(),
      `updater-verify-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("computeSha256 matches node crypto for the same bytes", async () => {
    const path = join(dir, "f.bin");
    const bytes = Buffer.from("hello updater");
    await writeFile(path, bytes);
    const expected = createHash("sha256").update(bytes).digest("hex");
    expect(await computeSha256(path)).toBe(expected);
  });

  it("verifySha256 returns true for the correct digest (any case)", async () => {
    const path = join(dir, "f.bin");
    const bytes = Buffer.from("payload");
    await writeFile(path, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(await verifySha256(path, digest)).toBe(true);
    expect(await verifySha256(path, digest.toUpperCase())).toBe(true);
  });

  it("verifySha256 returns false for a wrong digest", async () => {
    const path = join(dir, "f.bin");
    await writeFile(path, Buffer.from("payload"));
    expect(await verifySha256(path, "0".repeat(64))).toBe(false);
  });
});
