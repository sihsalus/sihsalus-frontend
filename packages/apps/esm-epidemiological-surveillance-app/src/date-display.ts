/** Format calendar dates without converting them through the browser time zone. */
export function displayDate(value?: string | null): string {
  if (!value) return "";
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/, "$3/$2/$1");
}
