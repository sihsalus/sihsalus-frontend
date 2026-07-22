/** @module @category Utility */
import dayjs from 'dayjs';
import { parseDateInput } from './dates/date-util';
import { getLocale } from './get-locale';

export type ExactAgeDuration = Required<Pick<Intl.DurationInput, 'years' | 'months' | 'days'>>;

/**
 * Calculates a calendar age with years, months and days. All three units are
 * always present so patient demographics are displayed consistently at every age.
 */
export function exactAgeAsDuration(
  birthDate: dayjs.ConfigType,
  currentDate: dayjs.ConfigType = dayjs(),
): ExactAgeDuration | null {
  const to = dayjs(currentDate).startOf('day');
  const parsedBirthDate = parseDateInput(birthDate, to);

  if (!to.isValid() || parsedBirthDate == null || !parsedBirthDate.isValid()) {
    return null;
  }

  const from = parsedBirthDate.startOf('day');
  if (from.isAfter(to)) {
    return null;
  }

  const years = to.diff(from, 'year');
  const afterYears = from.add(years, 'year');
  const months = to.diff(afterYears, 'month');
  const afterMonths = afterYears.add(months, 'month');
  const days = to.diff(afterMonths, 'day');

  return { years, months, days };
}

/**
 * Gets the age of a person as a structured duration object, following NHS Digital guidelines
 * (Tables 7 and 8) for which units to include based on the person's age.
 *
 * @see https://webarchive.nationalarchives.gov.uk/ukgwa/20160921162509mp_/http://systems.digital.nhs.uk/data/cui/uig/patben.pdf
 * @param birthDate The birthDate. If null, returns null.
 * @param currentDate Optional. If provided, calculates the age at the provided date instead of now.
 * @returns A DurationInput object, or null if birthDate is null or unparseable.
 *
 * @example
 * // For infants, returns fine-grained units
 * ageAsDuration('2024-07-29', '2024-07-30') // => { hours: 24 }
 *
 * @example
 * // For adults (>= 18), returns years only
 * ageAsDuration('2000-01-15', '2024-07-30') // => { years: 24 }
 */
export function ageAsDuration(
  birthDate: dayjs.ConfigType,
  currentDate: dayjs.ConfigType = dayjs(),
): Intl.DurationInput | null {
  const to = dayjs(currentDate);
  const from = parseDateInput(birthDate, to);

  if (from == null) {
    return null;
  }

  const hourDiff = to.diff(from, 'hours');
  const dayDiff = to.diff(from, 'days');
  const weekDiff = to.diff(from, 'weeks');
  const monthDiff = to.diff(from, 'months');
  const yearDiff = to.diff(from, 'years');

  const duration: Intl.DurationInput = {};

  if (hourDiff < 2) {
    duration['minutes'] = to.diff(from, 'minutes');
  } else if (dayDiff < 2) {
    duration['hours'] = hourDiff;
  } else if (weekDiff < 4) {
    duration['days'] = dayDiff;
  } else if (yearDiff < 1) {
    const remainderDayDiff = to.subtract(weekDiff, 'weeks').diff(from, 'days');
    duration['weeks'] = weekDiff;
    duration['days'] = remainderDayDiff;
  } else if (yearDiff < 2) {
    const remainderDayDiff = to.subtract(monthDiff, 'months').diff(from, 'days');
    duration['months'] = monthDiff;
    duration['days'] = remainderDayDiff;
  } else if (yearDiff < 18) {
    const remainderMonthDiff = to.subtract(yearDiff, 'year').diff(from, 'months');
    duration['years'] = yearDiff;
    duration['months'] = remainderMonthDiff;
  } else {
    duration['years'] = yearDiff;
  }

  return duration;
}

/**
 * Gets a localized, exact representation of a person's calendar age. Years,
 * months and days are always included, including zero-valued units.
 *
 * @param birthDate The birthDate. If birthDate is null, returns null.
 * @param currentDate Optional. If provided, calculates the age of the person at the provided currentDate (instead of now).
 * @returns A human-readable string version of the age.
 *
 * @example
 * age('1953-08-16', '2026-07-22') // => '72 years 11 months 6 days'
 *
 * @example
 * // String dates with partial precision are supported
 * age('2000', '2024-07-30') // => '24 years 0 months 0 days'
 */
export function age(birthDate: dayjs.ConfigType, currentDate: dayjs.ConfigType = dayjs()): string | null {
  const durationInput = exactAgeAsDuration(birthDate, currentDate);

  if (durationInput == null) {
    return null;
  }

  const locale = getLocale();
  const formatUnit = (value: number, unit: 'year' | 'month' | 'day') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);

  return [
    formatUnit(durationInput.years, 'year'),
    formatUnit(durationInput.months, 'month'),
    formatUnit(durationInput.days, 'day'),
  ].join(' ');
}
