import { getConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';

import { type RegistrationConfig } from '../../config-schema';

import { getValidationSchema } from './patient-registration-validation';

const mockGetConfig = vi.mocked(getConfig);

describe('Patient registration validation', () => {
  beforeEach(() => {
    mockGetConfig.mockResolvedValue({
      fieldConfigurations: {
        name: {
          requireFamilyName2: false,
        },
        gender: [
          {
            label: 'M',
            value: 'male',
          },
          {
            label: 'F',
            value: 'female',
          },
          {
            label: 'O',
            value: 'other',
          },
          {
            label: 'U',
            value: 'unknown',
          },
        ],
      },
      relationshipOptions: {
        minorResponsibleRelationshipTypes: [
          '8d91a210-c2cc-11de-8d13-0010c6dffdff/aIsToB',
          '8d91a210-c2cc-11de-8d13-0010c6dffd0f/aIsToB',
          '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
        ],
      },
    });
  });

  const validFormValues = {
    additionalFamilyName: '',
    additionalFamilyName2: '',
    additionalGivenName: '',
    birthdate: new Date('1990-01-01'),
    birthdateEstimated: false,
    isDead: false,
    causeOfDeath: null,
    deathDate: null,
    email: 'john.doe@example.com',
    familyName: 'Doe',
    familyName2: '',
    gender: 'male',
    givenName: 'John',
    identifiers: {
      nationalId: {
        required: true,
        identifierValue: '123456789',
      },
      passportId: {
        required: false,
        identifierValue: '',
      },
    },
    relationships: [],
  };

  const validateFormValues = async (formValues) => {
    const config = (await getConfig('@openmrs/esm-patient-registration-app')) as unknown as RegistrationConfig;

    const validationSchema = getValidationSchema(config);
    try {
      await validationSchema.validate(formValues, { abortEarly: false });
    } catch (err) {
      return err;
    }
  };

  it('should allow valid form values', async () => {
    const validationError = await validateFormValues(validFormValues);
    expect(validationError).toBeFalsy();
  });

  it('should require givenName', async () => {
    const invalidFormValues = {
      ...validFormValues,
      givenName: '',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('givenNameRequired');
  });

  it('should require familyName', async () => {
    const invalidFormValues = {
      ...validFormValues,
      familyName: '',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('familyNameRequired');
  });

  it('should require additionalGivenName when addNameInLocalLanguage is true', async () => {
    const invalidFormValues = {
      ...validFormValues,
      addNameInLocalLanguage: true,
      additionalGivenName: '',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('givenNameRequired');
  });

  it('should require additionalFamilyName when addNameInLocalLanguage is true', async () => {
    const invalidFormValues = {
      ...validFormValues,
      addNameInLocalLanguage: true,
      additionalFamilyName: '',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('familyNameRequired');
  });

  it('should require familyName2 when requireFamilyName2 is true', async () => {
    mockGetConfig.mockResolvedValue({
      fieldConfigurations: {
        name: { requireFamilyName2: true },
        gender: [
          { label: 'M', value: 'male' },
          { label: 'F', value: 'female' },
          { label: 'O', value: 'other' },
          { label: 'U', value: 'unknown' },
        ],
      },
    });
    const invalidFormValues = { ...validFormValues, familyName2: '' };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('familyName2Required');
  });

  it('should not require familyName2 when requireFamilyName2 is false', async () => {
    const validWithoutFamilyName2 = { ...validFormValues, familyName2: '' };
    const validationError = await validateFormValues(validWithoutFamilyName2);
    expect(validationError).toBeFalsy();
  });

  it('should require gender', async () => {
    const invalidFormValues = {
      ...validFormValues,
      gender: '',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('genderUnspecified');
  });

  it('should allow female as a valid gender', async () => {
    const validFormValuesWithOtherGender = {
      ...validFormValues,
      gender: 'female',
    };
    const validationError = await validateFormValues(validFormValuesWithOtherGender);
    expect(validationError).toBeFalsy();
  });

  it('should allow other as a valid gender', async () => {
    const validFormValuesWithOtherGender = {
      ...validFormValues,
      gender: 'other',
    };
    const validationError = await validateFormValues(validFormValuesWithOtherGender);
    expect(validationError).toBeFalsy();
  });

  it('should allow unknown as a valid gender', async () => {
    const validFormValuesWithOtherGender = {
      ...validFormValues,
      gender: 'unknown',
    };
    const validationError = await validateFormValues(validFormValuesWithOtherGender);
    expect(validationError).toBeFalsy();
  });

  it('should throw an error when date of birth is a future date', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdate: new Date('2100-01-01'),
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('birthdayNotInTheFuture');
  });

  it('should throw an error when date of birth is more than 140 years ago', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdate: dayjs().subtract(141, 'years').toDate(),
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('birthdayNotOver140YearsAgo');
  });

  it('should require a responsible relationship when the patient is a minor', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [],
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('responsibleRelationshipRequiredForMinor');
  });

  it('should allow a minor patient with a responsible relationship', async () => {
    const minorWithRelationship = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relationshipType: '8d91a210-c2cc-11de-8d13-0010c6dffdff/aIsToB',
        },
      ],
    };
    const validationError = await validateFormValues(minorWithRelationship);
    expect(validationError).toBeFalsy();
  });

  it('should not allow a minor patient with a non-responsible relationship only', async () => {
    const minorWithNonResponsibleRelationship = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relationshipType: '8d91a210-c2cc-11de-8d13-0010c6dffdff/bIsToA',
        },
      ],
    };
    const validationError = await validateFormValues(minorWithNonResponsibleRelationship);
    expect(validationError.errors).toContain('responsibleRelationshipRequiredForMinor');
  });

  it('should require a responsible relationship when the estimated age is under 18', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdate: '',
      birthdateEstimated: true,
      yearsEstimated: 17,
      relationships: [],
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('responsibleRelationshipRequiredForMinor');
  });

  it('should require yearsEstimated when birthdateEstimated is true', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdateEstimated: true,
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('yearsEstimateRequired');
  });

  it('should throw an error when monthEstimated is negative', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdateEstimated: true,
      yearsEstimated: 0,
      monthsEstimated: -1,
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('negativeMonths');
  });

  it('should throw an error when yearsEstimated is more than 140', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdateEstimated: true,
      yearsEstimated: 141,
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('nonsensicalYears');
  });

  it('should throw an error when deathDate is in future', async () => {
    const invalidFormValues = {
      ...validFormValues,
      deathDate: new Date('2100-01-01'),
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('deathDateInFuture');
  });
});
