import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { careLogbookBasePath, careLogbookMergePrivileges, careLogbookPrivilege } from './constants';
import AdmissionHome from './pages/admission-home.component';
import PatientMerge from './pages/patient-merge.component';
import PatientAdmissionDetail from './patient/patient-admission-detail.component';
import styles from './root.scss';

export default function Root() {
  return (
    <AppErrorBoundary appName="esm-care-logbook-app">
      <RequirePrivilege privilege={careLogbookPrivilege}>
        <div className={styles.root}>
          <BrowserRouter
            basename={`${globalThis.getOpenmrsSpaBase().slice(0, -1)}${careLogbookBasePath}`}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          >
            <Routes>
              <Route index element={<AdmissionHome />} />
              <Route
                path="merge"
                element={
                  <RequirePrivilege privilege={careLogbookMergePrivileges}>
                    <PatientMerge />
                  </RequirePrivilege>
                }
              />
              <Route path="patient/:patientUuid" element={<PatientAdmissionDetail />} />
            </Routes>
          </BrowserRouter>
        </div>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
