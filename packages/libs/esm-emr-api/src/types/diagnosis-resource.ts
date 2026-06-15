import { type Concept, type ConceptClass, type OpenmrsResource, type OpenmrsResourceStrict } from '@openmrs/esm-api';
import { type Encounter } from './encounter-resource';
import { type Patient } from './patient-resource';

export interface Diagnosis extends OpenmrsResourceStrict {
  diagnosis?: {
    coded?: {
      uuid: string;
      display?: string;
      name?: Concept;
      datatype?: OpenmrsResource;
      conceptClass?: ConceptClass;
    };
    nonCoded?: string;
  };
  patient?: Patient;
  encounter?: Encounter;
  certainty?: string;
  rank?: number;
  formFieldNamespace?: string;
  formFieldPath?: string;
  voided?: boolean;
}
