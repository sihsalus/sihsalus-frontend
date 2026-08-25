import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ChangePassword from './change-password/change-password.component';
import LocationPickerView from './location-picker/location-picker-view.component';
import Login from './login/login.component';
import RedirectLogout from './redirect-logout/redirect-logout.component';

const Root: React.FC = () => {
  return (
    <AppErrorBoundary appName="esm-login-app">
      <BrowserRouter basename={globalThis.getOpenmrsSpaBase()}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="login/confirm" element={<Login />} />
          <Route path="login/location" element={<LocationPickerView />} />
          <Route path="login/forced-password" element={null} />
          <Route path="logout" element={<RedirectLogout />} />
          <Route path="change-password" element={<ChangePassword />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default Root;
