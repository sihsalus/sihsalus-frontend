import { useLeftNav } from '@openmrs/esm-framework';
import { modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './dashboard/home-dashboard.component';

const StockManagementContent: React.FC = () => {
  const spaBasePath = `${window.spaBase}/stock-management`;

  useLeftNav({
    name: 'stock-page-dashboard-slot',
    basePath: spaBasePath,
  });

  return (
    <main className="omrs-main-content">
      <BrowserRouter basename={window.spaBase}>
        <Routes>
          <Route path="/stock-management" element={<Dashboard />} />
          <Route path="/stock-management/:dashboard/*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </main>
  );
};

const Root: React.FC = () => (
  <RequireModulePrivilege privilege={modulePrivileges.stockManagement}>
    <StockManagementContent />
  </RequireModulePrivilege>
);

export default Root;
