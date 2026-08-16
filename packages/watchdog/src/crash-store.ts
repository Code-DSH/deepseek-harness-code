import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { validateSiblingFilePaths } from "./validation.js";

interface PersistedCrashes {
  crashes: number[];
}

export interface CrashLoopMarker {
  reason: "crash-loop";
  crashCount: number;
  openedAt: number;
}

export class CrashStore {
  readonly #statePath: string;
  readonly #markerPath: string;

  constructor(
    statePath: string,
    markerPath = join(dirname(statePath), "crash-loop.json"),
  ) {
    [this.#statePath, this.#markerPath] = validateSiblingFilePaths(
      statePath,
      markerPath,
      "crash store",
    );
  }

  recordCrash(now: number, windowMs: number): number[] {
    if (!Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) {
      throw new RangeError(
        "crash timestamps and window must be finite positive values",
      );
    }
    const crashes = this.read().filter(
      (timestamp) => now - timestamp < windowMs,
    );
    crashes.push(now);
    this.write({ crashes });
    return crashes;
  }

  openCircuit(marker: CrashLoopMarker): void {
    this.writeJson(this.#markerPath, marker);
  }

  private read(): number[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.#statePath, "utf8"));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as PersistedCrashes).crashes)
      )
        return [];
      return (parsed as PersistedCrashes).crashes.filter(
        (timestamp): timestamp is number => Number.isFinite(timestamp),
      );
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return [];
      return [];
    }
  }

  private write(value: PersistedCrashes): void {
    this.writeJson(this.#statePath, value);
  }

  private writeJson(path: string, value: object): void {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${path}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  }
}
