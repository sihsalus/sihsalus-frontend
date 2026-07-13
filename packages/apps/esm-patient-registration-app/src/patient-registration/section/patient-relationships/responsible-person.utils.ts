import type { NewResponsiblePersonValues } from '../../patient-registration.types';
import { patientFamilyNameMaxLength, patientGivenNameMaxLength, patientNamePattern } from '../../patient-name-limits';

const estimatedAgeRegex = /^(?:[0-9]|[1-9][0-9]|1[01][0-9]|120)$/;
const peruContactPhoneRegex = /^(?:(?:\+51)?9[0-9]{8}|(?:\+51)?[1-8][0-9]{7}|0[1-8][0-9]{7})$/;

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

export function validateResponsiblePersonForm(
  values: ResponsiblePersonFormValues,
  options: ResponsiblePersonValidationOptions = {},
): ResponsiblePersonValidationErrors {
  const errors: ResponsiblePersonValidationErrors = {};
  const estimatedAge = values.estimatedAge.trim();

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

  if (estimatedAge && !estimatedAgeRegex.test(estimatedAge)) {
    errors.estimatedAge = 'estimatedAgeInvalid';
  } else if (options.requireAdult && !estimatedAge) {
    errors.estimatedAge = 'responsibleEstimatedAgeRequired';
  } else if (options.requireAdult && Number(estimatedAge) < 18) {
    errors.estimatedAge = 'responsiblePersonMustBeAdult';
  }

  if (values.phone.trim() && !peruContactPhoneRegex.test(values.phone.trim())) {
    errors.phone = 'phoneInvalid';
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
  options: { phoneAttributeTypeUuid?: string } = {},
) {
  const estimatedAge = values.estimatedAge.trim();
  const phone = values.phone.trim();
  const address = values.address.trim();
  const birthYear = estimatedAge ? new Date().getFullYear() - Number(estimatedAge) : undefined;

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
    ...(birthYear
      ? {
          birthdate: `${birthYear}-01-01`,
          birthdateEstimated: true,
        }
      : {}),
    ...(phone && options.phoneAttributeTypeUuid
      ? {
          attributes: [
            {
              attributeType: options.phoneAttributeTypeUuid,
              value: phone,
            },
          ],
        }
      : {}),
    ...(address
      ? {
          addresses: [
            {
              address1: address,
              preferred: true,
            },
          ],
        }
      : {}),
  };
}
