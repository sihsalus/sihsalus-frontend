import { userHasAccess } from '@openmrs/esm-framework';

import { adtPrivilege, clinicalChartPrivilege, clinicalChartVisitsEditPrivilege } from '../constants';

type User = Parameters<typeof userHasAccess>[1] | null | undefined;

/**
 * Roles OpenMRS treats as super users. `userHasAccess` grants them every
 * privilege, so they have to be recognised before any privilege-based exclusion.
 */
const superUserRoles = new Set(['System Developer', 'Application: Has Super User Privileges']);

function isSuperUser(user: User) {
  return Boolean(user?.roles?.some((role) => superUserRoles.has(role.name) || superUserRoles.has(role.display)));
}

/**
 * `userHasAccess` answers "may this user do X?", and that is always `true` for a
 * super user. Negating it therefore cannot exclude anyone: a super user matches
 * every exclusion and loses the action instead of gaining it. Exclusions must
 * read the privileges the account actually holds.
 */
function holdsPrivilege(privilege: string, user: User) {
  return Boolean(user?.privileges?.some((granted) => granted.display === privilege || granted.name === privilege));
}

/**
 * Admission staff, i.e. an account that really carries the ADT privilege rather
 * than inheriting it as a super user.
 */
function isAdmissionUser(user: User) {
  return !isSuperUser(user) && holdsPrivilege(adtPrivilege, user);
}

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
    !isAdmissionUser(user) &&
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
  return !isAdmissionUser(user) && userHasAccess(clinicalChartPrivilege, user) && canCreateVisit(user);
}

export const canStartVisit = canCreateVisit;
