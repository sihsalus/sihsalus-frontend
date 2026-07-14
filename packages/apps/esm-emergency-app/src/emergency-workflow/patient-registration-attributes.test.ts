import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { type Config, configSchema } from '../config-schema';
import { buildEmergencyPatientAttributes } from './patient-registration-attributes';
import type { QuickRegistrationFormData } from './patient-search-registration.validation';

const config = (getDefaultsFromConfigSchema(configSchema) as Config).patientRegistration;
const peruConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';

const knownPatient: QuickRegistrationFormData = {
  givenName: 'Ada',
  familyName: 'Lovelace',
  gender: 'F',
  arrivalDateTime: '2026-07-13T10:30',
  communicationCondition: 'communicates',
  identificationStatus: 'confirmed',
  isUnknown: false,
};

describe('buildEmergencyPatientAttributes', () => {
  it.each([
    ['pending', 'bdb57e2a-d8fd-4e2b-8622-1ba60dcd3024'],
    ['partial', '37ea79cb-9ae7-4297-8e56-8c374561c73c'],
    ['confirmed', '9e42f0f1-d989-4604-902e-8a33f474f01e'],
    ['merged', '8e9518a2-828d-4e50-a110-d964b63e51e2'],
  ] as const)('stores the %s identification status as its concept UUID', (identificationStatus, conceptUuid) => {
    const attributes = buildEmergencyPatientAttributes({ ...knownPatient, identificationStatus }, config);

    expect(attributes).toContainEqual({
      attributeType: config.identificationStatusAttributeTypeUuid,
      value: conceptUuid,
    });
    expect(attributes.some((attribute) => attribute.value === identificationStatus)).toBe(false);
  });

  it('places the nationality concept UUID in the final person attributes payload', () => {
    const attributes = buildEmergencyPatientAttributes(
      { ...knownPatient, nationality: peruConceptUuid },
      config,
      new Set([peruConceptUuid]),
    );

    expect(attributes).toContainEqual({
      attributeType: config.nationalityAttributeTypeUuid,
      value: peruConceptUuid,
    });
    expect(attributes.some((attribute) => attribute.value === 'PE')).toBe(false);
  });

  it('deterministically infers Peru from a complete DNI before building the payload', () => {
    const attributes = buildEmergencyPatientAttributes(
      {
        ...knownPatient,
        identifier: '12345678',
        identifierType: config.defaultIdentifierTypeUuid,
      },
      config,
      new Set([peruConceptUuid]),
    );

    expect(attributes).toContainEqual({
      attributeType: config.nationalityAttributeTypeUuid,
      value: peruConceptUuid,
    });
  });

  it('fails closed before registration when a complete DNI cannot be matched to the nationality catalog', () => {
    const patientWithDni = {
      ...knownPatient,
      identifier: '12345678',
      identifierType: config.defaultIdentifierTypeUuid,
    };

    expect(() => buildEmergencyPatientAttributes(patientWithDni, config)).toThrow(/catálogo configurado/u);
    expect(() => buildEmergencyPatientAttributes(patientWithDni, config, new Set())).toThrow(
      /no pertenece al catálogo/u,
    );
  });

  it('preserves an explicit nationality instead of overwriting it from DNI', () => {
    const attributes = buildEmergencyPatientAttributes(
      {
        ...knownPatient,
        identifier: '12345678',
        identifierType: config.defaultIdentifierTypeUuid,
        nationality: colombiaConceptUuid,
      },
      config,
      new Set([peruConceptUuid, colombiaConceptUuid]),
    );

    expect(attributes).toContainEqual({
      attributeType: config.nationalityAttributeTypeUuid,
      value: colombiaConceptUuid,
    });
  });

  it('never puts nationality in an unidentified patient payload', () => {
    const attributes = buildEmergencyPatientAttributes(
      { ...knownPatient, isUnknown: true, nationality: peruConceptUuid },
      config,
      new Set([peruConceptUuid]),
    );

    expect(attributes).toContainEqual({
      attributeType: config.unknownPatientAttributeTypeUuid,
      value: 'true',
    });
    expect(attributes.some((attribute) => attribute.attributeType === config.nationalityAttributeTypeUuid)).toBe(false);
  });

  it('never puts stale insurance data in an unidentified patient payload', () => {
    const attributes = buildEmergencyPatientAttributes(
      {
        ...knownPatient,
        isUnknown: true,
        insuranceType: config.insuranceTypeConcepts.sisGratuitoUuid,
        insuranceCode: 'SIS-STALE',
      },
      config,
    );

    expect(attributes.some((attribute) => attribute.attributeType === config.insuranceTypeAttributeTypeUuid)).toBe(
      false,
    );
    expect(attributes.some((attribute) => attribute.attributeType === config.insuranceCodeAttributeTypeUuid)).toBe(
      false,
    );
  });

  it('refuses a UUID that is not a member of the loaded nationality catalog', () => {
    expect(() =>
      buildEmergencyPatientAttributes({ ...knownPatient, nationality: peruConceptUuid }, config, new Set()),
    ).toThrow(/no pertenece al catálogo/u);
  });

  it('refuses to persist nationality while its catalog is unavailable', () => {
    expect(() => buildEmergencyPatientAttributes({ ...knownPatient, nationality: peruConceptUuid }, config)).toThrow(
      /catálogo configurado no está disponible/u,
    );
  });
});
