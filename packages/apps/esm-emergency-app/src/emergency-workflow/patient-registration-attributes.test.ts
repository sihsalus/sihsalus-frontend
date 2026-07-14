import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { type Config, configSchema } from '../config-schema';
import { buildEmergencyPatientAttributes } from './patient-registration-attributes';
import type { QuickRegistrationFormData } from './patient-search-registration.validation';

const config = (getDefaultsFromConfigSchema(configSchema) as Config).patientRegistration;
const peruConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';

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

  it('refuses a UUID that is not a member of the loaded nationality catalog', () => {
    expect(() =>
      buildEmergencyPatientAttributes({ ...knownPatient, nationality: peruConceptUuid }, config, new Set()),
    ).toThrow(/no pertenece al catálogo/u);
  });
});
