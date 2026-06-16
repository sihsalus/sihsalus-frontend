import { quickRegistrationSchema } from './patient-search-registration.validation';

const validKnownPatient = {
  givenName: 'Ada',
  familyName: 'Lovelace',
  gender: 'F',
  arrivalDateTime: '2026-05-30T10:30',
  communicationCondition: 'communicates',
  identificationStatus: 'confirmed',
  isUnknown: false,
};

describe('quickRegistrationSchema', () => {
  it('accepts a known communicative patient without a responsible party', () => {
    expect(() => quickRegistrationSchema.parse(validKnownPatient)).not.toThrow();
  });

  it('requires communication condition and responsible party for unidentified patients', () => {
    const result = quickRegistrationSchema.safeParse({
      ...validKnownPatient,
      givenName: 'DESCONOCIDO',
      familyName: 'DESCONOCIDO',
      isUnknown: true,
      communicationCondition: '',
      identificationStatus: 'pending',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['communicationCondition', 'responsibleType', 'companionName']),
      );
    }
  });

  it('accepts an unidentified patient with minimum emergency context and responsible institution', () => {
    expect(() =>
      quickRegistrationSchema.parse({
        ...validKnownPatient,
        givenName: 'DESCONOCIDO',
        familyName: 'DESCONOCIDO',
        gender: 'U',
        isUnknown: true,
        communicationCondition: 'unconscious',
        identificationStatus: 'pending',
        responsibleType: 'police',
        companionName: 'PNP Comisaría Napo',
      }),
    ).not.toThrow();
  });

  it('requires a responsible party when a known patient is incapacitated', () => {
    const result = quickRegistrationSchema.safeParse({
      ...validKnownPatient,
      communicationCondition: 'non_verbal',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['responsibleType', 'companionName']),
      );
    }
  });

  it('rejects scientific notation and signed values in age fields', () => {
    for (const yearsEstimated of ['1e2', '+12', '-1', '12.5']) {
      expect(
        quickRegistrationSchema.safeParse({
          ...validKnownPatient,
          birthdateEstimated: true,
          yearsEstimated,
        }).success,
      ).toBe(false);
    }

    for (const companionAge of ['1e2', '+12', '-1', '12.5']) {
      expect(
        quickRegistrationSchema.safeParse({
          ...validKnownPatient,
          communicationCondition: 'non_verbal',
          responsibleType: 'family',
          companionName: 'Ana Perez',
          companionAge,
        }).success,
      ).toBe(false);
    }
  });
});
