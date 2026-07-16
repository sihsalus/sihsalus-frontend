import { sessionStore, userHasAccess } from '@openmrs/esm-api';

export function userCanLaunch(privileges?: string | Array<string>): boolean {
  if (!privileges || (Array.isArray(privileges) && privileges.length === 0)) {
    return true;
  }

  const user = sessionStore.getState().session?.user;
  return Boolean(user && userHasAccess(privileges, user));
}
