/** Display minutes without changing the precision of the metric returned by Queue. */
export function formatAverageWaitTime(value: string | number | null | undefined, locale: string): string {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return '--';
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return '--';
  return new Intl.NumberFormat(locale.replaceAll('_', '-'), { maximumFractionDigits: 1 }).format(minutes);
}
