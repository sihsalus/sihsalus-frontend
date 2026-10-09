/**
 * reportes-sql entity identifiers are positive integers (not UUIDs). This
 * parser turns a raw route/query string into a usable id, returning `null`
 * for anything that is not a positive integer so callers can skip the
 * request instead of sending a malformed URL to the backend.
 */
export function parseEntityId(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
