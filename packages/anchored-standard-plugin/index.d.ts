type AnchoredStandardSnapshot = {
    readonly enabled: boolean;
    readonly mode: "disabled" | "standard-fallback";
    readonly observedSuccessfulToolCall: boolean;
    readonly promotionCount: 0;
};
interface CordisContext {
    provide(name: string, value: unknown): () => void;
}
declare function createAnchoredStandardController(options: {
    enabled: boolean;
}): {
    recordToolResult(result: {
        ok: boolean;
    }): void;
    snapshot(): AnchoredStandardSnapshot;
};
/**
 * rc.6 permits preset composition changes only before an agent produces output.
 * This host half deliberately publishes a visible-safe fallback marker instead
 * of changing the model-facing catalog after a tool call.
 */
declare function apply(ctx: CordisContext): () => void;

export { type AnchoredStandardSnapshot, type CordisContext, apply, createAnchoredStandardController };
