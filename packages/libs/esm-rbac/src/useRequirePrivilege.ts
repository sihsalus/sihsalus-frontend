import { Privilege } from '@openmrs/esm-framework';

export type UseRequirePrivilegeResult =
  | { status: 'authorized' }
  | { status: 'unauthorized'; missingPrivilege: string[] }
  | { status: 'unauthenticated' };

export type UserPrivilege = {
  uuid: string;
  display: string;
  name: string;
  resourceVersion: string;
};

export function checkRequirePrivilege(
  privileges: Privilege[],
  privilegesRequired: string[] | undefined,
  requireAll = true,
): UseRequirePrivilegeResult {
  if (!privilegesRequired || privilegesRequired.length === 0) {
    return { status: 'authorized' };
  }

  const privilegeDisplays = privileges.map((p) => p.display);
  const missing = privilegesRequired.filter((p) => !privilegeDisplays.includes(p));
  const hasAccess = requireAll ? missing.length === 0 : missing.length < privilegesRequired.length;

  if (hasAccess) {
    return { status: 'authorized' };
  }

  return { status: 'unauthorized', missingPrivilege: missing };
}

export function useRequirePrivilege(
  privileges: Privilege[],
  privilegesRequired: string[] | undefined,
  requireAll = true,
): UseRequirePrivilegeResult {
  return checkRequirePrivilege(privileges, privilegesRequired, requireAll);
}
