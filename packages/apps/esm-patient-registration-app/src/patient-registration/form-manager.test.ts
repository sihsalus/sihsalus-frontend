import { getConfig, getDefaultsFromConfigSchema, type Session } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import { FormManager, SavePatientTransactionManager } from './form-manager';
import {
  documentTypeConceptUuids,
  personDocumentNumberAttributeTypeUuid,
  personDocumentTypeAttributeTypeUuid,
} from './identity/identity-documents';
import { fetchPersonForPromotion, isPersonAlreadyPatient } from './identity/identity-search.resource';
import { verifyIdentityForPromotion } from './identity/identity-verification.resource';
import {
  addPatientIdentifier,
  deletePatientIdentifier,
  deletePersonAttribute,
  deletePersonName,
  deleteRelationship,
  generateIdentifier,
  promotePersonToPatient,
  saveEncounter,
  savePatient,
  savePerson,
  saveRelationship,
  updatePatientIdentifier,
  updateRelationship,
} from './patient-registration.resource';
import { type FormValues } from './patient-registration.types';
import {
  addressUbigeoField,
  addressUbigeoPathField,
  addressUbigeoPathSeparator,
  birthAddressMarker,
  birthAddressMarkerField,
} from './patient-registration-utils';
import {
  getEffectiveRegistrationConfig,
  peruEmailAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruMobilePhoneAttributeTypeUuid,
  peruNationalityAttributeTypeUuid,
  peruNationalityConceptUuid,
  peruPhoneAttributeTypeUuid,
} from './peru-registration-config';
import { registrationErrorCodes } from './registration-errors';

vi.mock('./patient-registration.resource', async () => ({
  ...(await vi.importActual('./patient-registration.resource')),
  addPatientIdentifier: vi.fn(),
  generateIdentifier: vi.fn(),
  deletePatientIdentifier: vi.fn(),
  deletePersonAttribute: vi.fn(),
  deletePersonName: vi.fn(),
  deleteRelationship: vi.fn(),
  promotePersonToPatient: vi.fn(),
  savePatient: vi.fn(),
  saveEncounter: vi.fn(),
  savePerson: vi.fn(),
  saveRelationship: vi.fn(),
  updatePatientIdentifier: vi.fn(),
  updateRelationship: vi.fn(),
}));

vi.mock('./identity/identity-search.resource', () => ({
  fetchPersonForPromotion: vi.fn(),
  isPersonAlreadyPatient: vi.fn(),
}));

vi.mock('./identity/identity-verification.resource', () => ({
  verifyIdentityForPromotion: vi.fn(),
}));

const mockGenerateIdentifier = generateIdentifier as vi.Mock;
const mockAddPatientIdentifier = vi.mocked(addPatientIdentifier);
const mockDeletePatientIdentifier = vi.mocked(deletePatientIdentifier);
const mockDeletePersonAttribute = vi.mocked(deletePersonAttribute);
const mockDeletePersonName = vi.mocked(deletePersonName);
const mockDeleteRelationship = vi.mocked(deleteRelationship);
const mockPromotePersonToPatient = vi.mocked(promotePersonToPatient);
const mockSavePatient = vi.mocked(savePatient);
const mockSaveEncounter = vi.mocked(saveEncounter);
const mockSavePerson = vi.mocked(savePerson);
const mockSaveRelationship = vi.mocked(saveRelationship);
const mockUpdateRelationship = vi.mocked(updateRelationship);
const mockUpdatePatientIdentifier = vi.mocked(updatePatientIdentifier);
const mockFetchPersonForPromotion = vi.mocked(fetchPersonForPromotion);
const mockIsPersonAlreadyPatient = vi.mocked(isPersonAlreadyPatient);
const mockVerifyIdentityForPromotion = vi.mocked(verifyIdentityForPromotion);

const formValues: FormValues = {
  patientUuid: '',
  givenName: '',
  middleName: '',
  familyName: '',
  familyName2: '',
  additionalGivenName: '',
  additionalMiddleName: '',
  additionalFamilyName: '',
  additionalFamilyName2: '',
  addNameInLocalLanguage: false,
  gender: '',
  birthdate: '',
  yearsEstimated: 1000,
  monthsEstimated: 11,
  birthdateEstimated: false,
  telephoneNumber: '',
  isDead: false,
  deathDate: 'string',
  deathTime: '',
  deathTimeFormat: 'AM',
  deathCause: 'string',
  nonCodedCauseOfDeath: '',
  relationships: [],
  address: {
    address1: '',
    address2: '',
    cityVillage: '',
    stateProvince: 'New York',
    country: 'string',
    postalCode: 'string',
  },
  birthAddress: {},
  identifiers: {
    foo: {
      identifierUuid: 'aUuid',
      identifierName: 'Foo',
      required: false,
      initialValue: 'foo',
      identifierValue: 'foo',
      identifierTypeUuid: 'identifierType',
      preferred: true,
      autoGeneration: false,
      selectedSource: {
        uuid: 'some-uuid',
        name: 'unique',
        autoGenerationOption: { manualEntryEnabled: true, automaticGenerationEnabled: false },
      },
    },
  },
};

function getPeruRegistrationConfig() {
  return getEffectiveRegistrationConfig(
    getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig,
  );
}

describe('FormManager', () => {
  describe('createIdentifiers', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockAddPatientIdentifier.mockResolvedValue({ ok: true, data: { uuid: 'added-identifier-uuid' } } as never);
      mockUpdatePatientIdentifier.mockResolvedValue({ ok: true } as never);
    });

    it('uses the uuid of a field name if it exists', async () => {
      const result = await FormManager.savePatientIdentifiers(true, undefined, formValues.identifiers, {}, 'Nyc');
      expect(result).toEqual([
        {
          uuid: 'aUuid',
          identifier: 'foo',
          identifierType: 'identifierType',
          location: 'Nyc',
          preferred: true,
        },
      ]);
    });

    it('rejects active identifiers when the session location is missing', async () => {
      await expect(
        FormManager.savePatientIdentifiers(true, undefined, formValues.identifiers, {}, ''),
      ).rejects.toMatchObject({
        code: registrationErrorCodes.identifierLocationRequired,
      });

      expect(mockGenerateIdentifier).not.toHaveBeenCalled();
      expect(mockAddPatientIdentifier).not.toHaveBeenCalled();
    });

    it('should generate identifier if it has autoGeneration and manual entry disabled', async () => {
      const identifiers = {
        foo: {
          ...formValues.identifiers.foo,
          autoGeneration: true,
          selectedSource: {
            ...formValues.identifiers.foo.selectedSource,
            autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: false },
          },
        },
      };
      mockGenerateIdentifier.mockResolvedValue({ data: { identifier: '10001V' } });
      await FormManager.savePatientIdentifiers(true, undefined, identifiers, {}, 'Nyc');
      expect(mockGenerateIdentifier.mock.calls).toHaveLength(1);
    });

    it('should not generate identifiers if manual entry enabled and identifier value given', async () => {
      const identifiers = {
        foo: {
          ...formValues.identifiers.foo,
          autoGeneration: true,
          selectedSource: {
            ...formValues.identifiers.foo.selectedSource,
            autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: true },
          },
        },
      };
      await FormManager.savePatientIdentifiers(true, undefined, identifiers, {}, 'Nyc');
      expect(mockGenerateIdentifier.mock.calls).toHaveLength(0);
    });

    it('reuses an auto-generated identifier when the same transaction is retried', async () => {
      const transaction = new SavePatientTransactionManager();
      const identifiers = {
        openmrsId: {
          ...formValues.identifiers.foo,
          autoGeneration: true,
          identifierValue: 'auto-generated',
          selectedSource: {
            ...formValues.identifiers.foo.selectedSource,
            autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: false },
          },
        },
      };
      mockGenerateIdentifier.mockResolvedValue({ data: { identifier: '10001V' } });

      const first = await FormManager.savePatientIdentifiers(true, 'patient-uuid', identifiers, {}, 'Nyc', transaction);
      const second = await FormManager.savePatientIdentifiers(
        true,
        'patient-uuid',
        identifiers,
        {},
        'Nyc',
        transaction,
      );

      expect(first[0].identifier).toBe('10001V');
      expect(second[0].identifier).toBe('10001V');
      expect(mockGenerateIdentifier).toHaveBeenCalledTimes(1);
    });

    it('waits for removed identifiers and does not delete them twice on retry', async () => {
      const transaction = new SavePatientTransactionManager();
      mockDeletePatientIdentifier.mockResolvedValue({ ok: true } as never);

      await FormManager.savePatientIdentifiers(false, 'patient-uuid', {}, formValues.identifiers, 'Nyc', transaction);
      await FormManager.savePatientIdentifiers(false, 'patient-uuid', {}, formValues.identifiers, 'Nyc', transaction);

      expect(mockDeletePatientIdentifier).toHaveBeenCalledTimes(1);
      expect(mockDeletePatientIdentifier).toHaveBeenCalledWith('patient-uuid', 'aUuid', undefined);
    });

    it('preserves an unchanged system-managed SIS identifier during patient edits', async () => {
      const sisIdentifier = {
        ...formValues.identifiers.foo,
        identifierUuid: 'sis-contract-identifier-uuid',
        identifierName: 'SIS Contrato',
        identifierTypeUuid: '406574d4-396a-4787-9c4e-0bbfa30de39f',
        identifierValue: 'SIS-CONTRACT-001',
        initialValue: 'SIS-CONTRACT-001',
        preferred: false,
        selectedSource: undefined,
      };

      const result = await FormManager.savePatientIdentifiers(
        false,
        'patient-uuid',
        { sisContrato: sisIdentifier },
        { sisContrato: sisIdentifier },
        'Nyc',
      );

      expect(result).toEqual([
        expect.objectContaining({
          uuid: 'sis-contract-identifier-uuid',
          identifier: 'SIS-CONTRACT-001',
          identifierType: '406574d4-396a-4787-9c4e-0bbfa30de39f',
        }),
      ]);
      expect(mockAddPatientIdentifier).not.toHaveBeenCalled();
      expect(mockUpdatePatientIdentifier).not.toHaveBeenCalled();
      expect(mockDeletePatientIdentifier).not.toHaveBeenCalled();
    });

    it('persists each changed value when an identifier is edited again after a partial failure', async () => {
      const transaction = new SavePatientTransactionManager();
      const changedIdentifiers = {
        foo: { ...formValues.identifiers.foo, identifierValue: 'changed-value' },
      };

      await FormManager.savePatientIdentifiers(
        false,
        'patient-uuid',
        changedIdentifiers,
        formValues.identifiers,
        'Nyc',
        transaction,
      );
      await FormManager.savePatientIdentifiers(
        false,
        'patient-uuid',
        formValues.identifiers,
        formValues.identifiers,
        'Nyc',
        transaction,
      );

      expect(mockUpdatePatientIdentifier).toHaveBeenNthCalledWith(
        1,
        'patient-uuid',
        'aUuid',
        'changed-value',
        undefined,
      );
      expect(mockUpdatePatientIdentifier).toHaveBeenNthCalledWith(2, 'patient-uuid', 'aUuid', 'foo', undefined);
    });

    it('restores an identifier that was deleted earlier in the same transaction', async () => {
      const transaction = new SavePatientTransactionManager();
      mockDeletePatientIdentifier.mockResolvedValue({ ok: true } as never);

      await FormManager.savePatientIdentifiers(false, 'patient-uuid', {}, formValues.identifiers, 'Nyc', transaction);
      await FormManager.savePatientIdentifiers(
        false,
        'patient-uuid',
        formValues.identifiers,
        formValues.identifiers,
        'Nyc',
        transaction,
      );

      expect(mockAddPatientIdentifier).toHaveBeenCalledWith(
        'patient-uuid',
        expect.objectContaining({ identifier: 'foo', uuid: undefined }),
        undefined,
      );
    });

    it('deletes an identifier added earlier when it is removed before retry', async () => {
      const transaction = new SavePatientTransactionManager();
      const newIdentifiers = {
        foo: { ...formValues.identifiers.foo, identifierUuid: undefined, initialValue: '' },
      };
      mockDeletePatientIdentifier.mockResolvedValue({ ok: true } as never);

      await FormManager.savePatientIdentifiers(false, 'patient-uuid', newIdentifiers, {}, 'Nyc', transaction);
      await FormManager.savePatientIdentifiers(false, 'patient-uuid', {}, {}, 'Nyc', transaction);

      expect(mockAddPatientIdentifier).toHaveBeenCalledTimes(1);
      expect(mockDeletePatientIdentifier).toHaveBeenCalledWith('patient-uuid', 'added-identifier-uuid', undefined);
    });
  });

  describe('destructive edit operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('preserves an additional name unless the user explicitly removes it', () => {
      const patientUuidMap = { additionalNameUuid: 'additional-name-uuid' };

      expect(FormManager.getDeletedNames({ ...formValues, addNameInLocalLanguage: true }, patientUuidMap)).toEqual([]);
      expect(
        FormManager.getDeletedNames(
          { ...formValues, patientUuid: 'patient-uuid', addNameInLocalLanguage: false },
          patientUuidMap,
        ),
      ).toEqual([{ nameUuid: 'additional-name-uuid', personUuid: 'patient-uuid' }]);
    });

    it('awaits attribute deletion, propagates failures, and skips missing UUIDs', async () => {
      const transaction = new SavePatientTransactionManager();
      const values = {
        ...formValues,
        patientUuid: 'patient-uuid',
        attributes: { 'attribute-type-uuid': '' },
      };
      const patientUuidMap = { 'attribute.attribute-type-uuid': 'attribute-value-uuid' };
      mockDeletePersonAttribute.mockRejectedValueOnce(new Error('delete failed'));

      await expect(
        FormManager.deleteRemovedPatientAttributes(false, values, patientUuidMap, transaction),
      ).rejects.toThrow('delete failed');
      expect(transaction.deletedAttributeUuids).toEqual({});

      mockDeletePersonAttribute.mockResolvedValue({ ok: true } as never);
      await FormManager.deleteRemovedPatientAttributes(false, values, patientUuidMap, transaction);
      await FormManager.deleteRemovedPatientAttributes(false, values, patientUuidMap, transaction);
      await FormManager.deleteRemovedPatientAttributes(false, values, {}, transaction);

      expect(mockDeletePersonAttribute).toHaveBeenCalledTimes(2);
      expect(mockDeletePersonAttribute).toHaveBeenLastCalledWith('patient-uuid', 'attribute-value-uuid', undefined);
    });

    it('does not delete the additional name during an ordinary edit', async () => {
      mockSavePatient.mockResolvedValue({ ok: true, data: { uuid: 'patient-uuid' } } as never);
      mockDeletePersonName.mockResolvedValue({ ok: true } as never);
      const values = {
        ...formValues,
        patientUuid: 'patient-uuid',
        addNameInLocalLanguage: true,
        identifiers: {},
      };

      await FormManager.savePatientFormOnline(
        false,
        values,
        { additionalNameUuid: 'additional-name-uuid' },
        {},
        null,
        'location-uuid',
        {},
        {} as Session,
        getPeruRegistrationConfig(),
        new SavePatientTransactionManager(),
      );

      expect(mockDeletePersonName).not.toHaveBeenCalled();
    });

    it('reuses the UUID of an existing person attribute during an edit', () => {
      const patient = FormManager.getPatientToCreate(
        false,
        {
          ...formValues,
          attributes: { 'attribute-type-uuid': 'updated value' },
        },
        { 'attribute.attribute-type-uuid': 'attribute-value-uuid' },
        {},
        [],
      );

      expect(patient.person.attributes).toEqual([
        {
          attributeType: 'attribute-type-uuid',
          uuid: 'attribute-value-uuid',
          value: 'updated value',
        },
      ]);
    });

    it('blocks changed demographics after a partial save instead of creating nested duplicates', async () => {
      const transaction = new SavePatientTransactionManager();
      const values = {
        ...formValues,
        patientUuid: 'patient-uuid',
        givenName: 'Maria',
        gender: 'female',
        birthdate: '1990-01-01',
        identifiers: {},
        relationships: [
          {
            action: 'ADD' as const,
            clientId: 'relationship-row',
            relatedPersonUuid: 'related-person-uuid',
            relationshipType: 'relationship-type-uuid/aIsToB',
          },
        ],
      };
      mockSavePatient.mockResolvedValue({ ok: true, data: { uuid: 'patient-uuid' } } as never);
      mockSaveRelationship.mockRejectedValueOnce(new Error('relationship failed'));

      await expect(
        FormManager.savePatientFormOnline(
          false,
          values,
          {},
          {},
          null,
          'location-uuid',
          {},
          {} as Session,
          getPeruRegistrationConfig(),
          transaction,
        ),
      ).rejects.toThrow('relationship failed');

      await expect(
        FormManager.savePatientFormOnline(
          false,
          { ...values, givenName: 'Mariana' },
          {},
          {},
          null,
          'location-uuid',
          {},
          {} as Session,
          getPeruRegistrationConfig(),
          transaction,
        ),
      ).rejects.toMatchObject({
        code: registrationErrorCodes.partialSavePatientChanged,
      });

      expect(mockSavePatient).toHaveBeenCalledTimes(1);
      expect(mockSaveRelationship).toHaveBeenCalledTimes(1);
    });
  });

  describe('registration observations', () => {
    const session = { currentProvider: { uuid: 'provider-uuid' } } as Session;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('rejects missing encounter metadata before writing the patient', async () => {
      const config = getPeruRegistrationConfig();
      config.registrationObs.encounterTypeUuid = 'encounter-type-uuid';
      config.registrationObs.encounterProviderRoleUuid = 'provider-role-uuid';
      config.registrationObs.registrationFormUuid = null;

      await expect(
        FormManager.savePatientFormOnline(
          true,
          { ...formValues, patientUuid: 'patient-uuid', identifiers: {}, obs: { 'concept-uuid': 'value' } },
          {},
          {},
          null,
          'location-uuid',
          {},
          session,
          config,
          new SavePatientTransactionManager(),
        ),
      ).rejects.toMatchObject({
        code: registrationErrorCodes.clinicalConfigurationMissing,
        technicalDetails: { missingConfiguration: ['formulario de registro'] },
      });
      expect(mockSavePatient).not.toHaveBeenCalled();
      expect(mockSaveEncounter).not.toHaveBeenCalled();
    });

    it('does not create the registration encounter twice after a later retry', async () => {
      const config = getPeruRegistrationConfig();
      config.registrationObs.encounterTypeUuid = 'encounter-type-uuid';
      config.registrationObs.encounterProviderRoleUuid = 'provider-role-uuid';
      config.registrationObs.registrationFormUuid = 'form-uuid';
      const transaction = new SavePatientTransactionManager();
      mockSaveEncounter.mockResolvedValue({ ok: true } as never);

      await FormManager.saveObservations(
        { 'concept-uuid': 'value' },
        { data: { uuid: 'patient-uuid' } } as never,
        'location-uuid',
        session,
        config,
        transaction,
      );
      await FormManager.saveObservations(
        { 'concept-uuid': 'value' },
        { data: { uuid: 'patient-uuid' } } as never,
        'location-uuid',
        session,
        config,
        transaction,
      );

      expect(mockSaveEncounter).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPatientToCreate', () => {
    it('keeps residence, birthplace, and phone as separate persisted fields', () => {
      const config = getPeruRegistrationConfig();
      const values = {
        ...formValues,
        patientUuid: 'patient-uuid',
        givenName: 'Juan',
        familyName: 'Perez',
        familyName2: 'Garcia',
        gender: 'male',
        birthdate: new Date(1990, 4, 14),
        attributes: {
          [peruEmailAttributeTypeUuid]: 'juan.perez@example.org',
          [peruPhoneAttributeTypeUuid]: '999888777',
          [peruInsuranceCodeAttributeTypeUuid]: 'SIS-12345678',
          [peruNationalityAttributeTypeUuid]: peruNationalityConceptUuid,
        },
        address: {
          country: 'PERU',
          address1: 'HUANCAVELICA',
          stateProvince: 'HUANCAVELICA',
          countyDistrict: 'CHURCAMPA',
          cityVillage: 'PAUCARBAMBA',
          address4: 'JR LIMA 123',
          [addressUbigeoField]: '090501',
          [addressUbigeoPathField]: ['PERU', 'HUANCAVELICA', 'HUANCAVELICA', 'CHURCAMPA'].join(
            addressUbigeoPathSeparator,
          ),
        },
        birthAddress: {
          country: 'PERU',
          address1: 'LORETO',
          stateProvince: 'MAYNAS',
          countyDistrict: 'NAPO',
          cityVillage: 'SANTA CLOTILDE',
          [addressUbigeoField]: '1603030001',
          [addressUbigeoPathField]: ['PERU', 'LORETO', 'MAYNAS', 'NAPO', 'SANTA CLOTILDE'].join(
            addressUbigeoPathSeparator,
          ),
        },
      };

      const patient = FormManager.getPatientToCreate(true, values, {}, {}, [], config);

      expect(patient.person.addresses).toEqual([
        {
          ...values.address,
          preferred: true,
        },
        {
          ...values.birthAddress,
          preferred: false,
          [birthAddressMarkerField]: birthAddressMarker,
        },
      ]);
      expect(patient.person.attributes).toEqual(
        expect.arrayContaining([
          { attributeType: peruEmailAttributeTypeUuid, value: 'juan.perez@example.org' },
          { attributeType: peruPhoneAttributeTypeUuid, value: '999888777' },
          { attributeType: peruInsuranceCodeAttributeTypeUuid, value: 'SIS-12345678' },
          { attributeType: peruNationalityAttributeTypeUuid, value: peruNationalityConceptUuid },
        ]),
      );
    });

    it('drops person attributes without a valid attribute type key', () => {
      const patient = FormManager.getPatientToCreate(
        true,
        {
          ...formValues,
          patientUuid: 'patient-uuid',
          gender: 'male',
          birthdate: '1990-05-14',
          attributes: {
            [peruEmailAttributeTypeUuid]: 'juan.perez@example.org',
            '': 'blank-key',
            undefined: 'undefined-key',
            null: 'null-key',
            attributeType: 'wrong-shape-key',
          },
        },
        {},
        {},
        [],
        getPeruRegistrationConfig(),
      );

      expect(patient.person.attributes).toEqual([
        { attributeType: peruEmailAttributeTypeUuid, value: 'juan.perez@example.org' },
      ]);
    });

    it('does not create a birthplace address when the structured birthplace is empty', () => {
      const config = getPeruRegistrationConfig();
      const patient = FormManager.getPatientToCreate(
        true,
        {
          ...formValues,
          patientUuid: 'patient-uuid',
          gender: 'male',
          birthdate: '1990-05-14',
          birthAddress: {},
        },
        {},
        {},
        [],
        config,
      );

      expect(patient.person.addresses).toEqual([
        {
          country: 'string',
          postalCode: 'string',
          preferred: true,
          stateProvince: 'New York',
        },
      ]);
    });

    it('keeps existing residence and birthplace address UUIDs while editing', () => {
      const config = getPeruRegistrationConfig();
      const patient = FormManager.getPatientToCreate(
        false,
        {
          ...formValues,
          patientUuid: 'patient-uuid',
          gender: 'male',
          birthdate: '1990-05-14',
          birthAddress: {
            country: 'PERU',
            address1: 'HUANCAVELICA',
          },
        },
        {
          preferredAddressUuid: 'residence-address-uuid',
          birthAddressUuid: 'birth-address-uuid',
        },
        {},
        [],
        config,
      );

      expect(patient.person.addresses).toEqual([
        expect.objectContaining({
          uuid: 'residence-address-uuid',
          preferred: true,
        }),
        expect.objectContaining({
          uuid: 'birth-address-uuid',
          preferred: false,
          [birthAddressMarkerField]: birthAddressMarker,
        }),
      ]);
    });
  });

  describe('promotion of an existing person to patient', () => {
    const personUuid = '11111111-2222-3333-4444-555555555555';

    function buildPromotionFormValues(): FormValues {
      return {
        ...formValues,
        patientUuid: personUuid,
        personUuidToPromote: personUuid,
        givenName: 'Rosa',
        familyName: 'Flores',
        familyName2: 'Diaz',
        gender: 'female',
        birthdate: new Date(1986, 0, 1),
        identifiers: {
          foo: {
            ...formValues.identifiers.foo,
            autoGeneration: false,
            identifierUuid: undefined,
          },
        },
      };
    }

    function buildPromotionPerson() {
      return {
        uuid: personUuid,
        display: 'Rosa Flores',
        gender: 'F',
        birthdate: '1986-01-01',
        birthdateEstimated: false,
        names: [{ uuid: 'existing-name-uuid', preferred: true, givenName: 'Rosa', familyName: 'Flores' }],
        addresses: [{ uuid: 'existing-address-uuid', preferred: true, address1: 'Jr. Principal 123' }],
        attributes: [
          {
            uuid: 'attr-doc-type',
            value: { uuid: documentTypeConceptUuids.dni, display: 'DNI' },
            attributeType: { uuid: personDocumentTypeAttributeTypeUuid, format: 'org.openmrs.Concept' },
          },
          {
            uuid: 'attr-doc-number',
            value: '99887766',
            attributeType: { uuid: personDocumentNumberAttributeTypeUuid, format: 'java.lang.String' },
          },
        ],
      };
    }

    async function runPromotion(values = buildPromotionFormValues(), currentLocation = 'location-1') {
      const config = getPeruRegistrationConfig();
      return FormManager.savePatientFormOnline(
        true,
        values,
        {},
        {},
        null,
        currentLocation,
        {},
        {} as Session,
        config,
        new SavePatientTransactionManager(),
      );
    }

    beforeEach(() => {
      vi.clearAllMocks();
      if (vi.isMockFunction(getConfig)) {
        vi.mocked(getConfig).mockResolvedValue({} as never);
      }
      mockIsPersonAlreadyPatient.mockResolvedValue(false);
      mockFetchPersonForPromotion.mockResolvedValue(buildPromotionPerson());
      mockVerifyIdentityForPromotion.mockResolvedValue({ status: 'unavailable' });
      mockPromotePersonToPatient.mockResolvedValue({ ok: true, data: { uuid: personUuid } } as never);
      mockSavePatient.mockResolvedValue({ ok: true, data: { uuid: personUuid } } as never);
    });

    it('promotes with the person uuid as a plain string and keeps the same uuid end to end', async () => {
      const result = await runPromotion();

      expect(mockIsPersonAlreadyPatient).toHaveBeenCalledWith(personUuid);
      expect(mockPromotePersonToPatient).toHaveBeenCalledTimes(1);

      const [promotedPersonUuid, identifiers] = mockPromotePersonToPatient.mock.calls[0];
      expect(promotedPersonUuid).toBe(personUuid);
      expect(identifiers).toEqual(
        expect.arrayContaining([expect.objectContaining({ identifier: 'foo', identifierType: 'identifierType' })]),
      );
      expect(result).toBe(personUuid);
    });

    it('rejects a document identifier derived during promotion when the session location is missing', async () => {
      await expect(runPromotion({ ...buildPromotionFormValues(), identifiers: {} }, '')).rejects.toMatchObject({
        code: registrationErrorCodes.identifierLocationRequired,
      });

      expect(mockPromotePersonToPatient).not.toHaveBeenCalled();
    });

    it('maps the person document attributes to a patient identifier without duplicating types', async () => {
      await runPromotion();

      const [, identifiers] = mockPromotePersonToPatient.mock.calls[0];
      expect(identifiers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            identifier: '99887766',
            identifierType: '550e8400-e29b-41d4-a716-446655440001',
          }),
        ]),
      );

      const dniIdentifiers = identifiers.filter(
        (identifier) => identifier.identifierType === '550e8400-e29b-41d4-a716-446655440001',
      );
      expect(dniIdentifiers).toHaveLength(1);
    });

    it('keeps identity mismatch observations technical and exposes only a stable domain code', async () => {
      const observation = 'RENIEC returned NAME_MISMATCH for a sensitive source value';
      mockVerifyIdentityForPromotion.mockResolvedValue({
        status: 'mismatch',
        source: 'reniec',
        verifiedAt: '2026-07-15T15:00:00.000Z',
        observation,
      });

      await expect(runPromotion()).rejects.toMatchObject({
        code: registrationErrorCodes.identityVerificationMismatch,
        message: expect.stringContaining(observation),
        technicalDetails: {
          observation,
          personUuid,
          source: 'reniec',
        },
      });
      expect(mockPromotePersonToPatient).not.toHaveBeenCalled();
      expect(mockSavePatient).not.toHaveBeenCalled();
    });

    it('updates demographics with a follow-up call that reuses existing name/address rows and sends no identifiers', async () => {
      await runPromotion();

      expect(mockSavePatient).toHaveBeenCalledTimes(1);
      const [updatePayload, updateUuid] = mockSavePatient.mock.calls[0];

      expect(updateUuid).toBe(personUuid);
      expect(updatePayload.identifiers).toBeUndefined();
      expect(updatePayload.person.uuid).toBe(personUuid);
      expect(updatePayload.person.names[0].uuid).toBe('existing-name-uuid');
      expect(updatePayload.person.addresses[0].uuid).toBe('existing-address-uuid');
    });

    it('reuses a confirmed promotion when a later relationship save is retried', async () => {
      const transaction = new SavePatientTransactionManager();
      const values = {
        ...buildPromotionFormValues(),
        relationships: [
          {
            action: 'ADD' as const,
            clientId: 'promotion-relationship-row',
            relatedPersonUuid: 'related-person-uuid',
            relationshipType: 'relationship-type-uuid/aIsToB',
          },
        ],
      };
      const config = getPeruRegistrationConfig();
      mockSaveRelationship
        .mockRejectedValueOnce(new Error('relationship failed'))
        .mockResolvedValueOnce({ ok: true, data: { uuid: 'relationship-uuid' } } as never);

      const save = () =>
        FormManager.savePatientFormOnline(
          true,
          values,
          {},
          {},
          null,
          'location-1',
          {},
          {} as Session,
          config,
          transaction,
        );

      await expect(save()).rejects.toThrow('relationship failed');
      await expect(save()).resolves.toBe(personUuid);

      expect(mockIsPersonAlreadyPatient).toHaveBeenCalledTimes(1);
      expect(mockFetchPersonForPromotion).toHaveBeenCalledTimes(1);
      expect(mockPromotePersonToPatient).toHaveBeenCalledTimes(1);
      expect(mockSavePatient).toHaveBeenCalledTimes(1);
      expect(mockSaveRelationship).toHaveBeenCalledTimes(2);
    });

    it('refuses to promote when the person is already a patient', async () => {
      mockIsPersonAlreadyPatient.mockResolvedValue(true);

      await expect(runPromotion()).rejects.toMatchObject({
        code: registrationErrorCodes.promotionAlreadyPatient,
      });
      expect(mockPromotePersonToPatient).not.toHaveBeenCalled();
      expect(mockSavePatient).not.toHaveBeenCalled();
    });

    it('blocks promotion offline', async () => {
      await expect(
        FormManager.savePatientFormOffline(
          true,
          buildPromotionFormValues(),
          {},
          {},
          null,
          'location-1',
          {},
          {} as Session,
          getPeruRegistrationConfig(),
          new SavePatientTransactionManager(),
        ),
      ).rejects.toMatchObject({
        code: registrationErrorCodes.promotionOffline,
      });
    });
  });

  describe('saveRelationships with a pending responsible person', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockDeleteRelationship.mockResolvedValue({ ok: true } as never);
      mockSavePerson.mockResolvedValue({ ok: true, data: { uuid: 'created-person-uuid' } } as never);
      mockSaveRelationship.mockResolvedValue({ ok: true } as never);
      mockUpdateRelationship.mockResolvedValue({ ok: true } as never);
    });

    it('handles registrations without a relationships collection', async () => {
      await expect(
        FormManager.saveRelationships(undefined, { data: { uuid: 'patient-uuid' } } as never),
      ).resolves.toEqual([]);

      expect(mockSavePerson).not.toHaveBeenCalled();
      expect(mockSaveRelationship).not.toHaveBeenCalled();
    });

    it('creates the person right before its relationship at submit time', async () => {
      await FormManager.saveRelationships(
        [
          {
            action: 'ADD',
            relatedPersonUuid: '',
            relationshipType: 'rel-type-uuid/aIsToB',
            newPerson: {
              givenName: 'María',
              middleName: '',
              familyName: 'Quispe',
              familyName2: '',
              gender: 'female',
              estimatedAge: '35',
              phone: '987654321',
              address: 'Av. Peru 123',
              relationshipType: 'rel-type-uuid/aIsToB',
            },
          },
        ],
        { data: { uuid: 'patient-uuid' } } as never,
        { phoneAttributeTypeUuid: 'phone-attr-uuid' },
      );

      expect(mockSavePerson).toHaveBeenCalledTimes(1);
      expect(mockSavePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          names: [
            expect.objectContaining({
              givenName: 'María',
              familyName: 'Quispe',
              preferred: true,
            }),
          ],
          gender: 'F',
          attributes: [{ attributeType: 'phone-attr-uuid', value: '987654321' }],
        }),
      );
      expect(mockSaveRelationship).toHaveBeenCalledWith({
        personA: 'created-person-uuid',
        personB: 'patient-uuid',
        relationshipType: 'rel-type-uuid',
      });
    });

    it('creates the companion relationship for the newly created person too', async () => {
      await FormManager.saveRelationships(
        [
          {
            action: 'ADD',
            relatedPersonUuid: '',
            relationshipType: 'rel-type-uuid/aIsToB',
            isCompanion: true,
            newPerson: {
              givenName: 'María',
              middleName: '',
              familyName: 'Quispe',
              familyName2: '',
              gender: 'female',
              estimatedAge: '',
              phone: '',
              address: '',
              relationshipType: 'rel-type-uuid/aIsToB',
            },
          },
        ],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
      );

      expect(mockSavePerson).toHaveBeenCalledTimes(1);
      expect(mockSaveRelationship).toHaveBeenCalledWith({
        personA: 'created-person-uuid',
        personB: 'patient-uuid',
        relationshipType: 'companion-type-uuid',
      });
    });

    it('rejects an incomplete relationship instead of silently discarding it', async () => {
      await expect(
        FormManager.saveRelationships(
          [{ action: 'ADD', relatedPersonUuid: '', relationshipType: 'rel-type-uuid/aIsToB' }],
          { data: { uuid: 'patient-uuid' } } as never,
          {},
        ),
      ).rejects.toMatchObject({
        code: registrationErrorCodes.relationshipPersonRequired,
      });

      expect(mockSavePerson).not.toHaveBeenCalled();
      expect(mockSaveRelationship).not.toHaveBeenCalled();
    });

    it('creates the companion relationship when an existing relationship is marked as companion', async () => {
      await FormManager.saveRelationships(
        [
          {
            action: 'UPDATE',
            isCompanion: true,
            relatedPersonUuid: 'related-person-uuid',
            relationshipType: 'family-type-uuid/aIsToB',
            uuid: 'family-relationship-uuid',
          },
        ],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
      );

      expect(mockUpdateRelationship).toHaveBeenCalledWith('family-relationship-uuid', {
        personA: 'related-person-uuid',
        personB: 'patient-uuid',
        relationshipType: 'family-type-uuid',
      });
      expect(mockSaveRelationship).toHaveBeenCalledWith({
        personA: 'related-person-uuid',
        personB: 'patient-uuid',
        relationshipType: 'companion-type-uuid',
      });
    });

    it('deletes the companion relationship when it is unmarked', async () => {
      await FormManager.saveRelationships(
        [
          {
            action: 'UPDATE',
            companionRelationshipUuid: 'companion-relationship-uuid',
            isCompanion: false,
            relatedPersonUuid: 'related-person-uuid',
            relationshipType: 'family-type-uuid/aIsToB',
            uuid: 'family-relationship-uuid',
          },
        ],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
      );

      expect(mockUpdateRelationship).toHaveBeenCalledWith('family-relationship-uuid', expect.any(Object));
      expect(mockDeleteRelationship).toHaveBeenCalledWith('companion-relationship-uuid');
      expect(mockSaveRelationship).not.toHaveBeenCalled();
    });

    it('continues a partially saved row without recreating the person or family relationship', async () => {
      const transaction = new SavePatientTransactionManager();
      const relationship = {
        clientId: 'relationship-row-1',
        action: 'ADD' as const,
        relatedPersonUuid: '',
        relationshipType: 'family-type-uuid/aIsToB',
        isCompanion: true,
        newPerson: {
          givenName: 'María',
          middleName: '',
          familyName: 'Quispe',
          familyName2: '',
          gender: 'female',
          estimatedAge: '35',
          phone: '',
          address: '',
          relationshipType: 'family-type-uuid/aIsToB',
        },
      };
      mockSaveRelationship
        .mockResolvedValueOnce({ ok: true, data: { uuid: 'family-relationship-uuid' } } as never)
        .mockRejectedValueOnce(new Error('companion failed'));

      await expect(
        FormManager.saveRelationships(
          [relationship],
          { data: { uuid: 'patient-uuid' } } as never,
          { companionRelationshipType: 'companion-type-uuid/aIsToB' },
          transaction,
        ),
      ).rejects.toThrow('companion failed');

      mockSaveRelationship.mockResolvedValueOnce({
        ok: true,
        data: { uuid: 'companion-relationship-uuid' },
      } as never);
      await FormManager.saveRelationships(
        [relationship],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
        transaction,
      );

      expect(mockSavePerson).toHaveBeenCalledTimes(1);
      expect(
        mockSaveRelationship.mock.calls.filter(([payload]) => payload.relationshipType === 'family-type-uuid'),
      ).toHaveLength(1);
      expect(
        mockSaveRelationship.mock.calls.filter(([payload]) => payload.relationshipType === 'companion-type-uuid'),
      ).toHaveLength(2);
    });

    it('does not recreate the family relationship when the companion is unmarked before retry', async () => {
      const transaction = new SavePatientTransactionManager();
      const relationship = {
        clientId: 'relationship-row-2',
        action: 'ADD' as const,
        relatedPersonUuid: 'related-person-uuid',
        relationshipType: 'family-type-uuid/aIsToB',
        isCompanion: true,
      };
      mockSaveRelationship
        .mockResolvedValueOnce({ ok: true, data: { uuid: 'family-relationship-uuid' } } as never)
        .mockRejectedValueOnce(new Error('companion failed'));

      await expect(
        FormManager.saveRelationships(
          [relationship],
          { data: { uuid: 'patient-uuid' } } as never,
          { companionRelationshipType: 'companion-type-uuid/aIsToB' },
          transaction,
        ),
      ).rejects.toThrow('companion failed');

      relationship.isCompanion = false;
      await FormManager.saveRelationships(
        [relationship],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
        transaction,
      );

      expect(
        mockSaveRelationship.mock.calls.filter(([payload]) => payload.relationshipType === 'family-type-uuid'),
      ).toHaveLength(1);
      expect(
        mockSaveRelationship.mock.calls.filter(([payload]) => payload.relationshipType === 'companion-type-uuid'),
      ).toHaveLength(1);
    });

    it('does not delete the same companion twice when a transaction is retried', async () => {
      const transaction = new SavePatientTransactionManager();
      const relationship = {
        clientId: 'relationship-row-3',
        action: 'UPDATE' as const,
        companionRelationshipUuid: 'companion-relationship-uuid',
        isCompanion: false,
        relatedPersonUuid: 'related-person-uuid',
        relationshipType: 'family-type-uuid/aIsToB',
        uuid: 'family-relationship-uuid',
      };

      await FormManager.saveRelationships(
        [relationship],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
        transaction,
      );
      await FormManager.saveRelationships(
        [relationship],
        { data: { uuid: 'patient-uuid' } } as never,
        { companionRelationshipType: 'companion-type-uuid/aIsToB' },
        transaction,
      );

      expect(mockUpdateRelationship).toHaveBeenCalledTimes(1);
      expect(mockDeleteRelationship).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapPatientToFhirPatient', () => {
    it('maps a sparse patient without person details', () => {
      expect(FormManager.mapPatientToFhirPatient({ uuid: 'patient-uuid' })).toMatchObject({
        id: 'patient-uuid',
        address: undefined,
        deceasedBoolean: undefined,
      });
    });

    it('maps configured contact attributes to FHIR telecom for the local patient summary', () => {
      const config = getPeruRegistrationConfig();
      const patient = FormManager.getPatientToCreate(
        true,
        {
          ...formValues,
          patientUuid: 'patient-uuid',
          gender: 'female',
          birthdate: '1990-05-14',
          attributes: {
            [peruPhoneAttributeTypeUuid]: '012345678',
            [peruMobilePhoneAttributeTypeUuid]: '987654321',
            [peruEmailAttributeTypeUuid]: 'juan.perez@example.org',
          },
        },
        {},
        {},
        [],
        config,
      );

      expect(FormManager.mapPatientToFhirPatient(patient, config).telecom).toEqual([
        {
          system: 'phone',
          use: 'home',
          value: '012345678',
        },
        {
          system: 'phone',
          use: 'mobile',
          value: '987654321',
        },
        {
          system: 'email',
          value: 'juan.perez@example.org',
        },
      ]);
    });
  });
});
