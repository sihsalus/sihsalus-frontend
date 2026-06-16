import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';

import { fuaReadPrivilege } from './constant';
import FuaDashboard from './fua-dashboard.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-fua-app">
      <RequirePrivilege privilege={fuaReadPrivilege}>
        <FuaDashboard />
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default Root;
