import { type OpenmrsResource, type OpenmrsResourceStrict } from './openmrs-resource';

export interface Concept extends OpenmrsResourceStrict {
  name?: ConceptName;
  datatype?: ConceptDatatype;
  conceptClass?: ConceptClass;
  set?: boolean;
  version?: string;
  retired?: boolean;
  names?: Array<ConceptName>;
  descriptions?: Array<OpenmrsResource>;
  // TODO: add better typings
  mappings?: any;
  answers?: any;
  setMembers?: any;
  attributes?: any;
}

export interface ConceptDatatype extends OpenmrsResource {
  name?: string;
  description?: string;
  hl7Abbreviation?: string;
  retired?: boolean;
}

export interface ConceptName extends OpenmrsResource {
  name?: string;
  locale?: string;
  localPreferred?: boolean;
  conceptNameType?: 'FULLY_SPECIFIED' | 'SHORT' | 'INDEX_TERM';
}

export interface ConceptClass extends OpenmrsResource {
  name?: string;
  description?: string;
  retired?: boolean;
}
