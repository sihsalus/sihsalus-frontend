import { type Auditable } from './auditable';
import { type OpenmrsObject } from './openmrs-object';
import { type Retireable } from './retireable';

export interface OpenmrsMetadata extends OpenmrsObject, Auditable, Retireable {
  name: string;
  description: string;
}
