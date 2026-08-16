export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function fetchOkWithTimeout(
  url: string,
  timeoutMs: number,
  request: FetchLike = fetch,
): Promise<boolean> {
  try {
    return (await request(url, { signal: AbortSignal.timeout(timeoutMs) })).ok;
  } catch {
    return false;
  }
}
