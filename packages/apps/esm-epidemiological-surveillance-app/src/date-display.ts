/** Format calendar dates without converting them through the browser time zone. */
export function displayDate(value?: string | null): string {
  if (!value) return "";
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/, "$3/$2/$1");
}

/** Preserve the encounter's recorded time and display it through minutes. */
export function displayDateTime(value?: string | null): string {
  if (!value) return "";
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return parts
    ? `${parts[3]}/${parts[2]}/${parts[1]} ${parts[4]}:${parts[5]}`
    : displayDate(value);
}
