import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { epidemiologicalSurveillanceReadPrivilege } from './constants';
import Dashboard from './dashboard.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-epidemiological-surveillance">
      <RequirePrivilege privilege={epidemiologicalSurveillanceReadPrivilege}>
        <Dashboard />
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default Root;
