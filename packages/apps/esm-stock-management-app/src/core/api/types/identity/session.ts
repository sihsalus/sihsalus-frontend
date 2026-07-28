import { type SessionLocation } from '@openmrs/esm-framework';
import { type PrivilegeScope } from './priviledge-scope';
import { type User } from './user';

export interface GetSessionResponse {
  sessionId: string;
  authenticated: boolean;
  user: User;
  locale: string;
  allowedLocales: string[];
  sessionLocation?: SessionLocation;
}

export interface StockManagementSession {
  privileges: PrivilegeScope[];
}
