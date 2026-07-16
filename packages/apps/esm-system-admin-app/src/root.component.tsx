import { AppErrorBoundary, modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { SystemAdministrationDashboard } from './dashboard/index.component';

const RootComponent: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-system-admin-app">
      <RequireModulePrivilege privilege={modulePrivileges.systemAdministration}>
        <BrowserRouter basename={`${globalThis.spaBase}/system-administration`}>
          <Routes>
            <Route path="/" element={<SystemAdministrationDashboard />} />
          </Routes>
        </BrowserRouter>
      </RequireModulePrivilege>
    </AppErrorBoundary>
  );
};

export default RootComponent;
