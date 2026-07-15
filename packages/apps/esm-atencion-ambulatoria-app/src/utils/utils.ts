import { makeUrl, parseDate } from '@openmrs/esm-framework';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

/**
 * Generates a URL based on the given path and the current location.
 * @param path - The relative path for the URL.
 * @returns The full URL as a URL object.
 */
export function makeUrlUrl(path: string): URL {
  return new URL(makeUrl(path), globalThis.location.toString());
}

/**
 * Formats a deceased patient's name.
 * @param patient - Patient object from FHIR
 * @returns Formatted name string
 */
export function formatDeceasedName(patient: fhir.Patient): string {
  if (!patient?.name?.[0]) return '';

  const nameObj = patient.name[0];
  if (nameObj.text) {
    return nameObj.text;
  }

  const givenNames = nameObj.given?.join(' ') || '';
  const familyName = nameObj.family || '';

  return `${familyName} ${givenNames}`.trim();
}

/**
 * Calculates the number of days from the given date to today.
 * @param startDate - The starting date in string or Date format.
 * @returns The number of days from the start date to today.
 */
export function convertDateToDays(startDate: string | Date): number {
  const today = dayjs();
  const start = dayjs(startDate);
  return today.diff(start, 'day');
}

/**
 * Formats a date/time string into "DD-MMM-YYYY, hh:mm A" format.
 * @param date - The date to format (string | Date | undefined)
 * @returns Formatted date string or "--" for invalid dates
 */
export function formatDateTime(date: string | Date | undefined): string {
  return date ? dayjs(date).format('DD-MMM-YYYY, hh:mm A') : '--';
}

/**
 * Gets current time in 12-hour format with period (AM/PM)
 * @returns Object with time components
 */
export function getCurrentTime(): { time: string; period: string } {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = now.getHours() >= 12 ? 'PM' : 'AM';

  return {
    time: `${hours}:${minutes}`,
    period,
  };
}

export const monthDays = (currentDate: Dayjs) => {
  const monthStart = dayjs(currentDate).startOf('month');
  const monthEnd = dayjs(currentDate).endOf('month');
  const monthDays = dayjs(currentDate).daysInMonth();
  const lastMonth = dayjs(currentDate).subtract(1, 'month');
  const nextMonth = dayjs(currentDate).add(1, 'month');
  const days: Dayjs[] = [];

  for (let i = lastMonth.daysInMonth() - monthStart.day() + 1; i <= lastMonth.daysInMonth(); i++) {
    days.push(lastMonth.date(i));
  }

  for (let i = 1; i <= monthDays; i++) {
    days.push(currentDate.date(i));
  }

  const dayLen = days.length > 30 ? 7 : 14;

  for (let i = 1; i < dayLen - monthEnd.day(); i++) {
    days.push(nextMonth.date(i));
  }
  return days;
};

export const isSameMonth = (cellDate: Dayjs, currentDate: Dayjs) => {
  return cellDate.isSame(currentDate, 'month');
};

export function compare<T extends string>(x?: T, y?: T) {
  if (x === y || (!x && !y)) {
    return 0;
  } else if (!x) {
    return -1;
  } else if (!y) {
    return 1;
  } else {
    const xDate = parseDate(x);
    const yDate = parseDate(y);

    if (xDate === yDate) {
      return 0;
    }

    return xDate < yDate ? -1 : 1;
  }
}
