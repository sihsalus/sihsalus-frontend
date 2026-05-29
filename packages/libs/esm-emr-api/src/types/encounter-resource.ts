import { type OpenmrsResource, type OpenmrsResourceStrict } from '@openmrs/esm-api';
import { type Diagnosis } from './diagnosis-resource';
import { type Location } from './location-resource';
import { type Obs } from './obs-resource';
import { type Patient } from './patient-resource';
import { type Visit } from './visit-resource';

export interface Encounter extends OpenmrsResourceStrict {
  encounterDatetime?: string;
  patient?: Patient;
  location?: Location;
  encounterType?: EncounterType;
  obs?: Array<Obs>;
  orders?: Array<OpenmrsResource>;
  visit?: Visit;
  encounterProviders?: Array<EncounterProvider>;
  diagnoses?: Array<Diagnosis>;
  form?: OpenmrsResource;
  voided?: boolean;
}

export interface EncounterType extends OpenmrsResource {
  name?: string;
  description?: string;
  retired?: boolean;
  viewPrivilege?: OpenmrsResource | null;
  editPrivilege?: OpenmrsResource | null;
}

export interface EncounterProvider extends OpenmrsResource {
  provider?: OpenmrsResource;
  encounterRole?: EncounterRole;
}

export interface EncounterRole extends OpenmrsResource {
  name?: string;
  description?: string;
  retired?: boolean;
}
