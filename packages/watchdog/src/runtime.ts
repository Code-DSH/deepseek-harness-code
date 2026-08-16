import { spawn } from "node:child_process";

export interface DiagnosticWriter {
  write(event: string, fields?: Record<string, unknown>): Promise<void>;
}

export interface RelaunchedChild {
  unref(): void;
  once?(event: "error", listener: () => void): unknown;
}

export interface RelaunchSpawnOptions {
  detached: true;
  env: NodeJS.ProcessEnv;
  shell: false;
  stdio: "ignore";
}

export type RelaunchSpawn = (
  executable: string,
  args: readonly string[],
  options: RelaunchSpawnOptions,
) => RelaunchedChild;

const spawnDetached: RelaunchSpawn = (executable, args, options) =>
  spawn(executable, [...args], options);

export function createRelaunch(
  logger: DiagnosticWriter,
  spawnProcess: RelaunchSpawn = spawnDetached,
) {
  return (executable: string, args: readonly string[]): void => {
    writeSafely(logger, "relaunch", { executable, argvCount: args.length });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    try {
      const child = spawnProcess(executable, [...args], {
        detached: true,
        env,
        shell: false,
        stdio: "ignore",
      });
      child.once?.("error", () =>
        writeSafely(logger, "relaunch-failed", { reason: "spawn-error" }),
      );
      child.unref();
    } catch {
      writeSafely(logger, "relaunch-failed", { reason: "spawn-error" });
    }
  };
}

function writeSafely(
  logger: DiagnosticWriter,
  event: string,
  fields: Record<string, unknown>,
): void {
  void Promise.resolve()
    .then(() => logger.write(event, fields))
    .catch(() => undefined);
}
