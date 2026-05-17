import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  formUuid: {
    _type: Type.UUID,
    _description: 'Form UUID used to register physical therapy encounters.',
    _default: 'fdada8da-75fe-44c6-93e1-782d41e5565b',
  },
  encounterTypeUuid: {
    _type: Type.UUID,
    _description: 'Encounter type UUID used to list physical therapy encounters.',
    _default: '465a92f2-baf8-42e9-9612-53064be868e8',
  },
  obsConceptUuidsToHide: {
    _type: Type.Array,
    _description: 'Observation concept UUIDs hidden from expanded encounter details.',
    _default: [],
  },
};

export interface ConfigObject {
  formUuid: string;
  encounterTypeUuid: string;
  obsConceptUuidsToHide: Array<string>;
}
