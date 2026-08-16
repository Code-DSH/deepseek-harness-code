export type AnchoredStandardSnapshot = {
  readonly enabled: boolean;
  readonly mode: "disabled" | "standard-fallback";
  readonly observedSuccessfulToolCall: boolean;
  readonly promotionCount: 0;
};

export interface CordisContext {
  provide(name: string, value: unknown): () => void;
}

export function createAnchoredStandardController(options: {
  enabled: boolean;
}) {
  let observedSuccessfulToolCall = false;
  const mode = options.enabled ? "standard-fallback" : "disabled";
  return {
    recordToolResult(result: { ok: boolean }) {
      if (result.ok) observedSuccessfulToolCall = true;
    },
    snapshot(): AnchoredStandardSnapshot {
      return {
        enabled: options.enabled,
        mode,
        observedSuccessfulToolCall,
        promotionCount: 0,
      };
    },
  };
}

/**
 * rc.6 permits preset composition changes only before an agent produces output.
 * This host half deliberately publishes a visible-safe fallback marker instead
 * of changing the model-facing catalog after a tool call.
 */
export function apply(ctx: CordisContext): () => void {
  return ctx.provide("anchoredStandard", {
    mode: "standard-fallback",
    dynamicPromotion: false,
    reason: "rc.6 does not safely support post-tool preset recomposition",
  });
}
