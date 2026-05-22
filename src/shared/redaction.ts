export const REDACTED_VALUE = "[redacted]";

const MAX_REDACTED_TEXT_LENGTH = 500;

const secretAssignmentPattern =
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|mcp[_-]?token|bearer[_-]?token|api[_-]?key|password|credential|secret|token)\b\s*([:=])\s*["']?[^"',\s)}\]]+/gi;
const jsonSecretPattern =
  /(["'])(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|mcp[_-]?token|bearer[_-]?token|api[_-]?key|password|credential|secret|token)\1\s*:\s*(["'])(?:(?!\3).)*\3/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const oauthCodePattern = /\b(code|code_verifier|codeVerifier|state)=([^&\s]+)/gi;
const googleApiKeyPattern = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const likelyJwtPattern = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g;
const homeDirectory = typeof process === "undefined" ? undefined : process.env.HOME;

export type RedactablePrimitive = string | number | boolean | null;

export function redactSensitiveText(value: string, maxLength = MAX_REDACTED_TEXT_LENGTH): string {
  const redacted = value
    .replace(jsonSecretPattern, (_match, quote: string, key: string) => `${quote}${key}${quote}: "${REDACTED_VALUE}"`)
    .replace(secretAssignmentPattern, (_match, key: string, separator: string) => `${key}${separator}${REDACTED_VALUE}`)
    .replace(bearerPattern, `Bearer ${REDACTED_VALUE}`)
    .replace(oauthCodePattern, (_match, key: string) => `${key}=${REDACTED_VALUE}`)
    .replace(googleApiKeyPattern, REDACTED_VALUE)
    .replace(likelyJwtPattern, REDACTED_VALUE)
    .replace(/[\r\n]+/g, " ")
    .trim();
  const withoutHome = homeDirectory ? redacted.split(homeDirectory).join("~") : redacted;

  return withoutHome.slice(0, maxLength);
}

export function redactErrorMessage(message: string): string {
  return redactSensitiveText(message);
}

export function redactLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactLogValue);
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      output[redactSensitiveKey(key)] = isSensitiveKey(key)
        ? REDACTED_VALUE
        : redactLogValue(nestedValue);
    }

    return output;
  }

  return REDACTED_VALUE;
}

export function redactDiagnosticDetails(
  details: Record<string, RedactablePrimitive> | undefined
): Record<string, RedactablePrimitive> | undefined {
  if (details === undefined) {
    return undefined;
  }

  const sanitized: Record<string, RedactablePrimitive> = {};

  for (const [key, value] of Object.entries(details)) {
    const redactedKey = redactSensitiveKey(key);

    if (isSensitiveKey(key)) {
      sanitized[redactedKey] = REDACTED_VALUE;
      continue;
    }

    sanitized[redactedKey] =
      typeof value === "string" ? redactSensitiveText(value) : value;
  }

  return sanitized;
}

export function redactAuditText(value: string, maxLength = 120): string {
  return redactSensitiveText(value, maxLength);
}

export function redactMetadata(
  metadata: Record<string, RedactablePrimitive> | undefined
): Record<string, RedactablePrimitive> {
  return redactDiagnosticDetails(metadata) ?? {};
}

export function redactSensitiveKey(key: string): string {
  return isSensitiveKey(key) ? REDACTED_VALUE : redactSensitiveText(key, 120);
}

export function isSensitiveKey(key: string): boolean {
  return /(?:access|refresh|id|bearer|mcp)?[_-]?(?:token|secret|password|credential|api[_-]?key)|code[_-]?verifier/i.test(
    key
  );
}
