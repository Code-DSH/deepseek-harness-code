import { validateLaunchTarget, validatePathWithinRoot } from "./validation.js";

export interface WatchdogCommandLine {
  executable: string;
  args: string[];
  statePath: string;
  markerPath: string;
  logPath: string;
}

const REQUIRED_OPTIONS = new Set([
  "--target-executable",
  "--target-args-json",
  "--state-path",
  "--marker-path",
  "--log-path",
  "--root-path",
]);

export function parseWatchdogCommandLine(
  argv: readonly string[],
): WatchdogCommandLine {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      !key ||
      !REQUIRED_OPTIONS.has(key) ||
      value === undefined ||
      values.has(key)
    ) {
      throw new TypeError(
        "all watchdog startup arguments are required and must be unique",
      );
    }
    values.set(key, value);
  }
  if (values.size !== REQUIRED_OPTIONS.size)
    throw new TypeError("all watchdog startup arguments are required");

  const executable = values.get("--target-executable")!;
  const serializedArgs = values.get("--target-args-json")!;
  const rootPath = values.get("--root-path")!;
  let args: unknown;
  try {
    args = JSON.parse(serializedArgs);
  } catch {
    throw new TypeError("target arguments must be JSON");
  }
  const target = validateLaunchTarget(executable, args);
  return {
    executable: target.executable,
    args: [...target.args],
    statePath: validatePathWithinRoot(
      rootPath,
      values.get("--state-path"),
      "state path",
    ),
    markerPath: validatePathWithinRoot(
      rootPath,
      values.get("--marker-path"),
      "marker path",
    ),
    logPath: validatePathWithinRoot(
      rootPath,
      values.get("--log-path"),
      "log path",
    ),
  };
}
