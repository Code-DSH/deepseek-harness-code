export const STREAMING_ASSISTANT_SELECTOR: string;
export const EXCLUDED_OUTPUT_SELECTOR: string;

export type AppendedGrapheme = {
  text: string;
  start: number;
  end: number;
  order: number;
};

export function findAppendedGraphemes(
  previous: string,
  next: string,
  segmenter?: Intl.Segmenter,
): AppendedGrapheme[] | null;
export function isEligibleStreamTextNode(node: Node | null): node is Text;
export function eligibleTextNodes(root: Node): Text[];
