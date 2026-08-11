import { type LoggedInUser } from '@openmrs/esm-framework';
import {
  canAssignProviderToQueueRoom,
  canClearServiceQueueEntries,
  canCreateQueueEntries,
  canEditServiceQueues,
  canManageServiceQueueCatalog,
  canManageServiceQueueRoomCatalog,
  canTriageQueuePatients,
} from './permissions';

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

  it('does not offer entry actions on the app privilege alone: their modals also demand the native queue privileges', () => {
    expect(canEditServiceQueues(userWithPrivileges(['app:home.colasAtencion.editar']))).toBe(false);
  });

  it('allows entry actions with the edit privilege plus every native dependency of their modals', () => {
    expect(
      canEditServiceQueues(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queue Entries', 'Get Queues', 'Manage Queue Entries']),
      ),
    ).toBe(true);
  });

  it('allows clinical triage without granting administrative queue editing', () => {
    const nurse = userWithPrivileges([
      'app:hoja.clinica.signosVitales.editar',
      'Get Queue Entries',
      'Get Queues',
      'Manage Queue Entries',
    ]);

    expect(canTriageQueuePatients(nurse)).toBe(true);
    expect(canEditServiceQueues(nurse)).toBe(false);
  });

  it('does not allow triage without both vitals and queue transition privileges', () => {
    expect(
      canTriageQueuePatients(
        userWithPrivileges(['app:hoja.clinica.signosVitales.editar', 'Get Queue Entries', 'Get Queues']),
      ),
    ).toBe(false);
    expect(
      canTriageQueuePatients(userWithPrivileges(['Get Queue Entries', 'Get Queues', 'Manage Queue Entries'])),
    ).toBe(false);
  });

  it('requires the full patient-and-visit set before offering to add someone to a queue', () => {
    expect(
      canCreateQueueEntries(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queue Entries', 'Get Queues', 'Manage Queue Entries']),
      ),
    ).toBe(false);
    expect(
      canCreateQueueEntries(
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'Get Patients',
          'Get Locations',
          'Get Visits',
          'Edit Visits',
          'Get Visit Attribute Types',
          'Get Queue Entries',
          'Get Queues',
          'Manage Queue Entries',
        ]),
      ),
    ).toBe(true);
  });

  it('scopes provider room assignment to the room privileges its modal demands', () => {
    expect(canAssignProviderToQueueRoom(userWithPrivileges(['app:home.colasAtencion.editar']))).toBe(false);
    expect(
      canAssignProviderToQueueRoom(
        userWithPrivileges(['app:home.colasAtencion.editar', 'Get Queue Rooms', 'Manage Queue Rooms']),
      ),
    ).toBe(true);
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

  it('does not infer bulk queue clearing from generic queue editing', () => {
    expect(
      canClearServiceQueueEntries(
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'Get Queue Entries',
          'Get Queues',
          'Manage Queue Entries',
        ]),
      ),
    ).toBe(false);
  });

  it('requires the dedicated UI capability and every native queue dependency', () => {
    expect(
      canClearServiceQueueEntries(
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'app:home.colasAtencion.limpiar',
          'Get Queue Entries',
          'Get Queues',
          'Manage Queue Entries',
        ]),
      ),
    ).toBe(true);
    expect(
      canClearServiceQueueEntries(
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'app:home.colasAtencion.limpiar',
          'Get Queue Entries',
          'Get Queues',
        ]),
      ),
    ).toBe(false);
  });
});
