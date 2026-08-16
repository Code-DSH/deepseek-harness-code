// src/index.ts
function createAnchoredStandardController(options) {
  let observedSuccessfulToolCall = false;
  const mode = options.enabled ? "standard-fallback" : "disabled";
  return {
    recordToolResult(result) {
      if (result.ok) observedSuccessfulToolCall = true;
    },
    snapshot() {
      return {
        enabled: options.enabled,
        mode,
        observedSuccessfulToolCall,
        promotionCount: 0
      };
    }
  };
}
function apply(ctx) {
  return ctx.provide("anchoredStandard", {
    mode: "standard-fallback",
    dynamicPromotion: false,
    reason: "rc.6 does not safely support post-tool preset recomposition"
  });
}
export {
  apply,
  createAnchoredStandardController
};
