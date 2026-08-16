// src/index.ts
var inject = [];
function desktopRuntimeMetadata() {
  return {
    desktop: true,
    platform: process.platform,
    processId: process.pid,
    dshHomeConfigured: typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0
  };
}
function apply(ctx) {
  const disposeRuntime = ctx.provide(
    "desktopRuntime",
    desktopRuntimeMetadata()
  );
  const disposeHmrMarker = ctx.provide("hmr", {
    desktopManaged: true,
    registerConfig: async () => async () => void 0
  });
  return () => {
    disposeHmrMarker();
    disposeRuntime();
  };
}
export {
  apply,
  desktopRuntimeMetadata,
  inject
};
