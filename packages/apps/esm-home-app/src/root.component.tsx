import { useConfig, useLeftNav, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { type HomeConfig } from './config-schema';
import DashboardContainer from './dashboard-container/dashboard-container.component';
import { DefaultDashboardRedirect } from './default-dashboard-redirect.component';

function getSpaBasePath(): string {
  const candidate = (globalThis as { spaBase?: unknown }).spaBase;
  return typeof candidate === 'string' ? candidate : '';
}

function isLeftNavMode(value: unknown): value is HomeConfig['leftNavMode'] {
  return value === 'normal' || value === 'collapsed' || value === 'hidden';
}

function getLeftNavMode(config: unknown): HomeConfig['leftNavMode'] {
  if (config && typeof config === 'object' && 'leftNavMode' in config) {
    const leftNavMode = (config as { leftNavMode?: unknown }).leftNavMode;
    if (isLeftNavMode(leftNavMode)) {
      return leftNavMode;
    }
  }

  return 'normal';
}

const Root: React.FC = () => {
  const spaBasePath = getSpaBasePath();
  const config = useConfig();
  const session = useSession();
  const leftNavMode = getLeftNavMode(config);
  const sessionKey =
    session?.authenticated && session?.sessionId
      ? `${session.sessionId}:${session.user?.uuid ?? 'unknown'}`
      : 'anonymous';
  useLeftNav({
    name: 'homepage-dashboard-slot',
    basePath: spaBasePath,
    mode: leftNavMode,
  });

  return (
    <AppErrorBoundary appName="esm-home-app">
      <main className="omrs-main-content">
        <BrowserRouter basename={spaBasePath} key={sessionKey}>
          <Routes>
            <Route path="/home" element={<DefaultDashboardRedirect />} />
            <Route path="/home/:dashboard/*" element={<DashboardContainer />} />
          </Routes>
        </BrowserRouter>
      </main>
    </AppErrorBoundary>
  );
};

export default Root;
