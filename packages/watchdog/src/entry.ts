import { parseWatchdogCommandLine } from "./command-line.js";
import { CrashStore } from "./crash-store.js";
import { StructuredLogger } from "./logger.js";
import { createRelaunch } from "./runtime.js";
import { Watchdog } from "./watchdog.js";

export function runWatchdog(argv: readonly string[]): Watchdog {
  const options = parseWatchdogCommandLine(argv);
  const logger = new StructuredLogger(options.logPath);
  const watchdog = new Watchdog({
    executable: options.executable,
    args: options.args,
    crashStore: new CrashStore(options.statePath, options.markerPath),
    launch: createRelaunch(logger),
    notify: (message) => {
      try {
        if (process.connected) process.send?.(message);
      } catch {
        // Parent IPC is already unavailable; shutdown continues without an acknowledgement.
      }
    },
  });
  process.on("message", (message) => watchdog.receive(message));
  process.once("disconnect", () => watchdog.disconnect());
  return watchdog;
}

runWatchdog(process.argv.slice(2));
