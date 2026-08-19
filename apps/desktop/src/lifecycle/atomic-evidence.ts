import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";

type AtomicEvidenceDependencies = {
  readonly createNonce?: () => string;
  readonly rename?: (source: string, destination: string) => Promise<void>;
};

export async function writeEvidenceAtomically(
  path: string,
  value: unknown,
  dependencies: AtomicEvidenceDependencies = {},
): Promise<void> {
  await assertRegularFileOrMissing(path, "evidence path");
  const nonce = dependencies.createNonce?.() ?? randomBytes(16).toString("hex");
  const temporaryPath = `${path}.${nonce}.tmp`;
  await assertRegularFileOrMissing(temporaryPath, "evidence temporary path");

  let created = false;
  try {
    const handle = await open(
      temporaryPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
      await handle.sync();
      const [openedInfo, pathInfo] = await Promise.all([
        handle.stat(),
        lstat(temporaryPath),
      ]);
      if (
        pathInfo.isSymbolicLink() ||
        !pathInfo.isFile() ||
        openedInfo.dev !== pathInfo.dev ||
        openedInfo.ino !== pathInfo.ino
      ) {
        throw new Error("evidence temporary path changed during write");
      }
    } finally {
      await handle.close();
    }

    await assertRegularFileOrMissing(path, "evidence path");
    await (dependencies.rename ?? rename)(temporaryPath, path);
    created = false;
  } finally {
    if (created) {
      await unlink(temporaryPath).catch((error: unknown) => {
        if (!isMissingPathError(error)) throw error;
      });
    }
  }
}

async function assertRegularFileOrMissing(
  path: string,
  label: string,
): Promise<void> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`${label} is a symbolic link`);
    if (!info.isFile()) throw new Error(`${label} is not a regular file`);
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
