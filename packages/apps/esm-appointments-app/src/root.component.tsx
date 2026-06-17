import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Appointments from './appointments.component';
import AppointmentsCalendarView from './calendar/appointments-calendar-view.component';
import { appointmentsPrivilege } from './constants';
import PatientAppointmentsOverview from './patient-appointments/patient-appointments-overview.component';

const RootComponent: React.FC = () => {
  const appointmentsBasename = globalThis.getOpenmrsSpaBase() + 'home/appointments';

  return (
    <AppErrorBoundary appName="esm-appointments-app">
      <RequirePrivilege privilege={appointmentsPrivilege} description="Necesita permisos de citas para acceder a esta seccion.">
        <main>
          <BrowserRouter basename={appointmentsBasename}>
            <Routes>
              <Route path="/" element={<Appointments />} />
              <Route path="/:date" element={<Appointments />} />
              <Route path="/:date/:serviceType" element={<Appointments />} />
              <Route path="/calendar" element={<AppointmentsCalendarView />} />
              <Route path="/calendar/:date" element={<AppointmentsCalendarView />} />
              <Route path="/patient/:patientUuid" element={<PatientAppointmentsOverview />} />
            </Routes>
          </BrowserRouter>
        </main>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default RootComponent;
