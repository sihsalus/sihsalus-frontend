import dayjs from 'dayjs';

/** Return the most recent valid observation date across independent CRED fields. */
export function latestObservationDate(dates: Array<string | null | undefined>): string | null {
  const latest = dates
    .map((date) => (date ? Date.parse(date) : Number.NaN))
    .filter(Number.isFinite)
    .reduce((maximum, date) => Math.max(maximum, date), Number.NEGATIVE_INFINITY);

  return Number.isFinite(latest) ? dayjs(latest).format('DD/MM/YYYY') : null;
}
