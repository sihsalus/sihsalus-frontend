import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import PatientSearchPageComponent from './patient-search-page/patient-search-page.component';
import { recentPatientsRoute } from './patient-search-constants';
import RecentPatientsPage from './recent-patients-page/recent-patients-page.component';

const patientSearchPrivilege = 'app:opciones.busquedaPaciente';

const PatientSearchRootComponent: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-patient-search-app">
      <RequirePrivilege privilege={patientSearchPrivilege} description="Necesita permiso para buscar pacientes.">
        <BrowserRouter basename={globalThis.getOpenmrsSpaBase()}>
          <Routes>
            <Route path="search" element={<PatientSearchPageComponent />} />
            <Route path={recentPatientsRoute} element={<RecentPatientsPage />} />
          </Routes>
        </BrowserRouter>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default PatientSearchRootComponent;
