import { navigate, showSnackbar } from '@openmrs/esm-framework';
import React, { type ReactNode, useEffect } from 'react';

import { RequirePrivilege } from './RequirePrivilege';

interface RequireModulePrivilegeProps {
  readonly privilege: string;
  readonly children: ReactNode;
}

let lastAccessDeniedRedirectAt = 0;

function RedirectUnauthorizedModuleToHome(): null {
  useEffect(() => {
    const now = Date.now();

    if (now - lastAccessDeniedRedirectAt < 1000) {
      return;
    }

    lastAccessDeniedRedirectAt = now;
    showSnackbar({
      kind: 'info',
      isLowContrast: true,
      title: 'Acceso restringido',
      subtitle: 'No tiene el privilegio requerido para acceder a este módulo. Fue redirigido al inicio.',
    });
    navigate({ to: `${window.spaBase}/home` });
  }, []);

  return null;
}

export function RequireModulePrivilege({ privilege, children }: RequireModulePrivilegeProps): React.ReactElement {
  return (
    <RequirePrivilege privilege={privilege} fallback={<RedirectUnauthorizedModuleToHome />}>
      {children}
    </RequirePrivilege>
  );
}
