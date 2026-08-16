export const STREAMING_ASSISTANT_SELECTOR =
  '[data-chat-flow-kind="assistant-step"] [data-streaming]';

export const EXCLUDED_OUTPUT_SELECTOR = [
  "pre",
  "code",
  "kbd",
  "samp",
  "button",
  "input",
  "textarea",
  "select",
  '[role="button"]',
  '[role="status"]',
  '[aria-hidden="true"]',
  "[data-tool-call]",
  "[data-terminal]",
].join(",");

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export function findAppendedGraphemes(
  previous,
  next,
  segmenter = graphemeSegmenter,
) {
  if (!next.startsWith(previous)) return null;
  if (next === previous) return [];
  const parts = [...segmenter.segment(next)];
  const appendStartsAtBoundary =
    previous.length === 0 ||
    parts.some((part) => part.index === previous.length);
  if (!appendStartsAtBoundary) return null;
  const appended = parts.filter((part) => part.index >= previous.length);
  if (
    previous.length === 0 &&
    appended[0]?.index === 0 &&
    /^\p{Mark}/u.test(appended[0].segment)
  )
    return null;
  return appended.map((part, order) => ({
    text: part.segment,
    start: part.index,
    end: part.index + part.segment.length,
    order,
  }));
}

export function isEligibleStreamTextNode(node) {
  if (!node || node.nodeType !== 3 || node.data.trim().length === 0)
    return false;
  const parent = node.parentElement;
  if (!parent || !parent.closest(STREAMING_ASSISTANT_SELECTOR)) return false;
  return parent.closest(EXCLUDED_OUTPUT_SELECTOR) === null;
}

export function eligibleTextNodes(root) {
  if (!root?.ownerDocument) return [];
  const nodes = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isEligibleStreamTextNode(node)) nodes.push(node);
  }
  return nodes;
}
