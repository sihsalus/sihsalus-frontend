import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import InterconsultasDashboard from './dashboard/interconsultas-dashboard.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-interconsultas-app">
      <BrowserRouter basename={`${globalThis.spaBase}/home/interconsultas`}>
        <Routes>
          <Route path="/" element={<InterconsultasDashboard />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default Root;
