import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { type Config, configSchema } from '../config-schema';
import {
  createQuickRegistrationSchema,
  normalizeEmergencyRegistrationData,
  type QuickRegistrationFormData,
  quickRegistrationSchema,
} from './patient-search-registration.validation';

const validKnownPatient: QuickRegistrationFormData = {
  givenName: 'Ada',
  familyName: 'Lovelace',
  gender: 'F',
  arrivalDateTime: '2026-05-30T10:30',
  communicationCondition: 'communicates',
  identificationStatus: 'confirmed',
  isUnknown: false,
};
const peruNationalityConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';
const patientRegistrationConfig = (getDefaultsFromConfigSchema(configSchema) as Config).patientRegistration;
const configuredQuickRegistrationSchema = createQuickRegistrationSchema(patientRegistrationConfig);

describe('quickRegistrationSchema', () => {
  it('accepts a known communicative patient without a responsible party', () => {
    expect(() => quickRegistrationSchema.parse(validKnownPatient)).not.toThrow();
  });

  it('accepts concept UUIDs and rejects legacy country codes for nationality', () => {
    expect(
      quickRegistrationSchema.safeParse({ ...validKnownPatient, nationality: peruNationalityConceptUuid }).success,
    ).toBe(true);
    expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, nationality: 'PE' }).success).toBe(false);
    expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, nationality: 'OTHER' }).success).toBe(false);
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

  it('uses the OpenMRS patient age limit and keeps age zero valid', () => {
    for (const yearsEstimated of [0, 140]) {
      const result = quickRegistrationSchema.safeParse({ ...validKnownPatient, yearsEstimated });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.yearsEstimated).toBe(yearsEstimated);
      }
    }

    expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, yearsEstimated: 141 }).success).toBe(false);
  });

  it('validates exact birthdates using the OpenMRS calendar boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 12));

    try {
      expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, birthdate: '1886-07-13' }).success).toBe(true);
      expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, birthdate: '1886-07-12' }).success).toBe(false);
      expect(quickRegistrationSchema.safeParse({ ...validKnownPatient, birthdate: '2026-07-14' }).success).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [patientRegistrationConfig.defaultIdentifierTypeUuid, '12345678', '12345678'],
    [patientRegistrationConfig.foreignCardIdentifierTypeUuid, 'ab123456', 'AB123456'],
    [patientRegistrationConfig.passportIdentifierTypeUuid, 'pa123456', 'PA123456'],
    [patientRegistrationConfig.dieIdentifierTypeUuid, 'die123456', 'DIE123456'],
    [patientRegistrationConfig.liveBirthCertificateIdentifierTypeUuid, '123456789012', '123456789012'],
  ])('accepts and normalizes a valid configured identity document', (identifierType, identifier, normalized) => {
    const result = configuredQuickRegistrationSchema.safeParse({
      ...validKnownPatient,
      identifierType,
      identifier,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(normalizeEmergencyRegistrationData(result.data, patientRegistrationConfig).identifier).toBe(normalized);
    }
  });

  it.each([
    [patientRegistrationConfig.defaultIdentifierTypeUuid, '1234567'],
    [patientRegistrationConfig.foreignCardIdentifierTypeUuid, 'ABC12'],
    [patientRegistrationConfig.passportIdentifierTypeUuid, 'ABC12'],
    [patientRegistrationConfig.dieIdentifierTypeUuid, 'ABC1234567890123'],
    [patientRegistrationConfig.liveBirthCertificateIdentifierTypeUuid, '12345678901'],
    ['unknown-identifier-type', 'ABC123'],
  ])('rejects an invalid document/type combination', (identifierType, identifier) => {
    expect(
      configuredQuickRegistrationSchema.safeParse({ ...validKnownPatient, identifierType, identifier }).success,
    ).toBe(false);
  });

  it('strips hidden identity, birthdate, nationality, insurance and address data from an unidentified patient', () => {
    const normalized = normalizeEmergencyRegistrationData(
      {
        ...validKnownPatient,
        birthdate: '1990-01-01',
        identifier: '12345678',
        identifierType: patientRegistrationConfig.defaultIdentifierTypeUuid,
        insuranceCode: 'SIS-STALE',
        insuranceType: patientRegistrationConfig.insuranceTypeConcepts.sisGratuitoUuid,
        isUnknown: true,
        nationality: peruNationalityConceptUuid,
        address: 'Jr. Oculto 123',
        district: 'NAPO',
        village: 'SANTA CLOTILDE',
      },
      patientRegistrationConfig,
    );

    expect(normalized).toEqual(
      expect.objectContaining({
        birthdate: undefined,
        address: undefined,
        district: undefined,
        identifier: undefined,
        identifierType: undefined,
        insuranceCode: undefined,
        insuranceType: undefined,
        nationality: undefined,
        village: undefined,
      }),
    );
  });

  it('strips a hidden estimated age from a known patient', () => {
    const normalized = normalizeEmergencyRegistrationData(
      { ...validKnownPatient, birthdate: '1990-01-01', yearsEstimated: 35 },
      patientRegistrationConfig,
    );

    expect(normalized.birthdate).toBe('1990-01-01');
    expect(normalized.yearsEstimated).toBeUndefined();
  });
});
