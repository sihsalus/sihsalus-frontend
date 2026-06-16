import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { laboratoryPrivilege } from './constants';
import LaboratoryDashboard from './laboratory-dashboard.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-laboratory-app">
      <RequirePrivilege privilege={laboratoryPrivilege}>
        <BrowserRouter basename={`${globalThis.spaBase}/home/laboratory`}>
          <Routes>
            <Route path="/" element={<LaboratoryDashboard />} />
          </Routes>
        </BrowserRouter>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default Root;
