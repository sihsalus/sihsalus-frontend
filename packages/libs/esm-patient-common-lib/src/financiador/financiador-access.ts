import { type LoggedInUser, userHasAccess } from '@openmrs/esm-framework';

/**
 * Backend privileges exercised by the person-to-visit coverage copy:
 * person/patient/visit reads plus visit-attribute mutation and metadata access.
 */
export const copyFinanciadorToVisitPrivileges = [
  'Get People',
  'Get Patients',
  'Get Visits',
  'Edit Visits',
  'Get Visit Attribute Types',
] as const;

export function canCopyFinanciadorToVisit(user?: LoggedInUser): boolean {
  return Boolean(user && copyFinanciadorToVisitPrivileges.every((privilege) => userHasAccess(privilege, user)));
}

/** A denied REST write is deterministic for the current session and must not be offered as a retry loop. */
export function isFinanciadorCopyAuthorizationError(error: unknown): boolean {
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = Number(candidate?.status ?? candidate?.response?.status);
  return status === 401 || status === 403;
}
