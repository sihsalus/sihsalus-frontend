import type { QueueEntrySearchCriteria } from '../types';

/** A session filter is a local calendar day, not a UTC timestamp. */
export function parseQueueEntryDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function serializeQueueEntryDate(date?: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getQueueEntryDateCriteria(
  value?: string | null,
): Pick<QueueEntrySearchCriteria, 'startedOnOrAfter' | 'startedOnOrBefore'> {
  const start = parseQueueEntryDate(value);
  if (!start) return {};
  const end = new Date(start);
  // Calendar arithmetic includes timezone changes; a local day is not always 24 hours.
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  return { startedOnOrAfter: start.toISOString(), startedOnOrBefore: end.toISOString() };
}
