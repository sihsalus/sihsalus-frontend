import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { serviceQueuesBasePath } from './constants';
import Home from './home.component';
import ServicesTable from './queue-patient-linelists/queue-services-table.component';
import AppointmentsTable from './queue-patient-linelists/scheduled-appointments-table.component';
import QueueScreen from './queue-screen/queue-screen.component';
import QueueTableByStatusView from './views/queue-table-by-status-view.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-service-queues-app">
      <main>
        <BrowserRouter basename={serviceQueuesBasePath}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/queue-table-by-status/:queueUuid" element={<QueueTableByStatusView />} />
            <Route path="/queue-table-by-status/:queueUuid/:statusUuid" element={<QueueTableByStatusView />} />
            <Route path="/screen" element={<QueueScreen />} />
            <Route path="/appointments-list/:value/" element={<AppointmentsTable />} />
            <Route path="/queue-list/:service/:serviceUuid/:locationUuid" element={<ServicesTable />} />
          </Routes>
        </BrowserRouter>
      </main>
    </AppErrorBoundary>
  );
};

export default Root;
