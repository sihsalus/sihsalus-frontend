import { type User } from './identity/User';
import { type OpenmrsObject } from './OpenmrsObject';

export interface Auditable extends OpenmrsObject {
  creator: User;
  dateCreated: Date;
  changedBy: User;
  dateChanged: Date;
}
