import { type LoggedInUser } from '@openmrs/esm-framework';
import { canEditServiceQueues } from './permissions';

function userWithPrivileges(privileges: string[], roles: string[] = []) {
  return {
    privileges: privileges.map((display) => ({ display })),
    roles: roles.map((display) => ({ display })),
  } as unknown as LoggedInUser;
}

describe('canEditServiceQueues', () => {
  it('allows admission users to manage queue entries with the operational queue privilege', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion'], ['Admisión']))).toBe(true);
  });

  it('keeps queue editing restricted for non-admission users without the edit privilege', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion'], ['Consulta Externa']))).toBe(false);
  });

  it('allows users who have the dedicated queue edit privilege', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion.editar']))).toBe(true);
  });
});
