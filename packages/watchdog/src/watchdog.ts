import { RecoveryPolicy, type RecoveryDecision } from "./recovery-policy.js";
import { CrashStore } from "./crash-store.js";
import { validateLaunchTarget } from "./validation.js";

export type Schedule = (callback: () => void, delayMs: number) => unknown;
export type Launch = (executable: string, args: readonly string[]) => void;
export type Notify = (message: "shutdown-ack") => void;
export type Exit = (code: number) => void;

export interface WatchdogOptions {
  executable: string;
  args: readonly string[];
  crashStore: CrashStore;
  now?: () => number;
  schedule?: Schedule;
  launch: Launch;
  notify?: Notify;
  exit?: Exit;
}

export class Watchdog {
  readonly #executable: string;
  readonly #args: readonly string[];
  readonly #crashStore: CrashStore;
  readonly #now: () => number;
  readonly #schedule: Schedule;
  readonly #launch: Launch;
  readonly #notify: Notify | undefined;
  readonly #exit: Exit;
  #normalShutdown = false;
  #disconnected = false;

  constructor(options: WatchdogOptions) {
    const target = validateLaunchTarget(options.executable, options.args);
    this.#executable = target.executable;
    this.#args = target.args;
    this.#crashStore = options.crashStore;
    this.#now = options.now ?? Date.now;
    this.#schedule =
      options.schedule ??
      ((callback, delayMs) => setTimeout(callback, delayMs));
    this.#launch = options.launch;
    this.#notify = options.notify;
    this.#exit = options.exit ?? ((code) => process.exit(code));
  }

  receive(message: unknown): void {
    if (message === "shutdown") {
      this.#normalShutdown = true;
      this.#notify?.("shutdown-ack");
    }
  }

  disconnect(): void {
    if (this.#disconnected) return;
    this.#disconnected = true;
    if (this.#normalShutdown) return;

    const now = this.#now();
    const crashes = this.#crashStore.recordCrash(now, 300_000);
    const policy = new RecoveryPolicy({ windowMs: 300_000, limit: 3 });
    let decision: RecoveryDecision = { action: "restart", delayMs: 5_000 };
    for (const crash of crashes) decision = policy.recordCrash(crash);
    if (decision.action === "open-circuit") {
      this.#crashStore.openCircuit({
        reason: "crash-loop",
        crashCount: crashes.length,
        openedAt: now,
      });
      this.#exit(0);
      return;
    }
    this.#schedule(
      () => {
        this.#launch(this.#executable, [...this.#args]);
        this.#exit(0);
      },
      decision.delayMs,
    );
  }
}
