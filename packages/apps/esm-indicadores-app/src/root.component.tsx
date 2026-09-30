import { InlineLoading, Tab, TabList, Tabs } from '@carbon/react';
import { AppErrorBoundary, modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import { useConfig } from '@openmrs/esm-framework';
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { type ConfigObject } from './config-schema';
import styles from './indicators-dashboard.module.scss';

const PanelPage = React.lazy(() => import('./pages/PanelPage'));
const IndicadoresPage = React.lazy(() => import('./pages/IndicadoresPage'));
const ResultadosPage = React.lazy(() => import('./pages/ResultadosPage'));
const MetasPage = React.lazy(() => import('./pages/MetasPage'));
const IndicadorDetailPage = React.lazy(() => import('./pages/IndicadorDetailPage'));
const IndicadorFormPage = React.lazy(() => import('./pages/IndicadorFormPage'));

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const PANEL_TAB_INDEX = 0;
const INDICADORES_TAB_INDEX = 1;
const RESULTADOS_TAB_INDEX = 2;
const METAS_TAB_INDEX = 3;

const selectedIndexForPath = (pathname: string): number => {
  const normalized = trimTrailingSlash(pathname);
  if (normalized === '/indicadores') {
    return INDICADORES_TAB_INDEX;
  }
  if (normalized === '/resultados') {
    return RESULTADOS_TAB_INDEX;
  }
  if (normalized === '/metas') {
    return METAS_TAB_INDEX;
  }
  return PANEL_TAB_INDEX;
};

const TabsLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedIndex = selectedIndexForPath(location.pathname);

  const handleTabChange = ({ selectedIndex: nextIndex }: { selectedIndex: number }) => {
    if (nextIndex === INDICADORES_TAB_INDEX) {
      navigate('/indicadores');
    } else if (nextIndex === RESULTADOS_TAB_INDEX) {
      navigate('/resultados');
    } else if (nextIndex === METAS_TAB_INDEX) {
      navigate('/metas');
    } else {
      navigate('/');
    }
  };

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
      <Tabs selectedIndex={selectedIndex} onChange={handleTabChange}>
        <TabList aria-label={t('indicatorsTabs', 'Secciones de indicadores')}>
          <Tab>{t('panel', 'Panel')}</Tab>
          <Tab>{t('indicators', 'Indicadores')}</Tab>
          <Tab>{t('results', 'Resultados')}</Tab>
          <Tab>{t('metasTitle', 'Metas')}</Tab>
        </TabList>
      </Tabs>
      <Suspense fallback={<InlineLoading description={t('pageLoading', 'Cargando página...')} />}>
        <Outlet />
      </Suspense>
    </div>
  );
};

const IndicatorsContent: React.FC = () => {
  const spaBase = trimTrailingSlash(window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');
  const basePath = `${spaBase}/indicators`;

  return (
    <AppErrorBoundary appName="esm-indicadores-app">
      <BrowserRouter basename={basePath}>
        <Routes>
          <Route element={<TabsLayout />}>
            <Route path="/" element={<PanelPage />} />
            <Route path="/indicadores" element={<IndicadoresPage />} />
            <Route path="/resultados" element={<ResultadosPage />} />
            <Route path="/metas" element={<MetasPage />} />
          </Route>
          <Route path="/new" element={<IndicadorFormPage mode="create" />} />
          <Route path="/:id/edit" element={<IndicadorFormPage mode="edit" />} />
          <Route path="/:id" element={<IndicadorDetailPage />} />
        </Routes>
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
