/** Format calendar dates without converting them through the browser time zone. */
export function displayDate(value?: string | null): string {
  if (!value) return "";
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/, "$3/$2/$1");
}

/** Display encounter instants in UTC-5, independently of browser time zone.
 * Legacy timestamps without an offset are interpreted as UTC.
 */
export function displayDateTime(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return displayDate(value);
  const normalized = value.replace(" ", "T");
  const instant = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  if (!Number.isFinite(instant.getTime())) return "";
  const local = new Date(instant.getTime() - 5 * 60 * 60 * 1000);
  const date = local.toISOString();
  return `${displayDate(date.slice(0, 10))} ${date.slice(11, 16)}`;
}
