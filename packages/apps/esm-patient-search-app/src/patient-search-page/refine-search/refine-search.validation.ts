import {
  getEarliestPatientBirthYear,
  getLocalCalendarDate,
  hasPossiblePatientBirthdate,
  MAX_PATIENT_AGE_YEARS,
  MIN_PATIENT_AGE_YEARS,
  validatePatientBirthdate,
} from '@openmrs/esm-utils';
import { z } from 'zod';

type Translate = (key: string, defaultValue: string, options?: Record<string, unknown>) => string;

const optionalFilterInteger = (min: number, max: number, message: string) =>
  z.number().int(message).min(min, message).max(max, message).nullable();

export function createRefineSearchSchema(
  t: Translate,
  minimumAge = MIN_PATIENT_AGE_YEARS,
  maximumAge = MAX_PATIENT_AGE_YEARS,
  today = new Date(),
) {
  const referenceDate = getLocalCalendarDate(today);
  const currentYear = referenceDate.year;
  const earliestBirthYear = getEarliestPatientBirthYear(referenceDate);
  const invalidDayMessage = t('invalidDayOfBirth', 'Enter a day between 1 and 31');
  const invalidMonthMessage = t('invalidMonthOfBirth', 'Enter a month between 1 and 12');
  const invalidYearMessage = t('invalidYearOfBirth', 'Enter a year between {{min}} and {{max}}', {
    min: earliestBirthYear,
    max: currentYear,
  });
  const invalidAgeMessage = t('invalidAge', 'Enter an age between {{min}} and {{max}}', {
    min: minimumAge,
    max: maximumAge,
  });

  return z
    .object({
      query: z.string(),
      gender: z.enum(['any', 'male', 'female', 'other', 'unknown']),
      dateOfBirth: optionalFilterInteger(1, 31, invalidDayMessage),
      monthOfBirth: optionalFilterInteger(1, 12, invalidMonthMessage),
      yearOfBirth: optionalFilterInteger(earliestBirthYear, currentYear, invalidYearMessage),
      postcode: z.string(),
      age: optionalFilterInteger(minimumAge, maximumAge, invalidAgeMessage),
      attributes: z.record(z.string()),
    })
    .superRefine(({ dateOfBirth: day, monthOfBirth: month, yearOfBirth: year }, context) => {
      if (day == null && month == null && year == null) {
        return;
      }

      if (day != null && month != null && year != null) {
        const validation = validatePatientBirthdate({ day, month, year }, referenceDate);
        if (validation === 'future') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('birthdateInFuture', 'Date of birth cannot be in the future'),
            path: ['yearOfBirth'],
          });
          return;
        }

        if (validation === 'too-old') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('birthdateTooOld', 'Date of birth cannot be more than 140 years ago'),
            path: ['yearOfBirth'],
          });
          return;
        }
      }

      if (!hasPossiblePatientBirthdate({ day, month, year }, referenceDate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('invalidBirthdate', 'Enter a possible date of birth'),
          path: ['dateOfBirth'],
        });
      }
    });
}
