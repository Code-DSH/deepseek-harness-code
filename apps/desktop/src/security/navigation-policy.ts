export type NavigationDecision = "allow-in-app" | "open-external" | "deny";

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "[::1]";
}

export function classifyNavigation(
  candidateUrl: string,
  harnessOrigin: string,
  startupPageUrl?: string,
): NavigationDecision {
  let candidate: URL;
  try {
    candidate = new URL(candidateUrl);
  } catch {
    return "deny";
  }

  if (startupPageUrl !== undefined) {
    try {
      if (candidate.href === new URL(startupPageUrl).href)
        return "allow-in-app";
    } catch {
      return "deny";
    }
  }

  if (candidate.protocol === "https:") return "open-external";

  let allowed: URL;
  try {
    allowed = new URL(harnessOrigin);
  } catch {
    return "deny";
  }

  if (
    allowed.protocol !== "http:" ||
    !isLoopbackHostname(allowed.hostname) ||
    allowed.port === ""
  ) {
    return "deny";
  }

  if (
    candidate.origin === allowed.origin &&
    candidate.protocol === "http:" &&
    isLoopbackHostname(candidate.hostname)
  ) {
    return "allow-in-app";
  }
  return "deny";
}
