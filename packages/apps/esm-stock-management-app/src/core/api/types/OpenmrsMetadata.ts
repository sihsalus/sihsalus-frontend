import { type Auditable } from './Auditable';
import { type OpenmrsObject } from './OpenmrsObject';
import { type Retireable } from './Retireable';

export interface OpenmrsMetadata extends OpenmrsObject, Auditable, Retireable {
  name: string;
  description: string;
}
