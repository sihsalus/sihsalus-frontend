import { modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import OverviewComponent from './components/overview.component';
import ReportsDataOverviewComponent from './components/reports-data-overview.component';
import ScheduledOverviewComponent from './components/scheduled-overview.component';
import { basePath } from './constants';
import styles from './root.scss';

const RootComponent: React.FC = () => {
  return (
    <RequireModulePrivilege privilege={modulePrivileges.reports}>
      <div className={styles.container}>
        <BrowserRouter basename={`${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`}>
          <Routes>
            <Route path="/" element={<OverviewComponent />} />
            <Route path="/scheduled-overview" element={<ScheduledOverviewComponent />} />
            <Route path="/reports-data-overview" element={<ReportsDataOverviewComponent />} />
          </Routes>
        </BrowserRouter>
      </div>
    </RequireModulePrivilege>
  );
};

export default RootComponent;
