import { Type } from '@openmrs/esm-framework';
import { hivScreeningConceptMap } from './hiv-testing-services/views/hiv-testing/hiv-screening-constants';
import { hivTestingConceptMap } from './hiv-testing-services/views/hiv-testing/hiv-testing-constants';

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
  hivScreeningConcepts: {
    _type: Type.Object,
    _description: 'Concept UUIDs used by the HIV screening summary columns.',
    _default: {
      populationTypeConcept: 'cf543666-ce76-4e91-8b8d-c0b54a436a2e',
      disabilityListConcept: '162558AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      departmentConcept: '159936AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      eligibilityConcept: '162699AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      testingRecommendedConcept: '167229AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  hivTestingConcepts: {
    _type: Type.Object,
    _description: 'Concept UUIDs used by the HIV testing summary columns.',
    _default: {
      testApproachConcept: '163556AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      testStrategyConcept: 'd85ff219-0f5a-408d-8df0-96bcc9be5071',
      entryPointConcept: '160540AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      finalResultConcept: '159427AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      tbScreeningConcept: '1659AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  },
  hivScreeningConceptMap: {
    _type: Type.Object,
    _description: 'Concept display and answer labels used by the HIV screening form summary.',
    _default: hivScreeningConceptMap,
  },
  hivTestingConceptMap: {
    _type: Type.Object,
    _description: 'Concept display and answer labels used by the HIV testing form summary.',
    _default: hivTestingConceptMap,
  },
};

type ConceptDisplayMap = Record<
  string,
  {
    display: string;
    answers: Record<string, string>;
  }
>;

export interface ConfigObject {
  encounterTypes: {
    hivTestingServices: string;
  };
  formsList: {
    htsScreening: string;
    htsInitialTest: string;
    htsRetest: string;
  };
  hivScreeningConcepts: {
    populationTypeConcept: string;
    disabilityListConcept: string;
    departmentConcept: string;
    eligibilityConcept: string;
    testingRecommendedConcept: string;
  };
  hivTestingConcepts: {
    testApproachConcept: string;
    testStrategyConcept: string;
    entryPointConcept: string;
    finalResultConcept: string;
    tbScreeningConcept: string;
  };
  hivScreeningConceptMap: ConceptDisplayMap;
  hivTestingConceptMap: ConceptDisplayMap;
}
