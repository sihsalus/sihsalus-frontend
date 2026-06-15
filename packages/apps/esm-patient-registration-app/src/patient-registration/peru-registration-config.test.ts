import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import {
  getEffectiveRegistrationConfig,
  peruDniPatientIdentifierTypeUuid,
  peruForeignPatientIdentifierTypeUuids,
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
      fields: ['address', 'birthAddress', 'phone', 'mobilePhone'],
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

  it('merges responsible person data and relationships into one visible section', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    const responsiblePerson = config.sectionDefinitions.find((section) => section.id === 'responsiblePerson');

    expect(config.sections).toEqual([
      'identityLookup',
      'demographics',
      'contact',
      'filiation',
      'bloodData',
      'medicalRecord',
      'insurance',
      'responsiblePerson',
    ]);
    expect(config.sections).not.toContain('relationships');
    expect(config.sections).not.toContain('birthplace');
    expect(responsiblePerson).toMatchObject({
      id: 'responsiblePerson',
      name: 'Acompañante o responsable',
      fields: ['companionName', 'companionAge', 'companionRelationship'],
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

  it('validates responsible person optional fields when provided', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    const fieldsById = Object.fromEntries(config.fieldDefinitions.map((field) => [field.id, field]));
    const companionNameRegex = new RegExp(fieldsById.companionName.validation.matches);
    const companionAgeRegex = new RegExp(fieldsById.companionAge.validation.matches);
    const companionRelationshipRegex = new RegExp(fieldsById.companionRelationship.validation.matches);

    expect(fieldsById.companionName.validation.required).toBe(false);
    expect(companionNameRegex.test('José De la Cruz')).toBe(true);
    expect(companionNameRegex.test('José2')).toBe(false);
    expect(companionNameRegex.test('José@')).toBe(false);

    expect(fieldsById.companionAge.validation.required).toBe(false);
    expect(companionAgeRegex.test('35')).toBe(true);
    expect(companionAgeRegex.test('120')).toBe(true);
    expect(companionAgeRegex.test('121')).toBe(false);
    expect(companionAgeRegex.test('treinta')).toBe(false);

    expect(fieldsById.companionRelationship.validation.required).toBe(false);
    expect(companionRelationshipRegex.test('Tío/a')).toBe(true);
    expect(companionRelationshipRegex.test('Tío2')).toBe(false);
  });

  it('preconfigures safe administrative defaults for new Peru registrations', () => {
    const config = getEffectiveRegistrationConfig(getDefaultsFromConfigSchema(esmPatientRegistrationSchema));
    const fieldsById = Object.fromEntries(config.fieldDefinitions.map((field) => [field.id, field]));

    expect(fieldsById.medicalRecordStatus.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2031');
    expect(fieldsById.medicalRecordArchiveType.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2041');
    expect(fieldsById.insuranceAccreditationStatus.defaultValue).toBe('9b3df0a1-0c58-4f55-9868-9c38f1db2054');
    expect(config.sectionDefinitions.find((section) => section.id === 'identityLookup')?.fields).toContain('sisLookup');
    expect(config.sectionDefinitions.find((section) => section.id === 'insurance')?.fields).not.toContain('sisLookup');
    expect(config.fieldConfigurations.phone.personAttributeUuid).toBe(peruPhoneAttributeTypeUuid);
    expect(config.fieldConfigurations.phone.validation?.matches).toBe('^\\+?[0-9][0-9\\s().-]{5,19}$');
    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).toContain('birthAddress');
    expect(config.sectionDefinitions.find((section) => section.id === 'contact')?.fields).not.toContain('birthplace');
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
      'contact',
      'filiation',
      'bloodData',
      'medicalRecord',
      'insurance',
      'responsiblePerson',
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
    ]);
  });
});
