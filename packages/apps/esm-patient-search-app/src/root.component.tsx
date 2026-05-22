import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import PatientSearchPageComponent from './patient-search-page/patient-search-page.component';

const PatientSearchRootComponent: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-patient-search-app">
      <BrowserRouter
        basename={globalThis.getOpenmrsSpaBase()}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="search" element={<PatientSearchPageComponent />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default PatientSearchRootComponent;
