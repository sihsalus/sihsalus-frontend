import { UserHasAccess } from '@openmrs/esm-framework';
import React, { type ReactNode } from 'react';
import { UnauthorizedState } from './UnauthorizedState';

interface RequirePrivilegeProps {
  readonly privilege: string | string[];
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly hideUnauthorized?: boolean;
  readonly description?: string;
}

export function RequirePrivilege({
  privilege,
  children,
  fallback,
  hideUnauthorized = false,
  description,
}: RequirePrivilegeProps): React.ReactElement {
  const unauthorizedFallback = hideUnauthorized
    ? null
    : (fallback ?? <UnauthorizedState privilege={privilege} description={description} />);

  return (
    <UserHasAccess privilege={privilege} fallback={unauthorizedFallback}>
      {children}
    </UserHasAccess>
  );
}
