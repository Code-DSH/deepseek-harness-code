import type { NetworkInterfaceInfo } from "node:os";
import { isIP } from "node:net";

import type {
  LanAccessCopy,
  LanAccessSet,
  LanAccessState,
} from "../shared/contracts.js";
import type { LanProxyHost, LanProxyStartResult } from "./lan-proxy.js";

type LanProxy = Pick<LanProxyHost, "issueAccessUrl" | "start" | "stop"> &
  Partial<
    Pick<
      LanProxyHost,
      "setPassword" | "setPasswordHash" | "isPasswordConfigured"
    >
  >;

export interface LanAccessControllerOptions {
  proxy: LanProxy;
  persistEnabled(enabled: boolean): Promise<void>;
  persistPasswordHash?(passwordHash: string | undefined): Promise<void>;
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
  private persistedEnabled = false;
  private loopbackOrigin: string | undefined;
  private activeOrigin: string | undefined;
  private activeState: LanAccessState = {
    enabled: false,
    passwordConfigured: false,
    addresses: [],
  };
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: LanAccessControllerOptions) {}

  loadPersistedEnabled(enabled: boolean): void {
    this.desiredEnabled = enabled;
    this.persistedEnabled = enabled;
  }

  loadPersistedPassword(passwordHash: string | undefined): void {
    this.options.proxy.setPasswordHash?.(passwordHash);
    this.activeState = {
      ...this.activeState,
      passwordConfigured: this.passwordConfigured(),
    };
  }

  get(): LanAccessState {
    return {
      ...this.activeState,
      addresses: [...this.activeState.addresses],
    };
  }

  set(command: LanAccessSet): Promise<LanAccessState> {
    this.desiredEnabled = command.enabled;
    return this.enqueue(async () => {
      if (command.password !== undefined) {
        if (this.options.proxy.setPassword === undefined) {
          throw new Error("LAN password authentication is unavailable");
        }
        const passwordHash = this.options.proxy.setPassword(command.password);
        await this.options.persistPasswordHash?.(passwordHash);
        this.activeState = {
          ...this.activeState,
          passwordConfigured: this.passwordConfigured(),
        };
      }
      return this.reconcile();
    });
  }

  onHarnessReady(origin: string): Promise<void> {
    this.loopbackOrigin = origin;
    return this.enqueue(async () => {
      await this.reconcile();
    });
  }

  copyUrl(selection: LanAccessCopy = {}): void {
    if (!this.desiredEnabled || !this.activeState.enabled) {
      throw new Error("LAN access is disabled");
    }
    const address = selection.address ?? this.activeState.addresses[0];
    if (address === undefined) {
      throw new Error("LAN access URL is unavailable");
    }
    if (!this.activeState.addresses.includes(address)) {
      throw new Error("Selected LAN address is not active");
    }
    const privateAccessUrl = this.options.proxy.issueAccessUrl();
    this.options.writeClipboard(
      this.accessUrlForAddress(privateAccessUrl, address),
    );
  }

  private async reconcile(): Promise<LanAccessState> {
    while (true) {
      if (!this.desiredEnabled) {
        if (this.activeState.enabled) {
          await this.stopAndClear();
        }
        if (this.desiredEnabled) continue;
        if (this.persistedEnabled) {
          await this.options.persistEnabled(false);
          this.persistedEnabled = false;
        }
        if (this.desiredEnabled) continue;
        return this.get();
      }

      const origin = this.loopbackOrigin;
      if (origin === undefined) {
        this.desiredEnabled = this.persistedEnabled;
        throw new Error("LAN access is unavailable before Harness is ready");
      }
      if (this.activeState.enabled && this.activeOrigin !== origin) {
        await this.stopAndClear();
        continue;
      }
      if (!this.activeState.enabled) {
        try {
          await this.start(origin);
        } catch (error) {
          if (!this.persistedEnabled) this.desiredEnabled = false;
          throw error;
        }
      }
      if (!this.desiredEnabled) continue;
      if (!this.persistedEnabled) {
        try {
          await this.options.persistEnabled(true);
          this.persistedEnabled = true;
        } catch (error) {
          try {
            await this.stopAndClear();
          } finally {
            this.desiredEnabled = false;
          }
          throw error;
        }
      }
      if (!this.desiredEnabled) continue;
      return this.get();
    }
  }

  private async start(origin: string): Promise<void> {
    let result: LanProxyStartResult;
    try {
      result = await this.options.proxy.start(origin);
    } catch (error) {
      this.clearActiveState();
      throw error;
    }
    try {
      const addresses = [...new Set(this.options.resolveAddresses())]
        .filter((address) => isIP(address) === 4)
        .sort();
      if (addresses.length === 0) {
        throw new Error("No LAN IPv4 address is available");
      }
      this.accessUrlForAddress(
        this.options.proxy.issueAccessUrl(),
        addresses[0]!,
      );
      this.activeState = {
        enabled: true,
        passwordConfigured: this.passwordConfigured(),
        port: result.port,
        addresses,
      };
      this.activeOrigin = origin;
    } catch (error) {
      await this.stopAndClear();
      throw error;
    }
  }

  private accessUrlForAddress(accessUrl: string, address: string): string {
    const url = new URL(accessUrl);
    if (url.protocol !== "http:" || url.hostname !== "0.0.0.0") {
      throw new Error("LAN access URL is invalid");
    }
    url.searchParams.delete("lanToken");
    url.hostname = address;
    return url.href;
  }

  private clearActiveState(): void {
    this.activeState = {
      enabled: false,
      passwordConfigured: this.passwordConfigured(),
      addresses: [],
    };
    this.activeOrigin = undefined;
  }

  private async stopAndClear(): Promise<void> {
    try {
      await this.options.proxy.stop();
    } finally {
      this.clearActiveState();
    }
  }

  private passwordConfigured(): boolean {
    return this.options.proxy.isPasswordConfigured?.() ?? false;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
