export function getLogRouteParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

const MAX_TERMS = 10;
const MAX_TERM_LENGTH = 256;

/** Splits a `|` separated query; returns null when it is missing or out of bounds. */
export function parseSearchTerms(value: unknown): string[] | null {
  if (typeof value !== "string") {
    return null;
  }

  const terms = value
    .split("|")
    .map((term) => term.trim())
    .filter(Boolean);

  if (
    terms.length === 0 ||
    terms.length > MAX_TERMS ||
    terms.some((term) => term.length > MAX_TERM_LENGTH)
  ) {
    return null;
  }

  return [...new Set(terms)];
}