import { useLeftNav, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { admissionPrivilege, basePath } from './constants';
import AdmissionHome from './pages/admission-home.component';
import PatientMerge from './pages/patient-merge.component';
import PatientAdmissionDetail from './patient/patient-admission-detail.component';
import styles from './root.scss';

export default function Root() {
  const session = useSession();

  useLeftNav({
    name: 'homepage-dashboard-slot',
    basePath,
    mode: 'normal',
  });

  return (
    <AppErrorBoundary
      appName="esm-admission-app"
      checkAccess={true}
      privilegesRequired={[admissionPrivilege]}
      user={session}
    >
      <div className={styles.root}>
        <BrowserRouter
          basename={`${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route index element={<AdmissionHome />} />
            <Route path="merge" element={<PatientMerge />} />
            <Route path="patient/:patientUuid" element={<PatientAdmissionDetail />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AppErrorBoundary>
  );
}
