/**
 * Calendar-date helpers for patient demographics.
 *
 * A birthdate is a civil date, not an instant in time. These helpers deliberately
 * avoid parsing `YYYY-MM-DD` through `Date`, because doing so can move the date to
 * the previous day in time zones west of UTC.
 */

export const MIN_PATIENT_AGE_YEARS = 0;
export const MAX_PATIENT_AGE_MONTHS_REMAINDER = 11;

/**
 * OpenMRS Core rejects birthdates earlier than 140 years before the current date.
 * Keep this frontend compatibility limit aligned with PersonValidator.
 *
 * @see https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/validator/PersonValidator.java
 */
export const MAX_PATIENT_AGE_YEARS = 140;

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

export interface PartialPatientBirthdate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export type PatientBirthdateValidation = 'valid' | 'invalid' | 'future' | 'too-old';

export function normalizePatientAgeRange(minimumAge?: number | null, maximumAge?: number | null) {
  const requestedMaximum = Number.isFinite(maximumAge) ? Math.floor(maximumAge as number) : MAX_PATIENT_AGE_YEARS;
  const requestedMinimum = Number.isFinite(minimumAge) ? Math.ceil(minimumAge as number) : MIN_PATIENT_AGE_YEARS;
  const normalizedMaximum = Math.min(MAX_PATIENT_AGE_YEARS, Math.max(MIN_PATIENT_AGE_YEARS, requestedMaximum));
  const normalizedMinimum = Math.min(normalizedMaximum, Math.max(MIN_PATIENT_AGE_YEARS, requestedMinimum));

  return { minimumAge: normalizedMinimum, maximumAge: normalizedMaximum };
}

function isIntegerInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function getDaysInCalendarMonth(year: number, month: number) {
  if (!isIntegerInRange(year, 1, 9999) || !isIntegerInRange(month, 1, 12)) {
    return 0;
  }

  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidCalendarDate(date: CalendarDateParts) {
  return (
    isIntegerInRange(date.year, 1, 9999) &&
    isIntegerInRange(date.month, 1, 12) &&
    isIntegerInRange(date.day, 1, getDaysInCalendarMonth(date.year, date.month))
  );
}

export function getLocalCalendarDate(date = new Date()): CalendarDateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** Converts a calendar date to local midnight without interpreting it as UTC. */
export function calendarDateToLocalDate(date: CalendarDateParts) {
  if (!isValidCalendarDate(date)) {
    return null;
  }

  const localDate = new Date(date.year, date.month - 1, date.day);
  // JavaScript treats years 0–99 as 1900–1999 in the multi-argument constructor.
  localDate.setFullYear(date.year);
  localDate.setHours(0, 0, 0, 0);

  return localDate;
}

/**
 * Parses the calendar portion of a FHIR date or an OpenMRS date/datetime.
 * The timezone suffix, when present, must not alter the patient's recorded day.
 */
export function parsePatientBirthdate(value: string): CalendarDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
  if (!match) {
    return null;
  }

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  return isValidCalendarDate(date) ? date : null;
}

export function formatCalendarDate(date: CalendarDateParts) {
  if (!isValidCalendarDate(date)) {
    return '';
  }

  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function compareCalendarDates(left: CalendarDateParts, right: CalendarDateParts) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

/** Subtracts calendar years and months while clamping to the target month's final day. */
export function subtractCalendarAge(
  referenceDate: CalendarDateParts,
  years: number,
  months = 0,
): CalendarDateParts | null {
  if (
    !isValidCalendarDate(referenceDate) ||
    !Number.isInteger(years) ||
    years < 0 ||
    !Number.isInteger(months) ||
    months < 0
  ) {
    return null;
  }

  const targetMonthIndex = referenceDate.year * 12 + referenceDate.month - 1 - years * 12 - months;
  const year = Math.floor(targetMonthIndex / 12);
  const month = (((targetMonthIndex % 12) + 12) % 12) + 1;
  const day = Math.min(referenceDate.day, getDaysInCalendarMonth(year, month));
  const result = { year, month, day };

  return isValidCalendarDate(result) ? result : null;
}

export function getOldestAllowedPatientBirthdate(
  referenceDate = getLocalCalendarDate(),
  maximumAgeYears = MAX_PATIENT_AGE_YEARS,
) {
  return subtractCalendarAge(referenceDate, maximumAgeYears);
}

export function getEarliestPatientBirthYear(
  referenceDate = getLocalCalendarDate(),
  maximumAgeYears = MAX_PATIENT_AGE_YEARS,
) {
  return referenceDate.year - maximumAgeYears;
}

export function validatePatientBirthdate(
  birthdate: CalendarDateParts,
  referenceDate = getLocalCalendarDate(),
  maximumAgeYears = MAX_PATIENT_AGE_YEARS,
): PatientBirthdateValidation {
  if (!isValidCalendarDate(birthdate) || !isValidCalendarDate(referenceDate)) {
    return 'invalid';
  }

  if (compareCalendarDates(birthdate, referenceDate) > 0) {
    return 'future';
  }

  const oldestAllowedBirthdate = getOldestAllowedPatientBirthdate(referenceDate, maximumAgeYears);
  if (!oldestAllowedBirthdate || compareCalendarDates(birthdate, oldestAllowedBirthdate) < 0) {
    return 'too-old';
  }

  return 'valid';
}

/** Calculates completed years, matching OpenMRS Person#getAge calendar semantics. */
export function calculatePatientAge(birthdate: CalendarDateParts, referenceDate = getLocalCalendarDate()) {
  if (
    !isValidCalendarDate(birthdate) ||
    !isValidCalendarDate(referenceDate) ||
    compareCalendarDates(birthdate, referenceDate) > 0
  ) {
    return null;
  }

  const birthdayHasOccurred =
    referenceDate.month > birthdate.month ||
    (referenceDate.month === birthdate.month && referenceDate.day >= birthdate.day);

  return referenceDate.year - birthdate.year - (birthdayHasOccurred ? 0 : 1);
}

/** Calculates completed calendar months for estimated-age year/month fields. */
export function calculatePatientAgeInMonths(birthdate: CalendarDateParts, referenceDate = getLocalCalendarDate()) {
  if (
    !isValidCalendarDate(birthdate) ||
    !isValidCalendarDate(referenceDate) ||
    compareCalendarDates(birthdate, referenceDate) > 0
  ) {
    return null;
  }

  const elapsedMonths = (referenceDate.year - birthdate.year) * 12 + referenceDate.month - birthdate.month;
  return elapsedMonths - (referenceDate.day < birthdate.day ? 1 : 0);
}

/**
 * Returns true when at least one exact birthdate exists for the supplied partial
 * search criteria within the range accepted by OpenMRS Core.
 */
export function hasPossiblePatientBirthdate(
  partial: PartialPatientBirthdate,
  referenceDate = getLocalCalendarDate(),
  maximumAgeYears = MAX_PATIENT_AGE_YEARS,
) {
  const { year, month, day } = partial;
  if (
    (year != null && !isIntegerInRange(year, 1, 9999)) ||
    (month != null && !isIntegerInRange(month, 1, 12)) ||
    (day != null && !isIntegerInRange(day, 1, 31)) ||
    !isValidCalendarDate(referenceDate)
  ) {
    return false;
  }

  const oldestAllowedBirthdate = getOldestAllowedPatientBirthdate(referenceDate, maximumAgeYears);
  if (!oldestAllowedBirthdate) {
    return false;
  }

  const firstYear = year ?? oldestAllowedBirthdate.year;
  const lastYear = year ?? referenceDate.year;
  if (firstYear > lastYear) {
    return false;
  }

  for (let candidateYear = firstYear; candidateYear <= lastYear; candidateYear++) {
    const firstMonth = month ?? 1;
    const lastMonth = month ?? 12;

    for (let candidateMonth = firstMonth; candidateMonth <= lastMonth; candidateMonth++) {
      const lastDayOfMonth = getDaysInCalendarMonth(candidateYear, candidateMonth);
      if (!lastDayOfMonth || (day != null && day > lastDayOfMonth)) {
        continue;
      }

      const firstCandidate = { year: candidateYear, month: candidateMonth, day: day ?? 1 };
      const lastCandidate = { year: candidateYear, month: candidateMonth, day: day ?? lastDayOfMonth };
      const rangeEndsAfterOldest = compareCalendarDates(lastCandidate, oldestAllowedBirthdate) >= 0;
      const rangeStartsBeforeToday = compareCalendarDates(firstCandidate, referenceDate) <= 0;

      if (rangeEndsAfterOldest && rangeStartsBeforeToday) {
        return true;
      }
    }
  }

  return false;
}

export function estimatePatientBirthdateFromAge(
  ageInYears: number,
  referenceDate = getLocalCalendarDate(),
  maximumAgeYears = MAX_PATIENT_AGE_YEARS,
) {
  if (!isIntegerInRange(ageInYears, MIN_PATIENT_AGE_YEARS, maximumAgeYears)) {
    return null;
  }

  const estimatedBirthdate = subtractCalendarAge(referenceDate, ageInYears);
  return estimatedBirthdate ? formatCalendarDate(estimatedBirthdate) : null;
}
