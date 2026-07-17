import { type LoggedInUser, userHasAccess, useSession } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { serviceQueuesEditPrivilege } from './constants';

const queueCatalogPrivileges = [serviceQueuesEditPrivilege, 'Get Queues', 'Manage Queues'];
const queueRoomCatalogPrivileges = [serviceQueuesEditPrivilege, 'Get Queue Rooms', 'Get Queues', 'Manage Queue Rooms'];

function userHasAllAccess(privileges: Array<string>, user?: LoggedInUser): boolean {
  return Boolean(user && privileges.every((privilege) => userHasAccess(privilege, user)));
}

export function canEditServiceQueues(user?: LoggedInUser): boolean {
  return Boolean(user && userHasAccess(serviceQueuesEditPrivilege, user));
}

export function canManageServiceQueueCatalog(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueCatalogPrivileges, user);
}

export function canManageServiceQueueRoomCatalog(user?: LoggedInUser): boolean {
  return userHasAllAccess(queueRoomCatalogPrivileges, user);
}

export function CanEditServiceQueues({ children }: { children: ReactNode }) {
  const session = useSession();
  return canEditServiceQueues(session?.user) ? children : null;
}

export function CanManageServiceQueueCatalog({ children }: { children: ReactNode }) {
  const session = useSession();
  return canManageServiceQueueCatalog(session?.user) ? children : null;
}

export function CanManageServiceQueueRoomCatalog({ children }: { children: ReactNode }) {
  const session = useSession();
  return canManageServiceQueueRoomCatalog(session?.user) ? children : null;
}
