import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema } from '../config-schema';
import {
  getEffectiveRegistrationConfig,
  peruDniPatientIdentifierTypeUuid,
  peruForeignPatientIdentifierTypeUuids,
} from './peru-registration-config';

describe('getEffectiveRegistrationConfig', () => {
  it('adds nationality immediately after identifiers in demographics', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));

    const demographics = config.sectionDefinitions.find((section) => section.id === 'demographics');
    const filiation = config.sectionDefinitions.find((section) => section.id === 'filiation');
    const nationality = config.fieldDefinitions.find((field) => field.id === 'nationality');

    expect(demographics?.fields).toEqual(['name', 'gender', 'dob', 'id', 'nationality']);
    expect(filiation?.fields).not.toContain('nationality');
    expect(nationality).toMatchObject({
      id: 'nationality',
      type: 'person attribute',
      uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db1007',
      label: 'Nacionalidad',
    });
  });

  it('keeps CE, passport, and foreign document as foreign identifier triggers', () => {
    expect(peruForeignPatientIdentifierTypeUuids).toEqual([
      '550e8400-e29b-41d4-a716-446655440002',
      '550e8400-e29b-41d4-a716-446655440003',
      '8d793bee-c2cc-11de-8d13-0010c6dffd0f',
    ]);
  });

  it('uses DNI as the only Peru default patient identifier', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));

    expect(config.defaultPatientIdentifierTypes).toEqual([peruDniPatientIdentifierTypeUuid]);
  });
});
