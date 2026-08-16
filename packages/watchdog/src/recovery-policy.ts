export interface RecoveryPolicyOptions {
  windowMs: number;
  limit: number;
}

export type RecoveryDecision =
  | { action: "restart"; delayMs: number }
  | { action: "open-circuit" };

export class RecoveryPolicy {
  readonly #windowMs: number;
  readonly #limit: number;
  #crashes: number[] = [];

  constructor(options: RecoveryPolicyOptions) {
    if (options.windowMs <= 0 || options.limit < 1) {
      throw new RangeError("Recovery policy values must be positive");
    }
    this.#windowMs = options.windowMs;
    this.#limit = options.limit;
  }

  recordCrash(now: number): RecoveryDecision {
    this.#crashes = this.#crashes.filter((time) => now - time < this.#windowMs);
    this.#crashes.push(now);
    if (this.#crashes.length >= this.#limit) return { action: "open-circuit" };
    const delayMs = 1_000 * 2 ** (this.#crashes.length - 1);
    return { action: "restart", delayMs };
  }
}
