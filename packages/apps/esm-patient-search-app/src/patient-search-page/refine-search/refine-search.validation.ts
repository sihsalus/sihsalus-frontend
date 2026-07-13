import { z } from 'zod';

export const MIN_PATIENT_AGE = 0;
export const MAX_PATIENT_AGE = 140;

type Translate = (key: string, defaultValue: string, options?: Record<string, unknown>) => string;

const optionalFilterInteger = (max: number, message: string) =>
  z.number().int(message).min(0, message).max(max, message);

export function getEarliestBirthYear(today = new Date()) {
  return today.getFullYear() - MAX_PATIENT_AGE;
}

export function createRefineSearchSchema(
  t: Translate,
  minimumAge = MIN_PATIENT_AGE,
  maximumAge = MAX_PATIENT_AGE,
  today = new Date(),
) {
  const currentYear = today.getFullYear();
  const earliestBirthYear = getEarliestBirthYear(today);
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
      dateOfBirth: optionalFilterInteger(31, invalidDayMessage),
      monthOfBirth: optionalFilterInteger(12, invalidMonthMessage),
      yearOfBirth: z
        .number()
        .int(invalidYearMessage)
        .refine((year) => year === 0 || (year >= earliestBirthYear && year <= currentYear), invalidYearMessage),
      postcode: z.string(),
      age: z
        .number()
        .int(invalidAgeMessage)
        .refine((age) => age === 0 || (age >= minimumAge && age <= maximumAge), invalidAgeMessage),
      attributes: z.record(z.string()),
    })
    .superRefine(({ dateOfBirth: day, monthOfBirth: month, yearOfBirth: year }, context) => {
      if (day > 0 && month > 0) {
        const referenceYear = year || 2000;
        const lastDayOfMonth = new Date(referenceYear, month, 0).getDate();

        if (day > lastDayOfMonth) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('invalidBirthdate', 'Enter a valid date of birth'),
            path: ['dateOfBirth'],
          });
          return;
        }
      }

      if (day > 0 && month > 0 && year > 0) {
        const birthdate = new Date(year, month - 1, day);
        const oldestAllowedBirthdate = new Date(
          today.getFullYear() - MAX_PATIENT_AGE,
          today.getMonth(),
          today.getDate(),
        );

        if (birthdate > today) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('birthdateInFuture', 'Date of birth cannot be in the future'),
            path: ['yearOfBirth'],
          });
        } else if (birthdate < oldestAllowedBirthdate) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('birthdateTooOld', 'Date of birth cannot be more than 140 years ago'),
            path: ['yearOfBirth'],
          });
        }
      }
    });
}
