import { Type } from '@openmrs/esm-framework';
import { defaultAmpathImmunizationFormPersistence } from './immunizations/ampath-form-immunization-config';
import { defaultFhirImmunizationConceptMappings } from './immunizations/fhir-immunization-config';
import { type FhirImmunizationConceptMappings } from './types/fhir-immunization-domain';

/**
 * NTS 246-MINSA/DGIESP-2026 (RM 561-2026), §§6.2.2 and annex 2.
 * Product UUIDs are the stable identities in SIHSALUS OCL 2026-06-30.
 * These non-blocking routine labels do not decide eligibility, catch-up,
 * special populations, stock transitions or the progressive varicella dose.
 * Doses use [1...9], boosters [11...19]; historical numbers are never rewritten.
 */
export const configSchema = {
  minsaReference: {
    _type: Type.Object,
    _description: 'Normative reference used to configure the Peru national immunization schedule.',
    _default: {
      nts: 'NTS N.° 246-MINSA/DGIESP-2026',
      approvedBy: 'RM 561-2026-MINSA',
      latestModification: 'RM 561-2026-MINSA',
      vaccineCount: 23,
      protectedDiseaseCount: 36,
      notes:
        'Hexavalent introduction depends on pentavalent/IPV stock exhaustion at national, regional and local levels; the first DPT booster changes in 2027. Special-population schedules require clinical confirmation.',
    },
  },
  immunizationConceptSet: {
    _type: Type.String,
    _default: 'CIEL:984',
    _description:
      'A UUID or concept mapping for the vaccine concept set. The default CIEL:984 is resolved through REST and should have all selectable vaccines as answers or set members.',
  },
  fhirConceptMappings: {
    _type: Type.Object,
    _description:
      'Concept mappings expected by the OpenMRS FHIR2 Immunization resource. These values must exist uniquely in the content package for FHIR reads/writes to work.',
    _default: defaultFhirImmunizationConceptMappings,
  },
  ampathFormPersistence: {
    _type: Type.Object,
    _description:
      'AMPATH form/encounter contract used by the custom vaccination UI to persist vaccine events as OpenMRS obs.',
    _default: defaultAmpathImmunizationFormPersistence,
  },
  supplementalVaccines: {
    _type: Type.Array,
    _elements: {
      _type: Type.Object,
      uuid: {
        _type: Type.UUID,
        _description: 'Concept UUID for an additional MINSA vaccine/biologic not present in the base concept set.',
      },
      display: {
        _type: Type.String,
        _description: 'Display name for the additional vaccine/biologic.',
      },
      minsaCategory: {
        _type: Type.String,
        _description: 'MINSA population or operational category.',
      },
    },
    _description:
      'Additional MINSA 2026 vaccines/biologics configured locally while the OpenMRS concept set is updated.',
    _default: [
      {
        uuid: 'f0000180-0000-4000-8000-000000000180',
        display: 'Vacuna contra Virus Sincitial Respiratorio (VRS)',
        minsaCategory: 'Gestantes',
      },
      {
        uuid: 'f0000181-0000-4000-8000-000000000181',
        display: 'Nirsevimab',
        minsaCategory: 'Recién nacidos y lactantes',
      },
    ],
  },
  sequenceDefinitions: {
    _type: Type.Array,
    _elements: {
      _type: Type.Object,
      vaccineConceptUuid: {
        _type: Type.UUID,
        _description: 'The UUID of the individual vaccine concept',
      },
      sequences: {
        _type: Type.Array,
        _elements: {
          _type: Type.Object,
          sequenceLabel: {
            _type: Type.String,
            _description: 'Name of the dose/booster/schedule.. This will be used as a translation key as well.',
          },
          sequenceNumber: {
            _type: Type.Number,
            _description:
              'The dose number in the vaccines. Convention for doses is [1...9] and for boosters is [11...19]',
          },
          intervalInDaysAfterPreviousDose: {
            _type: Type.Number,
            _description:
              'Days after the previous dose when this dose should be administered. Used to auto-suggest the next dose date. Omit for first doses or single-dose vaccines.',
          },
          minAgeInMonths: {
            _type: Type.Number,
            _description: 'Minimum age in completed calendar months; a warning, never an eligibility decision.',
          },
          minAgeInDays: {
            _type: Type.Number,
            _description:
              'Minimum recommended patient age in days for this dose according to configured MINSA schedule. Used for warnings, not hard blocking.',
          },
          maxAgeInDays: {
            _type: Type.Number,
            _description:
              'Maximum recommended patient age in days for this dose according to configured MINSA schedule. Used for warnings, not hard blocking.',
          },
          minsaLabel: {
            _type: Type.String,
            _description: 'Human-readable MINSA schedule label for this dose.',
          },
          minsaPopulation: {
            _type: Type.String,
            _description: 'MINSA target population for this dose.',
          },
        },
      },
    },
    _description:
      'Doses/Schedules definitions for each vaccine configured if applicable. If not provided the vaccine would be treated as a vaccine without schedules',
    _default: [
      {
        vaccineConceptUuid: 'b328841a-7c35-4f39-8f64-be15ff33b7bf',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minAgeInDays: 0,
            maxAgeInDays: 1,
            minsaLabel: 'Recién nacido; primeras 24 horas',
          },
        ],
      },
      {
        vaccineConceptUuid: '7a5c2fbc-6848-44c9-b9a2-f9a37fe17ae8',
        sequences: [
          {
            sequenceLabel: 'Dosis-RN',
            sequenceNumber: 1,
            minAgeInDays: 0,
            maxAgeInDays: 1,
            minsaLabel: 'Recién nacido; primeras 24 horas',
          },
        ],
      },
      {
        vaccineConceptUuid: '41844230-91cc-5983-8c28-1275dda75b6f',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 2,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 4,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '3ra Dosis',
            sequenceNumber: 3,
            minAgeInMonths: 6,
            minsaLabel: '6 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '964748ed-787b-5629-9469-dd49e9243421',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 2,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 4,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '3ra Dosis',
            sequenceNumber: 3,
            minAgeInMonths: 6,
            minsaLabel: '6 meses',
          },
          {
            sequenceLabel: '1er Refuerzo',
            sequenceNumber: 11,
            minAgeInMonths: 18,
            minsaLabel: '18 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: 'e1cb9975-7474-5d2c-ae81-0beb5235f26a',
        sequences: [
          {
            sequenceLabel: '2do Refuerzo',
            sequenceNumber: 12,
            minAgeInMonths: 48,
            minsaLabel: '48 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '3789796f-95e7-5e34-b489-44ed27f4b521',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 2,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 4,
            minsaLabel: '4 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '308fe0e6-a6c9-54a9-b499-e01e53a42b5c',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 2,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 4,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '3ra Dosis',
            sequenceNumber: 3,
            minAgeInMonths: 12,
            minsaLabel: '12 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '5c56c39a-8003-5944-ace3-f0cbdcb68c08',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 6,
            minsaLabel: '6 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 7,
            minsaLabel: '7 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: 'f709d361-8e2a-5253-bd17-7bd34577aeea',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 12,
            minsaLabel: '12 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            minAgeInMonths: 18,
            minsaLabel: '18 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '9f33fb25-b37e-545e-946d-202295c42ab0',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInMonths: 12,
            minsaLabel: '12 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: 'e4be0faa-d28b-4cbc-9af3-ffac7133341a',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minAgeInMonths: 15,
            minsaLabel: '15 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '5b80bbc7-f7da-566e-9790-64b3e33794c7',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minAgeInMonths: 15,
            minsaLabel: '15 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '80d59cb9-0eb6-5e14-93fe-dbf4867cad7d',
        sequences: [
          {
            sequenceLabel: '1er Refuerzo',
            sequenceNumber: 11,
            minAgeInMonths: 18,
            minsaLabel: '18 meses',
          },
          {
            sequenceLabel: '2do Refuerzo',
            sequenceNumber: 12,
            minAgeInMonths: 48,
            minsaLabel: '48 meses',
          },
        ],
      },
    ],
  },
};

export interface ImmunizationConfigObject {
  minsaReference?: {
    nts: string;
    approvedBy: string;
    latestModification: string;
    vaccineCount: number;
    protectedDiseaseCount: number;
    notes?: string;
  };
  immunizationConceptSet: string;
  fhirConceptMappings: Partial<FhirImmunizationConceptMappings>;
  ampathFormPersistence?: {
    enabled: boolean;
    encounterTypeUuid: string;
    encounterRoleUuid: string;
    formName: string;
    formVersion: string;
    /** Optional persisted REST Form UUID; still verified against name, version and publication. */
    formUuid?: string;
    concepts: {
      vaccineUuid: string;
      vaccinationDate: string;
      doseNumber: string;
      manufacturer: string;
      lotNumber: string;
      expirationDate: string;
      note: string;
      nextDoseDate: string;
      status: string;
      statusReason: string;
      programContext: string;
    };
  };
  supplementalVaccines?: Array<{
    uuid: string;
    display: string;
    minsaCategory?: string;
  }>;
  sequenceDefinitions: Array<{
    vaccineConceptUuid: string;
    sequences: Array<{
      sequenceLabel: string;
      sequenceNumber: number;
      intervalInDaysAfterPreviousDose?: number;
      minAgeInMonths?: number;
      minAgeInDays?: number;
      maxAgeInDays?: number;
      minsaLabel?: string;
      minsaPopulation?: string;
    }>;
  }>;
}
