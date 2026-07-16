import { userHasAccess } from '@openmrs/esm-framework';

import { adtPrivilege, clinicalChartVisitsEditPrivilege } from '../constants';

type User = Parameters<typeof userHasAccess>[1] | null | undefined;

export function canCreateVisit(user: User) {
  return (
    userHasAccess('Add Visits', user) ||
    userHasAccess(clinicalChartVisitsEditPrivilege, user) ||
    userHasAccess(adtPrivilege, user)
  );
}

export function canEditVisit(user: User) {
  return (
    userHasAccess('Edit Visits', user) ||
    userHasAccess(clinicalChartVisitsEditPrivilege, user) ||
    userHasAccess(adtPrivilege, user)
  );
}

export const canStartVisit = canCreateVisit;
