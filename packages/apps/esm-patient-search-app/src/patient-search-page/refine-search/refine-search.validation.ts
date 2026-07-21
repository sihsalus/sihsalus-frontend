import { MAX_PATIENT_AGE_YEARS, MIN_PATIENT_AGE_YEARS } from '@openmrs/esm-utils';
import { z } from 'zod';

import { MAX_PATIENT_AGE_DAYS, MAX_PATIENT_AGE_MONTHS } from '../patient-age-filter';

type Translate = (key: string, defaultValue: string, options?: Record<string, unknown>) => string;

const optionalFilterInteger = (min: number, max: number, message: string) =>
  z.number().int(message).min(min, message).max(max, message).nullable();

export function createRefineSearchSchema(
  t: Translate,
  minimumAge = MIN_PATIENT_AGE_YEARS,
  maximumAge = MAX_PATIENT_AGE_YEARS,
  _today = new Date(),
) {
  const invalidAgeMessage = t('invalidAge', 'Enter an age between {{min}} and {{max}}', {
    min: minimumAge,
    max: maximumAge,
  });

  return z
    .object({
      query: z.string(),
      gender: z.enum(['any', 'male', 'female', 'other', 'unknown']),
      postcode: z.string(),
      age: optionalFilterInteger(MIN_PATIENT_AGE_YEARS, MAX_PATIENT_AGE_YEARS, invalidAgeMessage),
      ageUnit: z.enum(['days', 'months', 'years']),
      activeVisitStatus: z.enum(['any', 'active', 'inactive']),
      attributes: z.record(z.string()),
    })
    .superRefine(({ age, ageUnit }, context) => {
      if (age == null) {
        return;
      }

      const unitMaximum =
        ageUnit === 'days' ? MAX_PATIENT_AGE_DAYS : ageUnit === 'months' ? MAX_PATIENT_AGE_MONTHS : maximumAge;
      const unitMinimum = ageUnit === 'years' ? minimumAge : 0;

      if (age < unitMinimum || age > unitMaximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('invalidAgeForUnit', 'Enter an age between {{min}} and {{max}} for the selected unit', {
            min: unitMinimum,
            max: unitMaximum,
          }),
          path: ['age'],
        });
      }
    });
}
