import { clinicalChartPrivilege } from './constants';

const clinicalChartPrivileges = new Set([clinicalChartPrivilege, 'app:clinical.chart']);
const superUserRoles = new Set(['System Developer', 'Application: Has Super User Privileges']);

type NamedResource = {
  readonly name?: string;
  readonly display?: string;
};

type ClinicalChartAccessUser = {
  readonly privileges: ReadonlyArray<NamedResource>;
  readonly roles: ReadonlyArray<NamedResource>;
};

function resourceHasIdentifier(resource: NamedResource, identifiers: ReadonlySet<string>): boolean {
  return [resource.name, resource.display].some(
    (identifier) => typeof identifier === 'string' && identifiers.has(identifier.trim()),
  );
}

export function hasClinicalChartAccess(user: ClinicalChartAccessUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return (
    user.privileges.some((privilege) => resourceHasIdentifier(privilege, clinicalChartPrivileges)) ||
    user.roles.some((role) => resourceHasIdentifier(role, superUserRoles))
  );
}
