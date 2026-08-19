export const maxSearchQueryLength = 80;
export const maxPriceInputValue = 100_000_000;

const dangerousMarkupPattern =
  /<|>|\{|\}|\[|\]|`|\\|javascript:|data:|vbscript:|on\w+\s*=|<\/?script|<\/?iframe|<\/?object|<\/?embed/gi;

function sanitizeSearchText(value: unknown, maxLength: number, trim: boolean) {
  if (typeof value !== "string") return "";

  const sanitized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(dangerousMarkupPattern, " ")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return trim ? sanitized.trim() : sanitized;
}

export function sanitizeSearchQuery(value: unknown, maxLength = maxSearchQueryLength) {
  return sanitizeSearchText(value, maxLength, true);
}

export function sanitizeLiveSearchQuery(value: unknown, maxLength = maxSearchQueryLength) {
  return sanitizeSearchText(value, maxLength, false);
}

export function parseSafePositiveInteger(value: string, max = maxPriceInputValue) {
  const digits = value.normalize("NFKC").replace(/\D/g, "").slice(0, 12);
  if (!digits) return null;

  const numericValue = Number(digits);
  return Number.isSafeInteger(numericValue) && numericValue > 0
    ? Math.min(numericValue, max)
    : null;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
