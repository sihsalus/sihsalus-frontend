import { userHasAccess } from '@openmrs/esm-framework';

import { adtPrivilege, clinicalChartVisitsEditPrivilege } from '../constants';

type User = Parameters<typeof userHasAccess>[1] | null | undefined;

export function canStartVisit(user: User) {
  return userHasAccess(clinicalChartVisitsEditPrivilege, user) || userHasAccess(adtPrivilege, user);
}
