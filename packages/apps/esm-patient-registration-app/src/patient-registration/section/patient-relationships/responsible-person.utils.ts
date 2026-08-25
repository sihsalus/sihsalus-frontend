import {
  calculatePatientAge,
  estimatePatientBirthdateFromAge,
  formatCalendarDate,
  getLocalCalendarDate,
  MAX_PATIENT_AGE_YEARS,
  parsePatientBirthdate,
  validatePatientBirthdate,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import { patientFamilyNameMaxLength, patientGivenNameMaxLength, patientNamePattern } from '../../patient-name-limits';
import type { NewResponsiblePersonValues } from '../../patient-registration.types';

const peruLandlinePhoneRegex = /^(?:[1-8][0-9]{7}|0[1-8][0-9]{7})$/;
const peruMobilePhoneRegex = /^(?:\+51)?9[0-9]{8}$/;

export type ResponsiblePersonFormValues = NewResponsiblePersonValues;

export type ResponsiblePersonValidationErrors = Partial<Record<keyof ResponsiblePersonFormValues, string>>;

export interface ResponsiblePersonValidationOptions {
  requireAdult?: boolean;
}

const genderToOpenmrsCode: Record<string, string> = {
  male: 'M',
  female: 'F',
  other: 'O',
  unknown: 'U',
};

function isValidPersonName(value: string) {
  return patientNamePattern.test(value.trim());
}

function validateRequiredName(value: string, requiredMessage: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return requiredMessage;
  }

  if (trimmedValue.length < 2) {
    return 'nameTooShort';
  }

  if (!isValidPersonName(trimmedValue)) {
    return 'nameContainsInvalidCharacters';
  }

  return undefined;
}

function validateOptionalName(value: string, maxLength: number, maxLengthMessage: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (trimmedValue.length > maxLength) {
    return maxLengthMessage;
  }

  if (!isValidPersonName(trimmedValue)) {
    return 'nameContainsInvalidCharacters';
  }

  return undefined;
}

function getBirthdateParts(value?: Date | string) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : getLocalCalendarDate(value);
  }

  return typeof value === 'string' ? parsePatientBirthdate(value) : null;
}

export function validateResponsiblePersonForm(
  values: ResponsiblePersonFormValues,
  options: ResponsiblePersonValidationOptions = {},
): ResponsiblePersonValidationErrors {
  const errors: ResponsiblePersonValidationErrors = {};
  const estimatedAge = values.estimatedAge.trim();
  const usesEstimatedBirthdate = values.birthdateEstimated ?? !values.birthdate;

  const givenNameError = validateRequiredName(values.givenName, 'givenNameRequired');
  if (givenNameError) {
    errors.givenName = givenNameError;
  } else if (values.givenName.trim().length > patientGivenNameMaxLength) {
    errors.givenName = 'givenNameTooLong';
  }

  const familyNameError = validateRequiredName(values.familyName, 'familyNameRequired');
  if (familyNameError) {
    errors.familyName = familyNameError;
  } else if (values.familyName.trim().length > patientFamilyNameMaxLength) {
    errors.familyName = 'familyNameTooLong';
  }

  const middleNameError = validateOptionalName(values.middleName, patientGivenNameMaxLength, 'givenNameTooLong');
  if (middleNameError) {
    errors.middleName = middleNameError;
  }

  const familyName2Error = validateOptionalName(values.familyName2, patientFamilyNameMaxLength, 'familyNameTooLong');
  if (familyName2Error) {
    errors.familyName2 = familyName2Error;
  }

  if (!values.gender || !genderToOpenmrsCode[values.gender]) {
    errors.gender = 'genderRequired';
  }

  if (usesEstimatedBirthdate) {
    if (
      !estimatedAge ||
      validatePlainNumberInput(estimatedAge, {
        integer: true,
        max: MAX_PATIENT_AGE_YEARS,
        min: 0,
        nonNegative: true,
      }).isInvalid
    ) {
      errors.estimatedAge = estimatedAge ? 'estimatedAgeInvalid' : 'responsibleEstimatedAgeRequired';
    } else if (options.requireAdult && Number(estimatedAge) < 18) {
      errors.estimatedAge = 'responsiblePersonMustBeAdult';
    }
  } else {
    const birthdate = getBirthdateParts(values.birthdate);
    const birthdateValidation = birthdate ? validatePatientBirthdate(birthdate) : 'invalid';

    if (!values.birthdate) {
      errors.birthdate = 'birthdayRequired';
    } else if (birthdateValidation === 'future') {
      errors.birthdate = 'birthdayNotInTheFuture';
    } else if (birthdateValidation === 'too-old') {
      errors.birthdate = 'birthdayNotOver140YearsAgo';
    } else if (birthdateValidation !== 'valid' || !birthdate) {
      errors.birthdate = 'birthdayInvalid';
    } else if (options.requireAdult && (calculatePatientAge(birthdate) ?? -1) < 18) {
      errors.birthdate = 'responsiblePersonMustBeAdult';
    }
  }

  if (values.phone.trim() && !peruLandlinePhoneRegex.test(values.phone.trim())) {
    errors.phone = 'phoneInvalid';
  }

  if (values.mobilePhone?.trim() && !peruMobilePhoneRegex.test(values.mobilePhone.trim())) {
    errors.mobilePhone = 'mobilePhoneInvalid';
  }

  if (!values.relationshipType?.trim()) {
    errors.relationshipType = 'relationshipTypeRequired';
  }

  return errors;
}

export function hasResponsiblePersonFormErrors(errors: ResponsiblePersonValidationErrors) {
  return Object.values(errors).some(Boolean);
}

export function getResponsiblePersonDisplayName(values: ResponsiblePersonFormValues) {
  return [values.givenName, values.middleName, values.familyName, values.familyName2]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
}

export function buildResponsiblePersonPayload(
  values: ResponsiblePersonFormValues,
  options: { mobilePhoneAttributeTypeUuid?: string; phoneAttributeTypeUuid?: string } = {},
) {
  const estimatedAge = values.estimatedAge.trim();
  const phone = values.phone.trim();
  const mobilePhone = values.mobilePhone?.trim() ?? '';
  const address =
    typeof values.address === 'string'
      ? values.address.trim()
        ? { address4: values.address.trim() }
        : {}
      : Object.fromEntries(
          Object.entries(values.address ?? {}).filter(([, value]) => typeof value === 'string' && value.trim()),
        );
  const usesEstimatedBirthdate = values.birthdateEstimated ?? !values.birthdate;
  const birthdate = usesEstimatedBirthdate
    ? estimatedAge
      ? estimatePatientBirthdateFromAge(Number(estimatedAge))
      : null
    : getBirthdateParts(values.birthdate);
  const normalizedBirthdate =
    typeof birthdate === 'string' ? birthdate : birthdate ? formatCalendarDate(birthdate) : null;

  return {
    names: [
      {
        givenName: values.givenName.trim(),
        middleName: values.middleName.trim() || undefined,
        familyName: values.familyName.trim(),
        familyName2: values.familyName2.trim() || undefined,
        preferred: true,
      },
    ],
    gender: genderToOpenmrsCode[values.gender],
    ...(normalizedBirthdate
      ? {
          birthdate: normalizedBirthdate,
          birthdateEstimated: usesEstimatedBirthdate,
        }
      : {}),
    ...((phone && options.phoneAttributeTypeUuid) || (mobilePhone && options.mobilePhoneAttributeTypeUuid)
      ? {
          attributes: [
            ...(phone && options.phoneAttributeTypeUuid
              ? [{ attributeType: options.phoneAttributeTypeUuid, value: phone }]
              : []),
            ...(mobilePhone && options.mobilePhoneAttributeTypeUuid
              ? [{ attributeType: options.mobilePhoneAttributeTypeUuid, value: mobilePhone }]
              : []),
          ],
        }
      : {}),
    ...(Object.keys(address).length
      ? {
          addresses: [
            {
              ...address,
              preferred: true,
            },
          ],
        }
      : {}),
  };
}
