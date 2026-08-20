import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Stream a file through sha256 and return the hex digest. */
export async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback();
    },
  });
  await pipeline(createReadStream(filePath), sink);
  return hash.digest("hex");
}

/** True when the file's sha256 matches the expected digest (case-insensitive). */
export async function verifySha256(
  filePath: string,
  expected: string,
): Promise<boolean> {
  const actual = await computeSha256(filePath);
  return actual.toLowerCase() === expected.trim().toLowerCase();
}
