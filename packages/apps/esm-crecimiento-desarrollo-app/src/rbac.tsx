import {
  userHasAccess,
  useSession,
} from "@openmrs/esm-framework";
import { AppErrorBoundary, RequirePrivilege } from "@sihsalus/esm-rbac";
import React from "react";

import { appName } from "./constants";

export function useHasPrivilege(
  privilege: string | string[] | undefined,
): boolean {
  const session = useSession();
  return userHasAccess(privilege, session?.user);
}

interface DashboardAccessProps {
  readonly privilege: string | string[];
  readonly children: React.ReactNode;
}

export function DashboardAccess({
  privilege,
  children,
}: DashboardAccessProps): React.ReactElement {
  return (
    <AppErrorBoundary appName={appName}>
      <RequirePrivilege privilege={privilege}>{children}</RequirePrivilege>
    </AppErrorBoundary>
  );
}
