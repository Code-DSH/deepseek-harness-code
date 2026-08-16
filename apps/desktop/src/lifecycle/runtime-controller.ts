import type { RuntimeNotice, RuntimeState } from "../shared/contracts.js";

export interface HarnessChild {
  pid?: number | undefined;
  kill(signal: NodeJS.Signals): void;
}

export interface HarnessRuntimeOptions {
  origin: string | (() => string);
  startHarness: () => Promise<HarnessChild>;
  probeHealth: (origin: string) => Promise<boolean>;
  waitForReady?: (child: HarnessChild, origin: string) => Promise<boolean>;
  isChildAlive?: (child: HarnessChild) => boolean;
  runtimeNotice?: () => RuntimeNotice | undefined;
  onReady?: (origin: string) => Promise<void> | void;
  onState: (state: RuntimeState) => void;
  reloadRenderer?: () => void;
  rebuildWindow?: () => void;
  waitForExit?: (child: HarnessChild, timeoutMs: number) => Promise<boolean>;
}

export class HarnessRuntimeController {
  private child: HarnessChild | undefined;
  private failures = 0;
  private restartInFlight: Promise<void> | undefined;
  private healthCheckInFlight: Promise<void> | undefined;
  private stopRequested = false;
  private unresponsiveTimer: ReturnType<typeof setTimeout> | undefined;
  private state: RuntimeState = { phase: "starting", restartCount: 0 };

  constructor(private readonly options: HarnessRuntimeOptions) {}

  getState(): RuntimeState {
    return this.state;
  }

  async start(): Promise<void> {
    this.publish({ phase: "starting", restartCount: this.state.restartCount });
    let child: HarnessChild | undefined;
    try {
      if (this.stopRequested) return;
      child = await this.options.startHarness();
      this.child = child;
      if (this.stopRequested) return;
      const ready = await (this.options.waitForReady?.(
        child,
        this.currentOrigin(),
      ) ?? Promise.resolve(true));
      if (!ready || !this.isCurrentChild(child) || !this.isChildAlive(child)) {
        throw new Error("Harness not ready");
      }
      await this.options.onReady?.(this.currentOrigin());
      if (this.stopRequested) return;
    } catch (error) {
      if (child !== undefined && this.isCurrentChild(child))
        this.child = undefined;
      if (child !== undefined) await this.retireChild(child);
      if (!this.stopRequested)
        this.publish({
          phase: "failed",
          restartCount: this.state.restartCount,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 2_000)
              : "Harness startup failed",
        });
      throw error;
    }
    if (child === undefined || this.stopRequested) return;
    this.failures = 0;
    const notice = this.options.runtimeNotice?.();
    this.publish({
      phase: "ready",
      restartCount: this.state.restartCount,
      ...(child.pid === undefined ? {} : { harnessPid: child.pid }),
      ...(notice === undefined ? {} : { notice }),
    });
  }

  async restart(): Promise<void> {
    if (this.stopRequested) return;
    if (this.restartInFlight !== undefined) return this.restartInFlight;
    const restart = this.restartNow();
    this.restartInFlight = restart;
    try {
      await restart;
    } finally {
      this.restartInFlight = undefined;
    }
  }

  private async restartNow(): Promise<void> {
    const restartCount = this.state.restartCount + 1;
    this.publish({ phase: "recovering", restartCount });
    await this.retireCurrentChild();
    if (this.stopRequested) return;
    await this.start();
  }

  async checkHealth(): Promise<void> {
    if (this.healthCheckInFlight !== undefined) return this.healthCheckInFlight;
    const check = this.checkHealthNow();
    this.healthCheckInFlight = check;
    try {
      await check;
    } finally {
      this.healthCheckInFlight = undefined;
    }
  }

  private async checkHealthNow(): Promise<void> {
    if (this.stopRequested) return;
    const child = this.child;
    if (child === undefined || !this.isChildAlive(child)) {
      await this.restart();
      return;
    }
    try {
      if (await this.options.probeHealth(this.currentOrigin())) {
        this.failures = 0;
        return;
      }
    } catch {
      // A failed local health probe is treated identically to a false probe.
    }
    this.failures += 1;
    if (this.failures >= 3) await this.restart();
  }

  async handleChildExit(child: HarnessChild): Promise<void> {
    if (
      !this.stopRequested &&
      this.state.phase !== "stopping" &&
      this.isCurrentChild(child)
    ) {
      await this.restart();
    }
  }

  handleRendererGone(): void {
    this.options.rebuildWindow?.();
  }

  handleRendererUnresponsive(): void {
    if (this.unresponsiveTimer !== undefined) return;
    this.unresponsiveTimer = setTimeout(() => {
      this.unresponsiveTimer = undefined;
      this.options.reloadRenderer?.();
    }, 30_000);
  }

  handleRendererResponsive(): void {
    if (this.unresponsiveTimer !== undefined)
      clearTimeout(this.unresponsiveTimer);
    this.unresponsiveTimer = undefined;
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.publish({ phase: "stopping", restartCount: this.state.restartCount });
    this.handleRendererResponsive();
    if (this.restartInFlight !== undefined) await this.restartInFlight;
    await this.retireCurrentChild();
  }

  private publish(state: RuntimeState): void {
    this.state = state;
    try {
      this.options.onState(state);
    } catch {
      // State observers are diagnostic/UI consumers. A renderer can disappear
      // during shutdown; it must never interrupt child retirement or recovery.
    }
  }

  private currentOrigin(): string {
    return typeof this.options.origin === "function"
      ? this.options.origin()
      : this.options.origin;
  }

  private isChildAlive(child: HarnessChild): boolean {
    return this.options.isChildAlive?.(child) ?? true;
  }

  private isCurrentChild(child: HarnessChild): boolean {
    return this.child === child;
  }

  private async retireCurrentChild(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    if (child === undefined) return;
    await this.retireChild(child);
  }

  private async retireChild(child: HarnessChild): Promise<void> {
    child.kill("SIGTERM");
    const exited = await (this.options.waitForExit?.(child, 8_000) ??
      Promise.resolve(true));
    if (!exited) child.kill("SIGKILL");
  }
}
