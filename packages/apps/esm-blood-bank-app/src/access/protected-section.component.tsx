import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';

import type { BloodBankPrivilege } from './blood-bank-privileges';

interface ProtectedSectionProps {
  children: ReactNode;
  privilege: BloodBankPrivilege;
  hideUnauthorized?: boolean;
}

export function ProtectedSection({ children, privilege, hideUnauthorized = false }: ProtectedSectionProps) {
  return <RequirePrivilege privilege={privilege} hideUnauthorized={hideUnauthorized}>{children}</RequirePrivilege>;
}
