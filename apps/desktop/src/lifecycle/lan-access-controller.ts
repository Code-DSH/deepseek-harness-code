import type { NetworkInterfaceInfo } from "node:os";

import type { LanAccessSet, LanAccessState } from "../shared/contracts.js";
import type { LanProxyHost, LanProxyStartResult } from "./lan-proxy.js";

type LanProxy = Pick<LanProxyHost, "start" | "stop">;

export interface LanAccessControllerOptions {
  proxy: LanProxy;
  persistEnabled(enabled: boolean): Promise<void>;
  resolveAddresses(): string[];
  writeClipboard(value: string): void;
}

export function resolveLanIpv4Addresses(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string[] {
  const addresses = new Set<string>();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.add(entry.address);
      }
    }
  }
  return [...addresses].sort();
}

export class LanAccessController {
  private desiredEnabled = false;
  private loopbackOrigin: string | undefined;
  private activeState: LanAccessState = { enabled: false, addresses: [] };
  private privateAccessUrl: string | undefined;

  constructor(private readonly options: LanAccessControllerOptions) {}

  loadPersistedEnabled(enabled: boolean): void {
    this.desiredEnabled = enabled;
  }

  get(): LanAccessState {
    return {
      ...this.activeState,
      addresses: [...this.activeState.addresses],
    };
  }

  async set(command: LanAccessSet): Promise<LanAccessState> {
    if (command.enabled) {
      if (this.activeState.enabled) return this.get();
      const origin = this.loopbackOrigin;
      if (origin === undefined) {
        throw new Error("LAN access is unavailable before Harness is ready");
      }
      await this.start(origin);
      try {
        await this.options.persistEnabled(true);
      } catch (error) {
        await this.options.proxy.stop();
        this.clearActiveState();
        throw error;
      }
      this.desiredEnabled = true;
      return this.get();
    }

    if (this.activeState.enabled) {
      await this.options.proxy.stop();
      this.clearActiveState();
    }
    await this.options.persistEnabled(false);
    this.desiredEnabled = false;
    return this.get();
  }

  async onHarnessReady(origin: string): Promise<void> {
    this.loopbackOrigin = origin;
    if (!this.desiredEnabled) return;
    if (this.activeState.enabled) {
      await this.options.proxy.stop();
      this.clearActiveState();
    }
    await this.start(origin);
  }

  copyUrl(): void {
    if (!this.activeState.enabled) {
      throw new Error("LAN access is disabled");
    }
    if (this.privateAccessUrl === undefined) {
      throw new Error("LAN access URL is unavailable");
    }
    this.options.writeClipboard(this.privateAccessUrl);
  }

  private async start(origin: string): Promise<void> {
    let result: LanProxyStartResult;
    try {
      result = await this.options.proxy.start(origin);
    } catch (error) {
      this.clearActiveState();
      throw error;
    }
    const addresses = [...new Set(this.options.resolveAddresses())].sort();
    this.activeState = { enabled: true, port: result.port, addresses };
    this.privateAccessUrl = this.accessUrlForAddress(
      result.accessUrl,
      addresses[0],
    );
  }

  private accessUrlForAddress(
    accessUrl: string,
    address: string | undefined,
  ): string | undefined {
    if (address === undefined) return undefined;
    const url = new URL(accessUrl);
    url.hostname = address;
    return url.href;
  }

  private clearActiveState(): void {
    this.activeState = { enabled: false, addresses: [] };
    this.privateAccessUrl = undefined;
  }
}
