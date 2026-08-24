const MAX_DIAGNOSTIC_LENGTH = 2_000;

export function redactStartupDiagnostic(value: string): string {
  return value
    .replace(
      /(?:git\+)?https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s"'<>]+/gi,
      "[REDACTED]",
    )
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:cookie|password|secret)\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(
      /("(?:apiKey|authorization|cookie|body)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    )
    .replace(/(--api-key\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/\/credentials\/[^\s/]+/gi, "/credentials/[REDACTED]")
    .slice(0, MAX_DIAGNOSTIC_LENGTH);
}

export function startupFailureFromDiagnostics(diagnostics: string): Error {
  const redacted = redactStartupDiagnostic(diagnostics);
  if (/\bEADDRINUSE\b/i.test(redacted)) {
    return Object.assign(new Error("Harness loopback port is already in use"), {
      code: "EADDRINUSE",
    });
  }
  const lines = redacted
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const diagnostic =
    lines.find((line) => /^(?:Error|TypeError|RangeError):\s+/u.test(line)) ??
    lines.find((line) => /duplicate loader entry id:/iu.test(line));
  if (diagnostic === undefined) {
    return new Error("Harness exited before becoming ready");
  }
  return new Error(
    `Harness startup failed: ${diagnostic.replace(/^(?:Error|TypeError|RangeError):\s*/u, "").slice(0, 500)}`,
  );
}
