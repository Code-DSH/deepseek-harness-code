import { z } from "zod";

export const closeBehaviorSchema = z.enum(["ask", "minimize", "quit"]);
export const setCloseBehaviorSchema = z.enum(["minimize", "quit"]);
export type CloseBehavior = z.infer<typeof closeBehaviorSchema>;

export const desktopPreferencesStateSchema = z
  .object({
    closeBehavior: closeBehaviorSchema,
    lanAccessEnabled: z.boolean(),
  })
  .strict();

export const desktopPreferencesSchema = z
  .object({
    closeBehavior: setCloseBehaviorSchema,
  })
  .strict();

export type DesktopPreferencesState = z.infer<
  typeof desktopPreferencesStateSchema
>;
export type DesktopPreferences = z.infer<typeof desktopPreferencesSchema>;
export type DesktopPreferencesPatch = Partial<DesktopPreferencesState>;

export function mergeDesktopPreferences(
  current: DesktopPreferencesState,
  patch: DesktopPreferencesPatch,
): DesktopPreferencesState {
  return { ...current, ...patch };
}

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferencesState = {
  closeBehavior: "ask",
  lanAccessEnabled: false,
};

/** Read the previous settings shape while deliberately discarding retired fields. */
export function parsePersistedDesktopPreferences(
  value: unknown,
): DesktopPreferencesState {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_DESKTOP_PREFERENCES };
  }
  const closeBehavior = closeBehaviorSchema.safeParse(
    (value as Record<string, unknown>).closeBehavior,
  );
  if (!closeBehavior.success) return { ...DEFAULT_DESKTOP_PREFERENCES };
  const lanAccessEnabled = z
    .boolean()
    .safeParse((value as Record<string, unknown>).lanAccessEnabled);
  return {
    closeBehavior: closeBehavior.data,
    lanAccessEnabled: lanAccessEnabled.success ? lanAccessEnabled.data : false,
  };
}

export const lanAccessSetSchema = z
  .object({
    enabled: z.boolean(),
    password: z.string().max(256).optional(),
  })
  .strict();

export const lanAccessCopySchema = z
  .object({
    address: z.ipv4().optional(),
  })
  .strict();

export const lanAccessStateSchema = z
  .object({
    enabled: z.boolean(),
    passwordConfigured: z.boolean(),
    port: z.number().int().min(1).max(65_535).optional(),
    addresses: z.array(z.ipv4()),
  })
  .strict();

export type LanAccessSet = z.infer<typeof lanAccessSetSchema>;
export type LanAccessCopy = z.infer<typeof lanAccessCopySchema>;
export type LanAccessState = z.infer<typeof lanAccessStateSchema>;

export const runtimePhaseSchema = z.enum([
  "starting",
  "ready",
  "recovering",
  "failed",
  "stopping",
]);
export type RuntimePhase = z.infer<typeof runtimePhaseSchema>;
export const runtimeNoticeSchema = z.enum([
  "anchored-preset-conflict",
  "anchored-preset-unavailable",
  "routing-suite-conflict",
  "routing-suite-unavailable",
]);
export type RuntimeNotice = z.infer<typeof runtimeNoticeSchema>;

export const runtimeStateSchema = z
  .object({
    phase: runtimePhaseSchema,
    restartCount: z.number().int().nonnegative(),
    harnessPid: z.number().int().positive().optional(),
    lastError: z.string().max(2_000).optional(),
    notice: runtimeNoticeSchema.optional(),
  })
  .strict();

export type RuntimeState = z.infer<typeof runtimeStateSchema>;

export const appInfoSchema = z
  .object({
    name: z.string().min(1).max(200),
    version: z.string().min(1).max(100),
  })
  .strict();
export type AppInfo = z.infer<typeof appInfoSchema>;

export interface UpdaterCheckOutcome {
  available: boolean;
  version?: string;
  applied?: boolean;
}

export const updaterPhaseSchema = z.enum([
  "idle",
  "checking",
  "up-to-date",
  "available",
  "downloading",
  "verifying",
  "ready-to-restart",
  "failed",
]);
export type UpdaterPhase = z.infer<typeof updaterPhaseSchema>;

export const updaterStatusSchema = z
  .object({
    phase: updaterPhaseSchema,
    version: z.string().optional(),
    notes: z.string().max(20_000).optional(),
    downloadedBytes: z.number().int().nonnegative().optional(),
    totalBytes: z.number().int().positive().optional(),
    error: z.string().max(2_000).optional(),
  })
  .strict();
export type UpdaterStatus = z.infer<typeof updaterStatusSchema>;

export interface BundledPluginEntry {
  name: string;
  description: string;
  dir: string;
}

export interface DeepSeekDesktopBridge {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  preferences: {
    get(): Promise<DesktopPreferencesState>;
    set(value: DesktopPreferences): Promise<void>;
  };
  lanAccess: {
    get(): Promise<LanAccessState>;
    set(value: LanAccessSet): Promise<LanAccessState>;
    copyUrl(value?: LanAccessCopy): Promise<void>;
  };
  runtime: {
    getState(): Promise<RuntimeState>;
    restartHarness(): Promise<void>;
    openLogs(): Promise<void>;
    subscribe(listener: (state: RuntimeState) => void): () => void;
  };
  updater: {
    check(): Promise<UpdaterCheckOutcome>;
    apply(): Promise<UpdaterCheckOutcome>;
    restart(): Promise<void>;
    subscribe(listener: (status: UpdaterStatus) => void): () => void;
  };
  bundledPlugins: {
    list(): Promise<BundledPluginEntry[]>;
  };
}

declare global {
  interface Window {
    deepseekDesktop?: DeepSeekDesktopBridge;
  }
}
