import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import {
  getEffectiveRegistrationConfig,
  peruDniPatientIdentifierTypeUuid,
  peruEmailAttributeTypeUuid,
  peruForeignPatientIdentifierTypeUuids,
  peruNationalityAttributeTypeUuid,
  peruNationalityConceptSetUuid,
  peruNationalityConceptUuid,
  peruPhoneAttributeTypeUuid,
} from './peru-registration-config';

describe('getEffectiveRegistrationConfig', () => {
  it('orders Peru basic info fields for registration', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));

    const identityLookup = config.sectionDefinitions.find((section) => section.id === 'identityLookup');
    const demographics = config.sectionDefinitions.find((section) => section.id === 'demographics');
    const contact = config.sectionDefinitions.find((section) => section.id === 'contact');
    const filiation = config.sectionDefinitions.find((section) => section.id === 'filiation');
    const bloodData = config.sectionDefinitions.find((section) => section.id === 'bloodData');
    const nationality = config.fieldDefinitions.find((field) => field.id === 'nationality');

    expect(identityLookup?.fields).toEqual(['id', 'reniecLookup', 'sisLookup']);
    expect(demographics?.fields).toEqual(['name', 'dob', 'gender', 'nationality']);
    expect(contact).toMatchObject({
      id: 'contact',
      fields: ['address', 'birthAddress', 'phone', 'mobilePhone', 'email'],
    });
    expect(filiation?.fields).not.toContain('birthplace');
    expect(filiation?.fields).not.toContain('bloodGroup');
    expect(filiation?.fields).not.toContain('rhFactor');
    expect(bloodData).toMatchObject({
      id: 'bloodData',
      name: 'Grupo sanguíneo y factor Rh',
      fields: ['bloodGroup', 'rhFactor'],
    });
    expect(filiation?.fields).not.toContain('nationality');
    expect(nationality).toMatchObject({
      id: 'nationality',
      type: 'person attribute',
      uuid: peruNationalityAttributeTypeUuid,
      label: 'Nacionalidad',
      answerConceptSetUuid: peruNationalityConceptSetUuid,
      searchable: true,
    });
    expect(nationality?.validation?.matches).toBeTruthy();
    expect(new RegExp(nationality?.validation?.matches ?? '').test(peruNationalityConceptUuid)).toBe(true);
    expect(new RegExp(nationality?.validation?.matches ?? '').test('PE')).toBe(false);
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

  it('merges responsible person data and relationships into one visible section', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    const responsiblePerson = config.sectionDefinitions.find((section) => section.id === 'responsiblePerson');

    expect(config.sections).toEqual([
      'identityLookup',
      'demographics',
      'responsiblePerson',
      'contact',
      'filiation',
      'bloodData',
      'insurance',
      'medicalRecord',
    ]);
    expect(config.sections).not.toContain('relationships');
    expect(config.sections).not.toContain('birthplace');
    expect(responsiblePerson).toMatchObject({
      id: 'responsiblePerson',
      name: 'Vínculos y responsable',
      fields: [],
    });
  });

  it('maps legacy MINSA identity lookup config to RENIEC lookup', () => {
    const defaultConfig = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
    defaultConfig.sectionDefinitions = [
      {
        id: 'demographics',
        name: 'Basic Info',
        fields: ['name', 'id', 'minsaLookup', 'dob', 'gender'],
      },
    ];

    const config = getEffectiveRegistrationConfig(defaultConfig);
    const demographics = config.sectionDefinitions.find((section) => section.id === 'demographics');

    expect(config.sectionDefinitions.find((section) => section.id === 'identityLookup')?.fields).toEqual([
      'id',
      'reniecLookup',
      'sisLookup',
    ]);
    expect(demographics?.fields).toEqual(['name', 'dob', 'gender', 'nationality']);
  });

  it('preconfigures safe administrative defaults for new Peru registrations', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    const fieldsById = Object.fromEntries(config.fieldDefinitions.map((field) => [field.id, field]));

    expect(fieldsById.medicalRecordStatus.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2031');
    expect(fieldsById.medicalRecordArchiveType.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2041');
    expect(fieldsById.medicalRecordStatus.readOnlyOnCreate).toBe(true);
    expect(fieldsById.medicalRecordArchiveType.readOnlyOnCreate).toBe(true);
    expect(fieldsById.insuranceAccreditationStatus.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2054');
    expect(fieldsById.civilStatus.customConceptAnswers).toContainEqual({
      uuid: 'a10b6eeb-287f-4580-8ba7-9c8ee78a6ffc',
      label: 'Divorciado(a)',
    });
    expect(fieldsById.civilStatus.customConceptAnswers?.map((answer) => answer.label)).not.toContain('Divorced');
    expect(fieldsById.nativeLanguage.answerConceptSetUuid).toBe('52f75b05-9a74-57b3-baeb-d2d300b62b09');
    expect(fieldsById.occupation.answerConceptSetUuid).toBe('d1c52a69-46b2-5c1e-ab88-5d5e6d2c8b49');
    expect(fieldsById.insuranceType.customConceptAnswers?.map((answer) => answer.label)).toEqual([
      'SIS Gratuito',
      'SIS Emprendedor',
      'SIS Semicontributivo',
      'Plan de atención SIS',
      'ESSALUD',
      'FOSPOLI',
      'Seguro privado',
    ]);
    expect(fieldsById.rhFactor.customConceptAnswers).toEqual([
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2021', label: 'Rh positivo' },
      { uuid: '9b3df0a1-0c58-4f55-9868-9c38f1db2022', label: 'Rh negativo' },
    ]);
    expect(config.sectionDefinitions.find((section) => section.id === 'identityLookup')?.fields).toContain('sisLookup');
    expect(config.sectionDefinitions.find((section) => section.id === 'insurance')?.fields).not.toContain('sisLookup');
    expect(config.fieldConfigurations.phone.personAttributeUuid).toBe(peruPhoneAttributeTypeUuid);
    expect(config.fieldConfigurations.phone.placeholder).toBe('012345678');
    expect(config.fieldConfigurations.phone.validation?.matches).toBe('^(?:(?:\\+51)?[1-8][0-9]{7}|0[1-8][0-9]{7})$');
    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).toContain('birthAddress');
    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).toContain('email');
    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).not.toContain('birthplace');
    expect(fieldsById.mobilePhone.placeholder).toBe('987654321');
    expect(fieldsById.mobilePhone.validation?.matches).toBe('^(?:\\+51)?9[0-9]{8}$');
    expect(fieldsById.email).toMatchObject({
      id: 'email',
      type: 'person attribute',
      uuid: peruEmailAttributeTypeUuid,
      label: 'Correo electrónico',
      validation: { required: false, matches: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    });
    expect(fieldsById.birthplace).toBeUndefined();
    expect(fieldsById.gender?.defaultValue).toBeUndefined();
    expect(fieldsById.bloodGroup.defaultValue).toBeUndefined();
    expect(fieldsById.rhFactor.defaultValue).toBeUndefined();
  });

  it('removes legacy standalone birthplace sections from the visible order', () => {
    const defaultConfig = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
    defaultConfig.sections = ['demographics', 'contact', 'birthplace', 'relationships'];

    const config = getEffectiveRegistrationConfig(defaultConfig);

    expect(config.sections).toEqual([
      'identityLookup',
      'demographics',
      'responsiblePerson',
      'contact',
      'filiation',
      'bloodData',
      'insurance',
      'medicalRecord',
    ]);
  });

  it('drops legacy contact birthplace fields from the Peru flow', () => {
    const defaultConfig = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
    defaultConfig.sectionDefinitions = [
      {
        id: 'contact',
        name: 'Contact Details',
        fields: ['address', 'birthplace', 'phone'],
      },
    ];

    const config = getEffectiveRegistrationConfig(defaultConfig);

    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).toEqual([
      'address',
      'birthAddress',
      'phone',
      'mobilePhone',
      'email',
    ]);
  });
});
