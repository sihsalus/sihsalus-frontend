import { type LoggedInUser, userHasAccess, useSession } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { serviceQueuesClearPrivilege, serviceQueuesEditPrivilege, vitalsEditPrivilege } from './constants';

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
const triageActionPrivileges = [
  vitalsEditPrivilege,
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];
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
 * Triage staff only need to record vitals and move the patient to the
 * configured clinical queue. They must not need the broader queue-editing
 * privilege that also exposes edit, remove and void actions.
 */
export function canTriageQueuePatients(user?: LoggedInUser): boolean {
  return userHasAllAccess(triageActionPrivileges, user);
}

export function canCreateQueueEntries(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueEntryCreationPrivileges, user);
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
