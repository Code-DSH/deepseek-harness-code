export interface DesktopRuntimeMetadata {
  readonly desktop: true;
  readonly platform: NodeJS.Platform;
  readonly processId: number;
  readonly dshHomeConfigured: boolean;
}

export interface CordisContext {
  provide(name: string, value: unknown): () => void;
}

export const inject: string[] = [];

export function desktopRuntimeMetadata(): DesktopRuntimeMetadata {
  return {
    desktop: true,
    platform: process.platform,
    processId: process.pid,
    dshHomeConfigured:
      typeof process.env.DSH_HOME === "string" &&
      process.env.DSH_HOME.length > 0,
  };
}

/**
 * Host half of the bundle. It only publishes read-only process metadata; the
 * Electron bridge remains renderer-only and question ownership stays upstream.
 */
export function apply(ctx: CordisContext): () => void {
  const disposeRuntime = ctx.provide(
    "desktopRuntime",
    desktopRuntimeMetadata(),
  );
  // dsh rc.6 unconditionally installs its patch-watcher HMR service after
  // boot. Electron's embedded Node runtime does not expose the Node internal
  // loader that service requires, so the packaged host owns this no-op marker
  // and keeps production startup on public Node APIs.
  const disposeHmrMarker = ctx.provide("hmr", {
    desktopManaged: true,
    registerConfig: async () => async () => undefined,
  });
  return () => {
    disposeHmrMarker();
    disposeRuntime();
  };
}
