import { getConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';

import { type RegistrationConfig } from '../../config-schema';

import { getValidationSchema } from './patient-registration-validation';

const mockGetConfig = vi.mocked(getConfig);
const phoneAttributeUuid = '14d4f066-15f5-102d-96e4-000c29c2a5d7';
const mobilePhoneAttributeUuid = 'fee4e8ef-aef8-4bb9-8ed0-7ded6055c61f';
const emailAttributeUuid = '4bdf3a33-2f63-11f0-8ab4-1a7535b1b3e8';
const insuranceAccreditationCheckedAtAttributeUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1006';

describe('Patient registration validation', () => {
  beforeEach(() => {
    mockGetConfig.mockResolvedValue({
      fieldConfigurations: {
        name: {
          requireFamilyName2: false,
          unidentifiedPatientAttributeTypeUuid: 'unknown-patient-attribute',
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
          'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB',
          '8d91a210-c2cc-11de-8d13-0010c6dffd0f/aIsToB',
          '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
        ],
      },
      fieldDefinitions: [
        {
          id: 'phone',
          type: 'person attribute',
          uuid: phoneAttributeUuid,
          showHeading: false,
          validation: {
            required: false,
            matches: '^(?:(?:\\+51)?[1-8][0-9]{7}|0[1-8][0-9]{7})$',
          },
        },
        {
          id: 'mobilePhone',
          type: 'person attribute',
          uuid: mobilePhoneAttributeUuid,
          showHeading: false,
          validation: {
            required: false,
            matches: '^(?:\\+51)?9[0-9]{8}$',
          },
        },
        {
          id: 'email',
          type: 'person attribute',
          uuid: emailAttributeUuid,
          showHeading: false,
          validation: {
            required: false,
            matches: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          },
        },
        {
          id: 'insuranceAccreditationCheckedAt',
          type: 'person attribute',
          uuid: insuranceAccreditationCheckedAtAttributeUuid,
          inputType: 'date',
          allowFutureDates: false,
          showHeading: false,
        },
      ],
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
    attributes: {},
  };

  const validateFormValues = async (formValues, identifierTypes = []) => {
    const config = (await getConfig('@openmrs/esm-patient-registration-app')) as unknown as RegistrationConfig;

    const validationSchema = getValidationSchema(config, identifierTypes);
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

  it('should require configurable obs and address fields', async () => {
    const config = (await getConfig('@openmrs/esm-patient-registration-app')) as unknown as RegistrationConfig;
    mockGetConfig.mockResolvedValueOnce({
      ...config,
      fieldDefinitions: [
        ...(config.fieldDefinitions ?? []),
        {
          id: 'requiredObs',
          type: 'obs',
          uuid: 'required-obs-uuid',
          validation: { required: true },
        },
        {
          id: 'requiredAddressField',
          type: 'address',
          validation: { required: true },
        },
      ],
    });

    const validationError = await validateFormValues({
      ...validFormValues,
      obs: { 'required-obs-uuid': '' },
      requiredAddressField: '',
    });

    expect(validationError.inner).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'obs.required-obs-uuid', message: 'fieldRequired' }),
        expect.objectContaining({ path: 'requiredAddressField', message: 'fieldRequired' }),
      ]),
    );
  });

  it('should reject names shorter than 2 characters', async () => {
    const invalidFormValues = {
      ...validFormValues,
      givenName: 'J',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('nameTooShort');
  });

  it('should reject names containing digits', async () => {
    const invalidFormValues = {
      ...validFormValues,
      familyName: 'D03',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('nameContainsInvalidCharacters');
  });

  it.each([
    ['middleName', 'R2'],
    ['familyName2', 'D03'],
    ['additionalMiddleName', 'R2'],
    ['additionalFamilyName2', 'D03'],
  ])('should reject digits in optional name field %s', async (fieldName, value) => {
    const invalidFormValues = {
      ...validFormValues,
      [fieldName]: value,
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('nameContainsInvalidCharacters');
  });

  it('should reject names containing forbidden symbols', async () => {
    const invalidFormValues = {
      ...validFormValues,
      givenName: 'John@',
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('nameContainsInvalidCharacters');
  });

  it('should allow names with accents, hyphens and apostrophes', async () => {
    const validNameValues = {
      ...validFormValues,
      givenName: 'José',
      familyName: "O'Brien-De la Cruz",
    };
    const validationError = await validateFormValues(validNameValues);
    expect(validationError).toBeFalsy();
  });

  it('should reject given names longer than 150 characters', async () => {
    const invalidFormValues = {
      ...validFormValues,
      givenName: 'A'.repeat(151),
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('givenNameTooLong');
  });

  it('should reject family names longer than 100 characters', async () => {
    const invalidFormValues = {
      ...validFormValues,
      familyName: 'A'.repeat(101),
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('familyNameTooLong');
  });

  it('should allow valid residence contact attributes', async () => {
    const validValues = {
      ...validFormValues,
      attributes: {
        [emailAttributeUuid]: 'john.doe@example.org',
        [phoneAttributeUuid]: '012345678',
        [mobilePhoneAttributeUuid]: '999888777',
      },
    };

    const validationError = await validateFormValues(validValues);

    expect(validationError).toBeFalsy();
  });

  it('should allow mobile phone contact attributes with an international prefix', async () => {
    const validValues = {
      ...validFormValues,
      attributes: {
        [mobilePhoneAttributeUuid]: '+51900000000',
      },
    };

    const validationError = await validateFormValues(validValues);

    expect(validationError).toBeFalsy();
  });

  it('should reject invalid email contact attributes', async () => {
    const invalidFormValues = {
      ...validFormValues,
      attributes: {
        [emailAttributeUuid]: 'not-an-email',
      },
    };

    const validationError = await validateFormValues(invalidFormValues);

    expect(validationError.errors).toContain('invalidInput');
  });

  it('should reject scientific notation in phone attributes', async () => {
    const invalidFormValues = {
      ...validFormValues,
      attributes: {
        [phoneAttributeUuid]: 'e100',
      },
    };

    const validationError = await validateFormValues(invalidFormValues);

    expect(validationError.errors).toContain('invalidInput');
  });

  it('should reject a mobile number in the landline phone field', async () => {
    const invalidFormValues = {
      ...validFormValues,
      attributes: {
        [phoneAttributeUuid]: '999888777',
      },
    };

    const validationError = await validateFormValues(invalidFormValues);

    expect(validationError.errors).toContain('invalidInput');
  });

  it('should reject an identifier that does not match the backend format', async () => {
    const identifierTypes = [
      { fieldName: 'nationalId', format: '^[0-9]{8}$', name: 'National ID', uuid: 'national-id-uuid' },
    ];
    const invalidFormValues = {
      ...validFormValues,
      identifiers: {
        nationalId: { required: true, identifierValue: '123456789', identifierTypeUuid: 'national-id-uuid' },
      },
    };
    const validationError = await validateFormValues(invalidFormValues, identifierTypes);
    expect(validationError.errors).toContain('identifierInvalidFormat');
  });

  it('should allow an identifier that matches the backend format', async () => {
    const identifierTypes = [{ fieldName: 'nationalId', format: '^[0-9]{8}$', name: 'DNI', uuid: 'dni-uuid' }];
    const validIdentifierValues = {
      ...validFormValues,
      identifiers: {
        nationalId: { required: true, identifierValue: '12345678', identifierTypeUuid: 'dni-uuid' },
      },
    };
    const validationError = await validateFormValues(validIdentifierValues, identifierTypes);
    expect(validationError).toBeFalsy();
  });

  it('should enforce the Peru DNI length even when the backend format is absent', async () => {
    const identifierTypes = [{ fieldName: 'nationalId', format: '', name: 'DNI', uuid: 'dni-uuid' }];
    const invalidFormValues = {
      ...validFormValues,
      identifiers: {
        nationalId: { required: true, identifierValue: '123456789', identifierTypeUuid: 'dni-uuid' },
      },
    };
    const validationError = await validateFormValues(invalidFormValues, identifierTypes);
    expect(validationError.errors).toContain('dniIdentifierInvalid');
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

  it('should throw an error when insurance accreditation date is before date of birth', async () => {
    const invalidFormValues = {
      ...validFormValues,
      birthdate: new Date(1990, 0, 1),
      attributes: {
        [insuranceAccreditationCheckedAtAttributeUuid]: '1989-12-31',
      },
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('insuranceAccreditationDateBeforeBirthdate');
  });

  it('should allow insurance accreditation date on date of birth', async () => {
    const validFormValuesWithInsuranceAccreditation = {
      ...validFormValues,
      birthdate: new Date(1990, 0, 1),
      attributes: {
        [insuranceAccreditationCheckedAtAttributeUuid]: '1990-01-01',
      },
    };
    const validationError = await validateFormValues(validFormValuesWithInsuranceAccreditation);
    expect(validationError).toBeFalsy();
  });

  it('should throw an error when insurance accreditation date is in the future', async () => {
    const invalidFormValues = {
      ...validFormValues,
      attributes: {
        [insuranceAccreditationCheckedAtAttributeUuid]: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      },
    };
    const validationError = await validateFormValues(invalidFormValues);
    expect(validationError.errors).toContain('dateCannotBeInFuture');
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

  it('should require a responsible party when the patient is unidentified', async () => {
    const invalidFormValues = {
      ...validFormValues,
      attributes: {
        'unknown-patient-attribute': 'true',
      },
      relationships: [],
    };

    const validationError = await validateFormValues(invalidFormValues);

    expect(validationError.errors).toContain('responsibleRequiredForUnidentifiedPatient');
  });

  it('should allow an unidentified patient with a responsible relationship', async () => {
    const unidentifiedWithResponsibleRelationship = {
      ...validFormValues,
      attributes: {
        'unknown-patient-attribute': 'true',
      },
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relationshipType: '057de23f-3d9c-4314-9391-4452970739c6/bIsToA',
        },
      ],
    };

    const validationError = await validateFormValues(unidentifiedWithResponsibleRelationship);

    expect(validationError).toBeFalsy();
  });

  it('should allow a minor patient with a responsible relationship', async () => {
    const minorWithRelationship = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relationshipType: 'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB',
        },
      ],
    };
    const validationError = await validateFormValues(minorWithRelationship);
    expect(validationError).toBeFalsy();
  });

  it('should not allow a minor patient with an underage responsible relationship', async () => {
    const minorWithUnderageResponsible = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relatedPersonAge: 16,
          relationshipType: 'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB',
        },
      ],
    };

    const validationError = await validateFormValues(minorWithUnderageResponsible);

    expect(validationError.errors).toContain('responsiblePersonMustBeAdult');
    expect(validationError.errors).not.toContain('responsibleRelationshipRequiredForMinor');
  });

  it('should not allow a minor patient with a pending underage responsible person', async () => {
    const minorWithPendingUnderageResponsible = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '',
          relationshipType: 'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB',
          newPerson: {
            givenName: 'Luis',
            middleName: '',
            familyName: 'Quispe',
            familyName2: '',
            gender: 'male',
            estimatedAge: '16',
            phone: '',
            address: '',
            relationshipType: 'e6be4def-dbc8-462a-8714-53da66903cb8/aIsToB',
          },
        },
      ],
    };

    const validationError = await validateFormValues(minorWithPendingUnderageResponsible);

    expect(validationError.errors).toContain('responsiblePersonMustBeAdult');
    expect(validationError.errors).not.toContain('responsibleRelationshipRequiredForMinor');
  });

  it('should not allow a minor patient with a non-responsible relationship only', async () => {
    const minorWithNonResponsibleRelationship = {
      ...validFormValues,
      birthdate: dayjs().subtract(10, 'years').toDate(),
      relationships: [
        {
          action: 'ADD',
          relatedPersonUuid: '11524ae7-3ef6-4ab6-aff6-804ffc58704a',
          relationshipType: 'e6be4def-dbc8-462a-8714-53da66903cb8/bIsToA',
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
