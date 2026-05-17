import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  encounterTypes: {
    _type: Type.Object,
    _description: 'Encounter type UUIDs used by screening workflows.',
    _default: {
      hivTestingServices: '5cbb797f-bed5-4301-a3ce-6cc7eb7c687b',
    },
  },
  formsList: {
    _type: Type.Object,
    _description: 'Form UUIDs used by screening workflows.',
    _default: {
      htsScreening: '04295648-7606-11e8-adc0-fa7ae01bbebc',
      htsInitialTest: '402dc5d7-46da-42d4-b2be-f43ea4ad87b0',
      htsRetest: 'b08471f6-0892-4bf7-ab2b-bf79797b8ea4',
    },
  },
};

export interface ConfigObject {
  encounterTypes: {
    hivTestingServices: string;
  };
  formsList: {
    htsScreening: string;
    htsInitialTest: string;
    htsRetest: string;
  };
}
