import { navigate, showSnackbar } from '@openmrs/esm-framework';
import React, { type ReactNode, useEffect, useRef } from 'react';

import { RequirePrivilege } from './RequirePrivilege';

interface RequireModulePrivilegeProps {
  readonly privilege: string;
  readonly children: ReactNode;
}

function RedirectUnauthorizedModuleToHome(): null {
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;
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
