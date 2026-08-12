import { type LoggedInUser, userHasAccess } from '@openmrs/esm-framework';

const visitReusePrivileges = ['Get Visits', 'Edit Visits', 'Get Visit Attribute Types'] as const;

// This is the native OpenMRS contract exercised by the queue-entry workspace.
// The appointments frontend privilege is enforced by the modal route itself;
// requiring the Colas frontend privilege here would incorrectly couple two
// independent navigation contexts.
const queueEntryPrivileges = [
  'Get Patients',
  'Get Locations',
  'Get Visits',
  'Edit Visits',
  'Get Visit Attribute Types',
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
] as const;

function hasEveryPrivilege(user: LoggedInUser | null | undefined, privileges: ReadonlyArray<string>) {
  return Boolean(user && privileges.every((privilege) => userHasAccess(privilege, user)));
}

/** Mirrors the OR contract enforced by StartVisitFormGuard. */
export function canCreateAppointmentVisit(user: LoggedInUser | null | undefined) {
  return Boolean(
    user &&
      (userHasAccess('Add Visits', user) ||
        userHasAccess('app:home.admision', user) ||
        userHasAccess('app:hoja.clinica.visitas.editar', user)),
  );
}

/** The modal must resolve the active-visit branch before choosing its write contract. */
export function canInspectAppointmentVisits(user: LoggedInUser | null | undefined) {
  return Boolean(user && userHasAccess('Get Visits', user));
}

/** Existing visits must be readable and accept the appointment-link attribute. */
export function canReuseAppointmentVisit(user: LoggedInUser | null | undefined) {
  return hasEveryPrivilege(user, visitReusePrivileges);
}

/** Queue arrival needs every native dependency of the queue-entry workspace. */
export function canCreateAppointmentQueueEntry(user: LoggedInUser | null | undefined) {
  return hasEveryPrivilege(user, queueEntryPrivileges);
}
