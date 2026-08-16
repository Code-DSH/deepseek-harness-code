import { z } from "zod";

export const closeBehaviorSchema = z.enum(["ask", "minimize", "quit"]);
export const setCloseBehaviorSchema = z.enum(["minimize", "quit"]);
export type CloseBehavior = z.infer<typeof closeBehaviorSchema>;

export const desktopPreferencesStateSchema = z
  .object({
    closeBehavior: closeBehaviorSchema,
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

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferencesState = {
  closeBehavior: "ask",
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
  return closeBehavior.success
    ? { closeBehavior: closeBehavior.data }
    : { ...DEFAULT_DESKTOP_PREFERENCES };
}

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

export interface DeepSeekDesktopBridge {
  preferences: {
    get(): Promise<DesktopPreferencesState>;
    set(value: DesktopPreferences): Promise<void>;
  };
  runtime: {
    getState(): Promise<RuntimeState>;
    restartHarness(): Promise<void>;
    openLogs(): Promise<void>;
    subscribe(listener: (state: RuntimeState) => void): () => void;
  };
}

declare global {
  interface Window {
    deepseekDesktop?: DeepSeekDesktopBridge;
  }
}
