import { type LoggedInUser } from '@openmrs/esm-framework';
import {
  canAssignProviderToQueueRoom,
  canClearServiceQueueEntries,
  canCreateQueueEntries,
  canEditServiceQueues,
  canManageServiceQueueCatalog,
  canManageServiceQueueRoomCatalog,
  canTriageQueuePatients,
  canTransitionServiceQueueEntries,
  canRegisterQueueCompanion,
  canSearchQueueCompanion,
  canStartQueueVisit,
  hasQueueCompanionCapability,
} from './permissions';
import routes from './routes.json';

const queueEntryWorkspacePrivileges = routes.workspaces2.find(
  ({ name }) => name === 'queue-patient-search-add-to-queue-workspace',
)?.privileges;
const startVisitWorkspacePrivileges = routes.workspaces2.find(
  ({ name }) => name === 'queue-patient-search-start-visit-workspace',
)?.privileges;

if (!Array.isArray(queueEntryWorkspacePrivileges) || !Array.isArray(startVisitWorkspacePrivileges)) {
  throw new Error('The queue entry workspaces must declare their complete privilege lists');
}

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
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'Get Queue Entries',
          'Get Queues',
          'Manage Queue Entries',
        ]),
      ),
    ).toBe(true);
  });

  it('does not allow an admission-only user to change a patient queue status', () => {
    const admissionUser = userWithPrivileges([
      'app:home.admision',
      'app:home.colasAtencion.editar',
      'Get Queue Entries',
      'Get Queues',
      'Manage Queue Entries',
    ]);

    expect(canEditServiceQueues(admissionUser)).toBe(true);
    expect(canTransitionServiceQueueEntries(admissionUser)).toBe(false);
  });

  it('keeps queue transitions available to a clinically authorized user and to administrators', () => {
    const privileges = [
      'app:home.colasAtencion.editar',
      'app:hoja.clinica.signosVitales.editar',
      'Get Queue Entries',
      'Get Queues',
      'Manage Queue Entries',
    ];

    expect(canTransitionServiceQueueEntries(userWithPrivileges(privileges))).toBe(true);
    expect(canTransitionServiceQueueEntries(userWithPrivileges([...privileges, 'app:home.admision']))).toBe(true);
  });

  it('allows clinical triage without granting administrative queue editing', () => {
    const nurse = userWithPrivileges(['app:home.colasAtencion', 'app:hoja.clinica.signosVitales.editar']);

    expect(canTriageQueuePatients(nurse)).toBe(true);
    expect(canEditServiceQueues(nurse)).toBe(false);
  });

  it('does not hide triage when the nurse lacks administrative queue privileges', () => {
    expect(
      canTriageQueuePatients(
        userWithPrivileges(['app:home.colasAtencion', 'app:hoja.clinica.signosVitales.editar', 'Get Queue Entries']),
      ),
    ).toBe(true);
  });

  it('requires both access to queues and permission to edit vital signs', () => {
    expect(canTriageQueuePatients(userWithPrivileges(['app:home.colasAtencion']))).toBe(false);
    expect(canTriageQueuePatients(userWithPrivileges(['app:hoja.clinica.signosVitales.editar']))).toBe(false);
  });

  it('requires the base patient, visit and queue set before offering to add someone to a queue', () => {
    expect(
      canCreateQueueEntries(
        userWithPrivileges([
          'app:home.colasAtencion.editar',
          'Get Queue Entries',
          'Get Queues',
          'Manage Queue Entries',
        ]),
      ),
    ).toBe(false);
    queueEntryWorkspacePrivileges.forEach((missingPrivilege) => {
      expect(
        canCreateQueueEntries(
          userWithPrivileges(queueEntryWorkspacePrivileges.filter((privilege) => privilege !== missingPrivilege)),
        ),
      ).toBe(false);
    });
    expect(canCreateQueueEntries(userWithPrivileges(queueEntryWorkspacePrivileges))).toBe(true);
  });

  it('allows the active-visit and administrative-queue branches without visit creation privileges', () => {
    const user = userWithPrivileges(queueEntryWorkspacePrivileges);

    expect(queueEntryWorkspacePrivileges).not.toEqual(expect.arrayContaining(['Add Visits', 'Get Visit Types']));
    expect(canCreateQueueEntries(user)).toBe(true);
    expect(canStartQueueVisit(user)).toBe(false);
  });

  it('requires the complete child workspace set before starting a new visit', () => {
    startVisitWorkspacePrivileges.forEach((missingPrivilege) => {
      expect(
        canStartQueueVisit(
          userWithPrivileges(startVisitWorkspacePrivileges.filter((privilege) => privilege !== missingPrivilege)),
        ),
      ).toBe(false);
    });
    expect(canStartQueueVisit(userWithPrivileges(startVisitWorkspacePrivileges))).toBe(true);
  });

  it('accepts search or the complete registration pair as alternative companion capabilities', () => {
    const searchUser = userWithPrivileges(['Get People']);
    const registrationUser = userWithPrivileges(['app:opciones.registrarAcompanante', 'Add People']);

    expect(canSearchQueueCompanion(searchUser)).toBe(true);
    expect(canRegisterQueueCompanion(searchUser)).toBe(false);
    expect(hasQueueCompanionCapability(searchUser)).toBe(true);
    expect(canSearchQueueCompanion(registrationUser)).toBe(false);
    expect(canRegisterQueueCompanion(registrationUser)).toBe(true);
    expect(hasQueueCompanionCapability(registrationUser)).toBe(true);
    expect(hasQueueCompanionCapability(userWithPrivileges(['app:opciones.registrarAcompanante']))).toBe(false);
    expect(hasQueueCompanionCapability(userWithPrivileges(['Add People']))).toBe(false);
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
