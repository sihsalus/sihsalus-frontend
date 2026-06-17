import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import PatientSearchPageComponent from './patient-search-page/patient-search-page.component';

const patientSearchPrivilege = 'Get Patients';

const PatientSearchRootComponent: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-patient-search-app">
      <RequirePrivilege privilege={patientSearchPrivilege} description="Necesita permiso para buscar pacientes.">
        <BrowserRouter
          basename={globalThis.getOpenmrsSpaBase()}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route path="search" element={<PatientSearchPageComponent />} />
          </Routes>
        </BrowserRouter>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default PatientSearchRootComponent;
