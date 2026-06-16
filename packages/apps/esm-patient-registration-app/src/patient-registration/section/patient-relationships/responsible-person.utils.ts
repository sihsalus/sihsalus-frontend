const personNameRegex = /^\p{L}[\p{L}\p{M}'.\- ]*$/u;
const estimatedAgeRegex = /^(?:[0-9]|[1-9][0-9]|1[01][0-9]|120)$/;

export interface ResponsiblePersonFormValues {
  givenName: string;
  middleName: string;
  familyName: string;
  familyName2: string;
  gender: string;
  estimatedAge: string;
  relationshipType: string;
}

export type ResponsiblePersonValidationErrors = Partial<Record<keyof ResponsiblePersonFormValues, string>>;

const genderToOpenmrsCode: Record<string, string> = {
  male: 'M',
  female: 'F',
  other: 'O',
  unknown: 'U',
};

function isValidPersonName(value: string) {
  return personNameRegex.test(value.trim());
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

function validateOptionalName(value: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (!isValidPersonName(trimmedValue)) {
    return 'nameContainsInvalidCharacters';
  }

  return undefined;
}

export function validateResponsiblePersonForm(values: ResponsiblePersonFormValues): ResponsiblePersonValidationErrors {
  const errors: ResponsiblePersonValidationErrors = {};

  const givenNameError = validateRequiredName(values.givenName, 'givenNameRequired');
  if (givenNameError) {
    errors.givenName = givenNameError;
  }

  const familyNameError = validateRequiredName(values.familyName, 'familyNameRequired');
  if (familyNameError) {
    errors.familyName = familyNameError;
  }

  const middleNameError = validateOptionalName(values.middleName);
  if (middleNameError) {
    errors.middleName = middleNameError;
  }

  const familyName2Error = validateOptionalName(values.familyName2);
  if (familyName2Error) {
    errors.familyName2 = familyName2Error;
  }

  if (!values.gender || !genderToOpenmrsCode[values.gender]) {
    errors.gender = 'genderRequired';
  }

  if (values.estimatedAge.trim() && !estimatedAgeRegex.test(values.estimatedAge.trim())) {
    errors.estimatedAge = 'estimatedAgeInvalid';
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

export function buildResponsiblePersonPayload(values: ResponsiblePersonFormValues) {
  const estimatedAge = values.estimatedAge.trim();
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
  };
}
