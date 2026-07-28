import { type Auditable } from './auditable';
import { type OpenmrsObject } from './openmrs-object';
import { type Voidable } from './voidable';

export interface OpenmrsData extends OpenmrsObject, Auditable, Voidable {}
