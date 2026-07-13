interface UserRole {
  display?: string;
  name?: string;
}

interface UserPrivilege {
  display?: string;
  name?: string;
}

interface UserWithRoles {
  roles?: Array<UserRole>;
  privileges?: Array<UserPrivilege>;
}

const admissionRoleNames = new Set(['admision', 'admission']);
const admissionPrivilegeNames = new Set(['app:home.admision']);

function normalizeRoleName(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isAdmissionUser(user?: UserWithRoles | null): boolean {
  const hasAdmissionRole = user?.roles?.some((role) =>
    [role.display, role.name].some((roleName) => admissionRoleNames.has(normalizeRoleName(roleName))),
  );

  if (user?.roles?.length) {
    return Boolean(hasAdmissionRole);
  }

  const hasAdmissionPrivilege = user?.privileges?.some((privilege) =>
    [privilege.display, privilege.name].some((privilegeName) =>
      admissionPrivilegeNames.has(normalizeRoleName(privilegeName)),
    ),
  );

  return Boolean(hasAdmissionRole || hasAdmissionPrivilege);
}
