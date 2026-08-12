import { type LoggedInUser } from '@openmrs/esm-framework';

import {
  canCopyFinanciadorToVisit,
  copyFinanciadorToVisitPrivileges,
  isFinanciadorCopyAuthorizationError,
} from './financiador-access';

function userWithPrivileges(privileges: ReadonlyArray<string>): LoggedInUser {
  return {
    privileges: privileges.map((display) => ({ display })),
    roles: [],
  } as unknown as LoggedInUser;
}

describe('financiador copy access', () => {
  it('requires every REST privilege used by the copy operation', () => {
    expect(canCopyFinanciadorToVisit(userWithPrivileges(copyFinanciadorToVisitPrivileges))).toBe(true);
  });

  it.each(copyFinanciadorToVisitPrivileges)('denies the capability without %s', (missingPrivilege) => {
    const grantedPrivileges = copyFinanciadorToVisitPrivileges.filter((privilege) => privilege !== missingPrivilege);
    expect(canCopyFinanciadorToVisit(userWithPrivileges(grantedPrivileges))).toBe(false);
  });

  it('denies the capability while the session user is unavailable', () => {
    expect(canCopyFinanciadorToVisit(undefined)).toBe(false);
  });

  it('classifies direct and response-wrapped authorization failures as deterministic', () => {
    expect(isFinanciadorCopyAuthorizationError({ status: 401 })).toBe(true);
    expect(isFinanciadorCopyAuthorizationError({ response: { status: 403 } })).toBe(true);
    expect(isFinanciadorCopyAuthorizationError({ status: 500 })).toBe(false);
    expect(isFinanciadorCopyAuthorizationError(new TypeError('Network error'))).toBe(false);
  });
});
