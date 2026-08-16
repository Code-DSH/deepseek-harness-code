export type StreamOutputEffectController = {
  start(): void;
  dispose(): void;
};

export function createStreamOutputEffectController(options: {
  document: Document;
  window: Window;
}): StreamOutputEffectController;
export function installStreamOutputEffects(
  document?: Document,
  window?: Window,
): () => void;
