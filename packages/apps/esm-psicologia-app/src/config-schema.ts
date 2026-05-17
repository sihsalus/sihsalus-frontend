import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  formUuid: {
    _type: Type.UUID,
    _description: 'Form UUID used to register psychology encounters.',
    _default: '32e43fc9-6de3-48e3-aafe-3b92f167753d',
  },
  encounterTypeUuid: {
    _type: Type.UUID,
    _description: 'Encounter type UUID used to list psychology encounters.',
    _default: '1b9f21c5-928c-4077-bc95-dcd4b1a5a366',
  },
  obsConceptUuidsToHide: {
    _type: Type.Array,
    _description: 'Observation concept UUIDs hidden from the expanded encounter details.',
    _default: [],
  },
};

export interface ConfigObject {
  formUuid: string;
  encounterTypeUuid: string;
  obsConceptUuidsToHide: Array<string>;
}
