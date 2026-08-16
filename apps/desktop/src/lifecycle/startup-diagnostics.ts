const MAX_DIAGNOSTIC_LENGTH = 2_000;

export function redactStartupDiagnostic(value: string): string {
  return value
    .slice(0, MAX_DIAGNOSTIC_LENGTH)
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:cookie|password|secret)\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(
      /("(?:apiKey|authorization|cookie|body)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/(--api-key\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/\/credentials\/[^\s/]+/gi, "/credentials/[REDACTED]");
}

export function startupFailureFromDiagnostics(diagnostics: string): Error {
  if (/\bEADDRINUSE\b/i.test(diagnostics)) {
    return Object.assign(new Error("Harness loopback port is already in use"), {
      code: "EADDRINUSE",
    });
  }
  return new Error("Harness exited before becoming ready");
}
