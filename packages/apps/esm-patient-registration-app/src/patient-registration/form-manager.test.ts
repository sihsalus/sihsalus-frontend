import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import { FormManager } from './form-manager';
import { generateIdentifier } from './patient-registration.resource';
import { type FormValues } from './patient-registration.types';
import {
  getEffectiveRegistrationConfig,
  peruInsuranceCodeAttributeTypeUuid,
  peruPhoneAttributeTypeUuid,
} from './peru-registration-config';

vi.mock('./patient-registration.resource', async () => ({
  ...(await vi.importActual('./patient-registration.resource')),
  generateIdentifier: vi.fn(),
}));

const mockGenerateIdentifier = generateIdentifier as vi.Mock;

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

    it('should generate identifier if it has autoGeneration and manual entry disabled', async () => {
      formValues.identifiers.foo.autoGeneration = true;
      formValues.identifiers.foo.selectedSource.autoGenerationOption.manualEntryEnabled = false;
      mockGenerateIdentifier.mockResolvedValue({ data: { identifier: '10001V' } });
      await FormManager.savePatientIdentifiers(true, undefined, formValues.identifiers, {}, 'Nyc');
      expect(mockGenerateIdentifier.mock.calls).toHaveLength(1);
    });

    it('should not generate identifiers if manual entry enabled and identifier value given', async () => {
      formValues.identifiers.foo.autoGeneration = true;
      formValues.identifiers.foo.selectedSource.autoGenerationOption.manualEntryEnabled = true;
      await FormManager.savePatientIdentifiers(true, undefined, formValues.identifiers, {}, 'Nyc');
      expect(mockGenerateIdentifier.mock.calls).toHaveLength(0);
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
          '8d8718c2-c2cc-11de-8d13-0010c6dffd0f': 'HUANCAVELICA',
          [peruPhoneAttributeTypeUuid]: '999888777',
          [peruInsuranceCodeAttributeTypeUuid]: 'SIS-12345678',
        },
        address: {
          country: 'PERU',
          stateProvince: 'HUANCAVELICA',
          countyDistrict: 'CHURCAMPA',
          address1: 'JR LIMA 123',
        },
      };

      const patient = FormManager.getPatientToCreate(true, values, {}, {}, [], config);

      expect(patient.person.addresses).toEqual([values.address]);
      expect(patient.person.attributes).toEqual(
        expect.arrayContaining([
          { attributeType: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f', value: 'HUANCAVELICA' },
          { attributeType: peruPhoneAttributeTypeUuid, value: '999888777' },
          { attributeType: peruInsuranceCodeAttributeTypeUuid, value: 'SIS-12345678' },
        ]),
      );
    });
  });

  describe('mapPatientToFhirPatient', () => {
    it('maps the configured phone person attribute to FHIR telecom', () => {
      const config = getPeruRegistrationConfig();
      const patient = FormManager.getPatientToCreate(
        true,
        {
          ...formValues,
          patientUuid: 'patient-uuid',
          gender: 'female',
          birthdate: '1990-05-14',
          attributes: {
            [peruPhoneAttributeTypeUuid]: '999888777',
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
          use: 'mobile',
          value: '999888777',
        },
      ]);
    });
  });
});
