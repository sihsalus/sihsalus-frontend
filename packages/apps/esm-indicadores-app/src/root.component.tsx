import { InlineLoading } from '@carbon/react';
import { useConfig, useLeftNav } from '@openmrs/esm-framework';
import { AppErrorBoundary, modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { type ConfigObject } from './config-schema';
import styles from './indicators-dashboard.module.scss';

const PanelPage = React.lazy(() => import('./pages/PanelPage'));
const IndicadoresPage = React.lazy(() => import('./pages/IndicadoresPage'));
const ResultadosPage = React.lazy(() => import('./pages/ResultadosPage'));
const MetasPage = React.lazy(() => import('./pages/MetasPage'));
const IndicadorDetailPage = React.lazy(() => import('./pages/IndicadorDetailPage'));
const IndicadorFormPage = React.lazy(() => import('./pages/IndicadorFormPage'));

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const ModuleLayout: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.moduleHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('indicatorsTitle', 'Indicadores Clínicos')}</h1>
          <p className={styles.subtitle}>
            {t('rootSubtitle', 'Configuración, versionado y resultados de indicadores clínicos en un solo módulo.')}
          </p>
        </div>
      </div>
      <Suspense fallback={<InlineLoading description={t('pageLoading', 'Cargando página...')} />}>
        <Outlet />
      </Suspense>
    </div>
  );
};

const IndicatorsContent: React.FC = () => {
  const spaBase = trimTrailingSlash(window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');
  const basePath = `${spaBase}/indicators`;

  // Renders the module sections in the shell's left rail. The slot is filled by
  // the `indicadores-nav` extension declared in routes.json.
  const leftNav = useMemo(() => ({ name: 'indicadores-nav-slot', basePath }), [basePath]);
  useLeftNav(leftNav);

  return (
    <AppErrorBoundary appName="esm-indicadores-app">
      <BrowserRouter basename={basePath}>
        {/* Reserves the shell left-nav width for EVERY module route, including the
            detail and form screens that render outside `ModuleLayout`. */}
        <div className={styles.appShell}>
          <Routes>
            <Route element={<ModuleLayout />}>
              <Route path="/" element={<PanelPage />} />
              <Route path="/indicadores" element={<IndicadoresPage />} />
              <Route path="/resultados" element={<ResultadosPage />} />
              <Route path="/metas" element={<MetasPage />} />
            </Route>
            <Route path="/new" element={<IndicadorFormPage mode="create" />} />
            <Route path="/:id/edit" element={<IndicadorFormPage mode="edit" />} />
            <Route path="/:id" element={<IndicadorDetailPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

const RootComponent: React.FC = () => {
  const { bypassPrivilegeGuard } = useConfig<ConfigObject>();

  // Dev-only escape hatch (config `bypassPrivilegeGuard`). Skips the
  // app:indicadores guard so the module mounts without the privilege.
  // NEVER enable in production.
  if (bypassPrivilegeGuard) {
    return <IndicatorsContent />;
  }

  return (
    <RequireModulePrivilege privilege={modulePrivileges.indicators}>
      <IndicatorsContent />
    </RequireModulePrivilege>
  );
};

export default RootComponent;
