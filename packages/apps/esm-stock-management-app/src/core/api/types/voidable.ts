import { type User } from './identity/user';
import { type OpenmrsObject } from './openmrs-object';

export interface Voidable extends OpenmrsObject {
  dateVoided: Date;
  voidedBy: User;
  voidReason: string;
  voided: boolean;
}
