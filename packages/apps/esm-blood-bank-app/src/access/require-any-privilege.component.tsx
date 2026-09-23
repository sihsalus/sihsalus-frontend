import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';

import type { BloodBankPrivilege } from './blood-bank-privileges';

export function RequireAnyPrivilege({ privileges, children }: { privileges: BloodBankPrivilege[]; children: ReactNode }) {
  const [first, ...rest] = privileges;
  if (!first) return null;

  return (
    <RequirePrivilege privilege={first} fallback={rest.length > 0 ? <RequireAnyPrivilege privileges={rest}>{children}</RequireAnyPrivilege> : null} hideUnauthorized={rest.length === 0}>
      {children}
    </RequirePrivilege>
  );
}
