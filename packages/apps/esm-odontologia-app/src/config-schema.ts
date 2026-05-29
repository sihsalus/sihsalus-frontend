import { Type } from '@openmrs/esm-framework';
import { defaultAmpathOdontogramFormPersistence } from './odontogram/ampath-form-odontogram-config';

export const configSchema = {
  dentalEncounterTypeUuid: {
    _type: Type.UUID,
    _description: 'UUID of the encounter type for atención odontológica',
    _default: '1a58800e-dc0d-49b3-abfa-5da144e08d00',
  },
  dentalFormUuid: {
    _type: Type.UUID,
    _description: 'UUID of the form for atención odontológica',
    _default: '32e43fc9-6de3-48e3-aafe-3b92f167753d',
  },
  baseEncounterTypeUuid: {
    _type: Type.UUID,
    _description: 'UUID of the encounter type for base odontograms (hallazgos)',
    _default: '6d6a8f9f-6e0a-4e41-bb8f-11f65d6b4bb0',
  },
  attentionEncounterTypeUuid: {
    _type: Type.UUID,
    _description: 'UUID of the encounter type for attention odontograms (soluciones)',
    _default: 'bfc5b59b-9a8b-4d95-a8f1-2c9b1fb6f9bb',
  },
  findingConceptUuid: {
    _type: Type.UUID,
    _description: 'Default UUID of the concept for dental findings (fallback obs concept)',
    _default: '',
  },
  findingConceptUuids: {
    _type: Type.Object,
    _description: 'Optional map of findingId -> concept UUID to store specific obs concept per odontogram finding',
    _default: {},
  },
  ampathFormPersistence: {
    _type: Type.Object,
    _description: 'AMPATH form/encounter contract used by the custom odontogram UI to persist the full diagram state.',
    _default: defaultAmpathOdontogramFormPersistence,
  },
};

export interface OdontogramConfig {
  dentalEncounterTypeUuid: string;
  dentalFormUuid: string;
  baseEncounterTypeUuid: string;
  attentionEncounterTypeUuid: string;
  findingConceptUuid?: string;
  findingConceptUuids?: Record<string, string>;
  ampathFormPersistence?: {
    formUuid: string;
    baseFormUuid?: string;
    attentionFormUuid?: string;
    concepts: {
      snapshot: string;
      recordType: string;
      parentBaseEncounterUuid: string;
    };
  };
}
