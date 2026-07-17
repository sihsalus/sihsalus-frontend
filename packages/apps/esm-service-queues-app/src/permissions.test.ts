import { type LoggedInUser } from '@openmrs/esm-framework';
import { canEditServiceQueues, canManageServiceQueueCatalog, canManageServiceQueueRoomCatalog } from './permissions';

function userWithPrivileges(privileges: string[], roles: string[] = []) {
  return {
    privileges: privileges.map((display) => ({ display })),
    roles: roles.map((display) => ({ display })),
  } as unknown as LoggedInUser;
}

describe('canEditServiceQueues', () => {
  it('does not turn a role name into queue editing authority', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion'], ['SIHSALUS Admision']))).toBe(false);
  });

  it('keeps queue editing restricted without the edit privilege', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion'], ['Consulta Externa']))).toBe(false);
  });

  it('allows users who have the dedicated queue edit privilege', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion.editar']))).toBe(true);
  });

  it('does not infer queue catalog management from the generic edit privilege', () => {
    expect(canManageServiceQueueCatalog(userWithPrivileges(['app:home.colasAtencion.editar']))).toBe(false);
  });

  it('requires the native queue catalog privileges', () => {
    expect(
      canManageServiceQueueCatalog(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queues', 'Manage Queues']),
      ),
    ).toBe(true);
  });

  it('requires queue and room metadata before managing queue rooms', () => {
    expect(
      canManageServiceQueueRoomCatalog(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queue Rooms', 'Manage Queue Rooms']),
      ),
    ).toBe(false);
    expect(
      canManageServiceQueueRoomCatalog(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queue Rooms', 'Get Queues', 'Manage Queue Rooms']),
      ),
    ).toBe(true);
  });
});
