import { type LoggedInUser, userHasAccess, useSession } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import {
  admissionPrivilege,
  serviceQueuesClearPrivilege,
  serviceQueuesEditPrivilege,
  serviceQueuesPrivilege,
  vitalsEditPrivilege,
} from './constants';

/**
 * Each capability lists everything its route destinations demand, so an action
 * is only offered when the modal or workspace behind it will actually open.
 * Checking less than that lets the operator click into a dead end.
 */
const queueEntryActionPrivileges = [
  serviceQueuesEditPrivilege,
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];
const triageActionPrivileges = [serviceQueuesPrivilege, vitalsEditPrivilege];
const queueEntryCreationPrivileges = [
  serviceQueuesEditPrivilege,
  'Get Patients',
  'Get Locations',
  'Get Visits',
  'Edit Visits',
  'Get Visit Attribute Types',
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];
const queueVisitCreationPrivileges = [...queueEntryCreationPrivileges, 'Add Visits', 'Get Visit Types'];
const queueCatalogPrivileges = [serviceQueuesEditPrivilege, 'Get Queues', 'Manage Queues'];
const queueRoomCatalogPrivileges = [serviceQueuesEditPrivilege, 'Get Queue Rooms', 'Get Queues', 'Manage Queue Rooms'];
const queueProviderRoomPrivileges = [serviceQueuesEditPrivilege, 'Get Queue Rooms', 'Manage Queue Rooms'];
const queueClearPrivileges = [
  serviceQueuesEditPrivilege,
  serviceQueuesClearPrivilege,
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];

function userHasAllAccess(privileges: Array<string>, user?: LoggedInUser): boolean {
  return Boolean(user && privileges.every((privilege) => userHasAccess(privilege, user)));
}

export function canEditServiceQueues(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueEntryActionPrivileges, user);
}

/**
 * Admissions can register arrivals and create queue entries, but must not
 * perform clinical queue transitions. Users with a clinical vitals capability
 * (including administrators) keep the queue actions granted by their native
 * queue privileges.
 */
export function canTransitionServiceQueueEntries(user?: LoggedInUser): boolean {
  const isAdmissionOnly =
    Boolean(user) && userHasAccess(admissionPrivilege, user) && !userHasAccess(vitalsEditPrivilege, user);

  return !isAdmissionOnly && canEditServiceQueues(user);
}

/**
 * Keep this aligned with the vitals workspace declaration in routes.json.
 * Native queue permissions are enforced by the API when the saved triage is
 * routed, but must not hide the clinical action from an otherwise authorized
 * triage nurse.
 */
export function canTriageQueuePatients(user?: LoggedInUser): boolean {
  return userHasAllAccess(triageActionPrivileges, user);
}

export function canCreateQueueEntries(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueEntryCreationPrivileges, user);
}

/**
 * Starting a new clinical visit is only one branch of queue entry creation.
 * Existing visits and administrative queues deliberately do not require these
 * extra native privileges.
 */
export function canStartQueueVisit(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueVisitCreationPrivileges, user);
}

export function canSearchQueueCompanion(user?: LoggedInUser): boolean {
  return Boolean(user && userHasAccess('Get People', user));
}

export function canRegisterQueueCompanion(user?: LoggedInUser): boolean {
  return Boolean(user && userHasAccess('app:opciones.registrarAcompanante', user) && userHasAccess('Add People', user));
}

export function hasQueueCompanionCapability(user?: LoggedInUser): boolean {
  return canSearchQueueCompanion(user) || canRegisterQueueCompanion(user);
}

export function canManageServiceQueueCatalog(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueCatalogPrivileges, user);
}

export function canManageServiceQueueRoomCatalog(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueRoomCatalogPrivileges, user);
}

export function canAssignProviderToQueueRoom(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueProviderRoomPrivileges, user);
}

export function canClearServiceQueueEntries(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueClearPrivileges, user);
}

export function CanEditServiceQueues({ children }: { children: ReactNode }) {
  const session = useSession();
  return canEditServiceQueues(session?.user) ? children : null;
}

export function CanCreateQueueEntries({ children }: { children: ReactNode }) {
  const session = useSession();
  return canCreateQueueEntries(session?.user) ? children : null;
}

export function CanManageServiceQueueCatalog({ children }: { children: ReactNode }) {
  const session = useSession();
  return canManageServiceQueueCatalog(session?.user) ? children : null;
}

export function CanManageServiceQueueRoomCatalog({ children }: { children: ReactNode }) {
  const session = useSession();
  return canManageServiceQueueRoomCatalog(session?.user) ? children : null;
}

export function CanClearServiceQueueEntries({ children }: { children: ReactNode }) {
  const session = useSession();
  return canClearServiceQueueEntries(session?.user) ? children : null;
}
