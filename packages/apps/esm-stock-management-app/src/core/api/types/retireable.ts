import { type User } from './identity/user';
import { type OpenmrsObject } from './openmrs-object';

export interface Retireable extends OpenmrsObject {
  retired: boolean;
  dateRetired: Date;
  retiredBy: User;
  retireReason: string;
}
