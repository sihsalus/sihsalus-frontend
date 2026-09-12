/** Roles must come from a fresh read of the exact, active authenticated user. */
export function getMissingEffectivePrivileges(
  required: readonly string[],
  privileges: unknown,
  roles: unknown,
): string[] {
  // OpenMRS User.hasPrivilege grants every privilege to System Developer, while
  // getPrivileges only lists explicit grants. Display labels are not role names.
  const isSystemDeveloper =
    Array.isArray(roles) && roles.some((role) => role?.name === 'System Developer' && role.retired === false);
  if (isSystemDeveloper) return [];

  const assigned = new Set(
    Array.isArray(privileges)
      ? privileges.filter((privilege) => privilege && !privilege.retired).map((privilege) => privilege.name)
      : [],
  );
  return required.filter((privilege) => !assigned.has(privilege));
}
