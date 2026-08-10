import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import InterconsultasDashboard from './dashboard/interconsultas-dashboard.component';
import { interconsultasHomePrivilege } from './constants';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-interconsultas-app">
      <RequirePrivilege privilege={interconsultasHomePrivilege}>
        <BrowserRouter basename={`${globalThis.spaBase}/home/interconsultas`}>
          <Routes>
            <Route path="/" element={<InterconsultasDashboard />} />
          </Routes>
        </BrowserRouter>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default Root;
