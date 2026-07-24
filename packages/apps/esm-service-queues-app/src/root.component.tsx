import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AdminPage from './admin/admin-page/admin-page.component';
import { serviceQueuesBasePath, serviceQueuesPrivilege } from './constants';
import Home from './home.component';
import ServicesTable from './queue-patient-linelists/queue-services-table.component';
import AppointmentsTable from './queue-patient-linelists/scheduled-appointments-table.component';
import QueueScreen from './queue-screen/queue-screen.component';
import VisualQueue from './visual-queue/visual-queue.component';
import QueueTableByStatusView from './views/queue-table-by-status-view.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-service-queues-app">
      <RequirePrivilege
        privilege={serviceQueuesPrivilege}
        description="Necesita permisos de colas para acceder a esta seccion."
      >
        <main>
          <BrowserRouter
            basename={serviceQueuesBasePath}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/visual" element={<VisualQueue />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/queue-table-by-status/:queueUuid" element={<QueueTableByStatusView />} />
              <Route path="/queue-table-by-status/:queueUuid/:statusUuid" element={<QueueTableByStatusView />} />
              <Route path="/screen" element={<QueueScreen />} />
              <Route path="/appointments-list/:value/" element={<AppointmentsTable />} />
              <Route path="/queue-list/:service/:serviceUuid/:locationUuid" element={<ServicesTable />} />
            </Routes>
          </BrowserRouter>
        </main>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
};

export default Root;
