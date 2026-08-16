import { z } from "zod";

export const closeBehaviorSchema = z.enum(["ask", "minimize", "quit"]);
export const setCloseBehaviorSchema = z.enum(["minimize", "quit"]);
export type CloseBehavior = z.infer<typeof closeBehaviorSchema>;

export const desktopPreferencesStateSchema = z
  .object({
    closeBehavior: closeBehaviorSchema,
    anchoredStandard: z.boolean(),
  })
  .strict();

export const desktopPreferencesSchema = z
  .object({
    closeBehavior: setCloseBehaviorSchema,
    anchoredStandard: z.boolean(),
  })
  .strict();

export type DesktopPreferencesState = z.infer<
  typeof desktopPreferencesStateSchema
>;
export type DesktopPreferences = z.infer<typeof desktopPreferencesSchema>;

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferencesState = {
  closeBehavior: "ask",
  anchoredStandard: false,
};

export const runtimePhaseSchema = z.enum([
  "starting",
  "ready",
  "recovering",
  "failed",
  "stopping",
]);
export type RuntimePhase = z.infer<typeof runtimePhaseSchema>;

export const runtimeStateSchema = z
  .object({
    phase: runtimePhaseSchema,
    restartCount: z.number().int().nonnegative(),
    harnessPid: z.number().int().positive().optional(),
    lastError: z.string().max(2_000).optional(),
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
