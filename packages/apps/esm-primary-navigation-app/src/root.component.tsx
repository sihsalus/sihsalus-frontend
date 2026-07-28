import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useAuditLogger } from '@sihsalus/esm-audit-logger';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Navbar from './components/navbar/navbar.component';
import styles from './root.scss';

const Root: React.FC = () => {
  useAuditLogger();

  return (
    <AppErrorBoundary appName="esm-primary-navigation-app">
      <BrowserRouter basename={globalThis.getOpenmrsSpaBase()}>
        <Routes>
          <Route path="login/*" element={null} />
          <Route path="logout/*" element={null} />
          <Route
            path="*"
            element={
              <div className={styles.primaryNavContainer}>
                <Navbar />
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default Root;
