import { describe, expect, it } from 'vitest';

import { isAdmissionUser } from './admission-user';

describe('isAdmissionUser', () => {
  it.each(['Admisión', 'ADMISION', 'Admission'])('recognizes the admission role %s', (roleName) => {
    expect(isAdmissionUser({ roles: [{ display: roleName }] })).toBe(true);
  });

  it('also checks the role name returned by OpenMRS', () => {
    expect(isAdmissionUser({ roles: [{ display: 'Rol de admisión', name: 'Admisión' }] })).toBe(true);
  });

  it('recognizes the admission privilege used by the home module', () => {
    expect(isAdmissionUser({ privileges: [{ display: 'app:home.admision' }] })).toBe(true);
  });

  it('does not classify users with another explicit role as admission', () => {
    expect(
      isAdmissionUser({
        roles: [{ display: 'System Developer' }],
        privileges: [{ display: 'app:home.admision' }],
      }),
    ).toBe(false);
  });

  it('does not classify other users as admission users', () => {
    expect(isAdmissionUser({ roles: [{ display: 'Clinician' }] })).toBe(false);
    expect(isAdmissionUser()).toBe(false);
  });
});
