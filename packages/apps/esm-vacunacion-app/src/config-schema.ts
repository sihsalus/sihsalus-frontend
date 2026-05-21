import { Type } from '@openmrs/esm-framework';
import { defaultFhirImmunizationConceptMappings } from './immunizations/fhir-immunization-config';
import { type FhirImmunizationConceptMappings } from './types/fhir-immunization-domain';

/**
 * Esquema Nacional de Vacunación — NTS N.° 196-MINSA/DGIESP-2022
 * (RM 884-2022, modificada por RM 218-2024, RM 474-2025, RM 709-2025 y RM 403-2026)
 *
 * Sequence convention: doses [1...9], boosters [11...19].
 * CIEL concept UUIDs follow the pattern {CIEL_ID}AAAAAAAAAAAAAAAAAAAAAAAAA.
 * Adjust UUIDs to match the concepts loaded on your OpenMRS server.
 *
 * RM 403-2026 incorporates VRS/Nirsevimab progressively. Keep its concept UUIDs
 * in the content package/configuration before enabling those entries here.
 */
export const configSchema = {
  minsaReference: {
    _type: Type.Object,
    _description: 'Normative reference used to configure the Peru national immunization schedule.',
    _default: {
      nts: 'NTS N.° 196-MINSA/DGIESP-2022',
      approvedBy: 'RM 884-2022-MINSA',
      latestModification: 'RM 403-2026-MINSA',
      vaccineCount: 18,
      protectedDiseaseCount: 28,
      notes:
        'RM 403-2026-MINSA incorporates VRS/Nirsevimab progressively. Add local concept UUIDs before enabling those entries.',
    },
  },
  immunizationConceptSet: {
    _type: Type.String,
    _default: 'CIEL:984',
    _description:
      'A UUID or concept mapping for the vaccine concept set. The default CIEL:984 is resolved through REST and should have all selectable vaccines as answers.',
  },
  fhirConceptMappings: {
    _type: Type.Object,
    _description:
      'Concept mappings expected by the OpenMRS FHIR2 Immunization resource. These values must exist uniquely in the content package for FHIR reads/writes to work.',
    _default: defaultFhirImmunizationConceptMappings,
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
        vaccineConceptUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minAgeInDays: 0,
            maxAgeInDays: 28,
          },
        ],
      },
      {
        vaccineConceptUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: 'Dosis-RN',
            sequenceNumber: 1,
            minAgeInDays: 0,
            maxAgeInDays: 1,
          },
        ],
      },
      {
        vaccineConceptUuid: '1685AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInDays: 60,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 120,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '3ra Dosis',
            sequenceNumber: 3,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 180,
            minsaLabel: '6 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '783AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInDays: 60,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 120,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: '3ra Dosis',
            sequenceNumber: 3,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 180,
            minsaLabel: '6 meses',
          },
          {
            sequenceLabel: '1er Refuerzo',
            sequenceNumber: 11,
            intervalInDaysAfterPreviousDose: 365,
            minAgeInDays: 540,
            minsaLabel: '18 meses',
          },
          {
            sequenceLabel: '2do Refuerzo',
            sequenceNumber: 12,
            intervalInDaysAfterPreviousDose: 913,
            minAgeInDays: 1460,
            minsaLabel: '4 años',
          },
        ],
      },
      {
        vaccineConceptUuid: '83531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInDays: 60,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 120,
            minsaLabel: '4 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '162342AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          {
            sequenceLabel: '1ra Dosis',
            sequenceNumber: 1,
            minAgeInDays: 60,
            minsaLabel: '2 meses',
          },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 60,
            minAgeInDays: 120,
            minsaLabel: '4 meses',
          },
          {
            sequenceLabel: 'Refuerzo',
            sequenceNumber: 11,
            intervalInDaysAfterPreviousDose: 240,
            minAgeInDays: 365,
            minsaLabel: '12 meses',
          },
        ],
      },
      {
        vaccineConceptUuid: '5261AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          { sequenceLabel: '1ra Dosis', sequenceNumber: 1 },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 30,
          },
        ],
      },
      {
        vaccineConceptUuid: '36AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          { sequenceLabel: '1ra Dosis', sequenceNumber: 1 },
          {
            sequenceLabel: 'Refuerzo',
            sequenceNumber: 11,
            intervalInDaysAfterPreviousDose: 180,
          },
        ],
      },
      {
        vaccineConceptUuid: '5859AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '5864AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '5857AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '781AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          { sequenceLabel: '1er Refuerzo', sequenceNumber: 11 },
          {
            sequenceLabel: '2do Refuerzo',
            sequenceNumber: 12,
            intervalInDaysAfterPreviousDose: 913,
          },
        ],
      },
      {
        vaccineConceptUuid: '5856AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1679AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1680AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1681AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1682AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1683AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '1684AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceLabel: 'Dosis-Unica', sequenceNumber: 1 }],
      },
      {
        vaccineConceptUuid: '162586AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          { sequenceLabel: '1ra Dosis', sequenceNumber: 1 },
          {
            sequenceLabel: '2da Dosis',
            sequenceNumber: 2,
            intervalInDaysAfterPreviousDose: 30,
          },
        ],
      },
      {
        vaccineConceptUuid: 'f0000180-0000-4000-8000-000000000180',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minsaLabel: 'Gestante',
            minsaPopulation: 'Gestantes según lineamientos MINSA para VRS',
          },
        ],
      },
      {
        vaccineConceptUuid: 'f0000181-0000-4000-8000-000000000181',
        sequences: [
          {
            sequenceLabel: 'Dosis-Unica',
            sequenceNumber: 1,
            minsaLabel: 'Recién nacido/lactante',
            minsaPopulation: 'Recién nacidos y lactantes según lineamientos MINSA para VRS',
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
      minAgeInDays?: number;
      maxAgeInDays?: number;
      minsaLabel?: string;
      minsaPopulation?: string;
    }>;
  }>;
}
