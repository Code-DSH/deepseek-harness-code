interface DesktopRuntimeMetadata {
    readonly desktop: true;
    readonly platform: NodeJS.Platform;
    readonly processId: number;
    readonly dshHomeConfigured: boolean;
}
interface CordisContext {
    provide(name: string, value: unknown): () => void;
}
declare const inject: string[];
declare function desktopRuntimeMetadata(): DesktopRuntimeMetadata;
/**
 * Host half of the bundle. It only publishes read-only process metadata; the
 * Electron bridge remains renderer-only and question ownership stays upstream.
 */
declare function apply(ctx: CordisContext): () => void;

export { type CordisContext, type DesktopRuntimeMetadata, apply, desktopRuntimeMetadata, inject };
