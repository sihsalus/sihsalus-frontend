import { type User } from './identity/user';
import { type OpenmrsObject } from './openmrs-object';

export interface Auditable extends OpenmrsObject {
  creator: User;
  dateCreated: Date;
  changedBy: User;
  dateChanged: Date;
}
