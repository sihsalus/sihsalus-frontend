import { type Person } from './person';
import { type Role } from './role';

export interface SessionPriviledge {
  uuid: string;
  name: string;
}

export interface User {
  uuid: string;
  display: string;
  givenName: string;
  familyName: string;
  firstName: string;
  lastName: string;
  person?: Person;
  roles?: Role[];
  privileges: SessionPriviledge[];
}
