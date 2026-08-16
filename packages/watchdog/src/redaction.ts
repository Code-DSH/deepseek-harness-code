const SECRET_KEY =
  /^(authorization|proxy-authorization|api[-_]?key|cookie|set-cookie|request[-_]?body|response[-_]?body|prompt|credential(?:s)?(?:[-_]?path)?)$/i;

const FREE_FORM_SECRET =
  /\b(authorization|proxy-authorization|api[-_]?key|cookie|set-cookie|prompt|credential(?:s)?(?:[-_]?path)?)(\s*[:=]\s*|\s+)(?:bearer\s+)?([^\s,;]+)/gi;
const FREE_FORM_BODY =
  /\b((?:request|response)[-_\s]?body)(\s*[:=]\s*)[^\r\n]*/gi;
const URL_SECRET_QUERY =
  /([?&](?:api[-_]?key|access[_-]?token|token|key|signature|sig|credential)=[^&#\s]*)/gi;

export function redactLogString(value: string): string {
  return value
    .replace(
      FREE_FORM_BODY,
      (_match, name: string, separator: string) =>
        `${name}${separator}[REDACTED]`,
    )
    .replace(
      FREE_FORM_SECRET,
      (_match, name: string, separator: string) =>
        `${name}${separator}[REDACTED]`,
    )
    .replace(
      URL_SECRET_QUERY,
      (match) => `${match.slice(0, match.indexOf("=") + 1)}[REDACTED]`,
    );
}

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (typeof value === "string") return redactLogString(value);
  if (value === null || typeof value !== "object") return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactLogValue(child);
  }
  return redacted;
}
