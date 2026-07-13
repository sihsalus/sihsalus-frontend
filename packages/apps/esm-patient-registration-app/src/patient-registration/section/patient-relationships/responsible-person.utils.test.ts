import {
  buildResponsiblePersonPayload,
  getResponsiblePersonDisplayName,
  hasResponsiblePersonFormErrors,
  type ResponsiblePersonFormValues,
  validateResponsiblePersonForm,
} from './responsible-person.utils';

const validResponsiblePerson: ResponsiblePersonFormValues = {
  givenName: 'María',
  middleName: '',
  familyName: 'De la Cruz',
  familyName2: 'Quispe',
  gender: 'female',
  estimatedAge: '35',
  phone: '',
  address: '',
  relationshipType: '057de23f-3d9c-4314-9391-4452970739c6/aIsToB',
};

describe('responsible person utilities', () => {
  it('builds an OpenMRS Person payload without creating a Patient identifier', () => {
    const payload = buildResponsiblePersonPayload(validResponsiblePerson);
    const today = new Date();
    const expectedBirthdate = `${today.getFullYear() - 35}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(payload).toEqual({
      names: [
        {
          givenName: 'María',
          middleName: undefined,
          familyName: 'De la Cruz',
          familyName2: 'Quispe',
          preferred: true,
        },
      ],
      gender: 'F',
      birthdate: expectedBirthdate,
      birthdateEstimated: true,
    });
    expect(payload).not.toHaveProperty('identifiers');
  });

  it('adds optional phone and address to the OpenMRS Person payload', () => {
    const payload = buildResponsiblePersonPayload(
      {
        ...validResponsiblePerson,
        phone: '987654321',
        address: 'Av. Peru 123',
      },
      { phoneAttributeTypeUuid: 'phone-attribute-uuid' },
    );

    expect(payload).toMatchObject({
      attributes: [{ attributeType: 'phone-attribute-uuid', value: '987654321' }],
      addresses: [{ address1: 'Av. Peru 123', preferred: true }],
    });
    expect(payload).not.toHaveProperty('identifiers');
  });

  it('allows optional middle name, second family name, and approximate age', () => {
    const errors = validateResponsiblePersonForm({
      ...validResponsiblePerson,
      middleName: '',
      familyName2: '',
      estimatedAge: '',
    });

    expect(hasResponsiblePersonFormErrors(errors)).toBe(false);
  });

  it('rejects digits and symbols in person names', () => {
    const errors = validateResponsiblePersonForm({
      ...validResponsiblePerson,
      givenName: 'María2',
      familyName: 'Quispe@',
    });

    expect(errors.givenName).toBe('nameContainsInvalidCharacters');
    expect(errors.familyName).toBe('nameContainsInvalidCharacters');
  });

  it('rejects responsible person names that exceed patient name limits', () => {
    const errors = validateResponsiblePersonForm({
      ...validResponsiblePerson,
      givenName: 'A'.repeat(151),
      middleName: 'B'.repeat(151),
      familyName: 'C'.repeat(101),
      familyName2: 'D'.repeat(101),
    });

    expect(errors.givenName).toBe('givenNameTooLong');
    expect(errors.middleName).toBe('givenNameTooLong');
    expect(errors.familyName).toBe('familyNameTooLong');
    expect(errors.familyName2).toBe('familyNameTooLong');
  });

  it('requires relationship type before creating a responsible person', () => {
    const errors = validateResponsiblePersonForm({
      ...validResponsiblePerson,
      relationshipType: '',
    });

    expect(errors.relationshipType).toBe('relationshipTypeRequired');
  });

  it('rejects invalid approximate ages', () => {
    expect(validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: 'e100' }).estimatedAge).toBe(
      'estimatedAgeInvalid',
    );
    expect(validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: '141' }).estimatedAge).toBe(
      'estimatedAgeInvalid',
    );
    expect(
      validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: '140' }).estimatedAge,
    ).toBeUndefined();
  });

  it('rejects invalid responsible person phone numbers', () => {
    expect(validateResponsiblePersonForm({ ...validResponsiblePerson, phone: 'e100' }).phone).toBe('phoneInvalid');
  });

  it('requires an adult age when the related person must be responsible for a minor', () => {
    expect(
      validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: '' }, { requireAdult: true })
        .estimatedAge,
    ).toBe('responsibleEstimatedAgeRequired');
    expect(
      validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: '17' }, { requireAdult: true })
        .estimatedAge,
    ).toBe('responsiblePersonMustBeAdult');
    expect(
      validateResponsiblePersonForm({ ...validResponsiblePerson, estimatedAge: '18' }, { requireAdult: true })
        .estimatedAge,
    ).toBeUndefined();
  });

  it('formats the display name for the created person', () => {
    expect(getResponsiblePersonDisplayName(validResponsiblePerson)).toBe('María De la Cruz Quispe');
  });
});
