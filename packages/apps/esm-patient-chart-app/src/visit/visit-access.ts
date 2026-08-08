import { userHasAccess } from '@openmrs/esm-framework';

import { adtPrivilege, clinicalChartPrivilege, clinicalChartVisitsEditPrivilege } from '../constants';

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

/**
 * Closing or cancelling an active visit is a clinical workflow action. Admission
 * keeps the native `Edit Visits` capability because check-in may need to attach
 * an appointment to an existing visit, but that administrative capability must
 * not grant access to clinical closure actions.
 */
export function canCloseClinicalVisit(user: User) {
  return (
    !userHasAccess(adtPrivilege, user) &&
    userHasAccess(clinicalChartPrivilege, user) &&
    userHasAccess(clinicalChartVisitsEditPrivilege, user)
  );
}

/**
 * Manual consultation start is a clinical action. Admission keeps native
 * `Add Visits` for appointment check-in, but must schedule an appointment
 * instead of bypassing arrival and queue routing from patient search/chart.
 */
export function canManuallyStartVisit(user: User) {
  return !userHasAccess(adtPrivilege, user) && userHasAccess(clinicalChartPrivilege, user) && canCreateVisit(user);
}

export const canStartVisit = canCreateVisit;
