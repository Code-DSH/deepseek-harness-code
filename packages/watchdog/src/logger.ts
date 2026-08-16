import { appendFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { redactLogString, redactLogValue } from "./redaction.js";
import { validateAbsoluteFilePath } from "./validation.js";

export const DEFAULT_LOG_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_LOG_MAX_FILES = 5;
const MINIMUM_TRUNCATED_LINE_BYTES = Buffer.byteLength(
  `${JSON.stringify({ truncated: true })}\n`,
);

export interface LoggerOptions {
  maxBytes?: number;
  maxFiles?: number;
}

export class StructuredLogger {
  readonly #path: string;
  readonly #maxBytes: number;
  readonly #maxFiles: number;
  #pending: Promise<void> = Promise.resolve();

  constructor(path: string, options: LoggerOptions = {}) {
    this.#path = validateAbsoluteFilePath(path, "log path");
    this.#maxBytes = options.maxBytes ?? DEFAULT_LOG_MAX_BYTES;
    this.#maxFiles = options.maxFiles ?? DEFAULT_LOG_MAX_FILES;
    if (
      !Number.isInteger(this.#maxBytes) ||
      this.#maxBytes < MINIMUM_TRUNCATED_LINE_BYTES ||
      !Number.isInteger(this.#maxFiles) ||
      this.#maxFiles < 1
    ) {
      throw new RangeError("log rotation values must be positive integers");
    }
  }

  write(event: string, fields: Record<string, unknown> = {}): Promise<void> {
    const line = this.formatLine(event, fields);
    this.#pending = this.#pending
      .catch(() => undefined)
      .then(() => this.writeLine(line));
    return this.#pending;
  }

  async listFiles(): Promise<string[]> {
    await this.#pending;
    try {
      const names = await readdir(dirname(this.#path));
      const prefix = `${basename(this.#path)}.`;
      return names
        .filter(
          (name) =>
            name === basename(this.#path) ||
            (/^\d+$/.test(name.slice(prefix.length)) &&
              name.startsWith(prefix)),
        )
        .map((name) => join(dirname(this.#path), name))
        .sort((left, right) => {
          const suffix = (path: string) =>
            path === this.#path
              ? 0
              : Number(path.slice(path.lastIndexOf(".") + 1));
          return suffix(left) - suffix(right);
        });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return [];
      throw error;
    }
  }

  private async writeLine(line: string): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    const bytes = Buffer.byteLength(line);
    try {
      const current = await stat(this.#path);
      if (current.size + bytes > this.#maxBytes) await this.rotate();
    } catch (error: unknown) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        )
      )
        throw error;
    }
    await appendFile(this.#path, line, { encoding: "utf8", mode: 0o600 });
  }

  private formatLine(event: string, fields: Record<string, unknown>): string {
    const safeEvent = redactLogString(event);
    const line = `${JSON.stringify(redactLogValue({ ...fields, event: safeEvent }))}\n`;
    if (Buffer.byteLength(line) <= this.#maxBytes) return line;

    const truncatedWithEvent = `${JSON.stringify({ event: safeEvent, truncated: true })}\n`;
    if (Buffer.byteLength(truncatedWithEvent) <= this.#maxBytes)
      return truncatedWithEvent;
    return `${JSON.stringify({ truncated: true })}\n`;
  }

  private async rotate(): Promise<void> {
    await rm(`${this.#path}.${this.#maxFiles - 1}`, { force: true });
    for (let index = this.#maxFiles - 2; index >= 1; index -= 1) {
      try {
        await rename(`${this.#path}.${index}`, `${this.#path}.${index + 1}`);
      } catch (error: unknown) {
        if (
          !(
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      }
    }
    await rename(this.#path, `${this.#path}.1`);
  }
}
