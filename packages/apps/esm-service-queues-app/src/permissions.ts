import { type LoggedInUser, userHasAccess, useSession } from '@openmrs/esm-framework';
import { isAdmissionUser } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';
import { serviceQueuesEditPrivilege } from './constants';

/** Admission staff can manage queue entries as part of their operational workflow. */
export function canEditServiceQueues(user?: LoggedInUser): boolean {
  return Boolean(user && (isAdmissionUser(user) || userHasAccess(serviceQueuesEditPrivilege, user)));
}

export function CanEditServiceQueues({ children }: { children: ReactNode }) {
  const session = useSession();
  return canEditServiceQueues(session?.user) ? children : null;
}
