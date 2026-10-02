import { InlineLoading, InlineNotification, Tab, TabList, Tabs } from '@carbon/react';
import { AppErrorBoundary, modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { useMockMode } from './api/mock-mode';
import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';
import styles from './indicators-dashboard.module.scss';

const IndicadoresPage = React.lazy(() => import('./pages/IndicadoresPage'));
const ResultadosPage = React.lazy(() => import('./pages/ResultadosPage'));
const MetasPage = React.lazy(() => import('./pages/MetasPage'));
const IndicadorDetailPage = React.lazy(() => import('./pages/IndicadorDetailPage'));
const IndicadorFormPage = React.lazy(() => import('./pages/IndicadorFormPage'));

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const selectedIndexForPath = (pathname: string): number => {
  const normalized = trimTrailingSlash(pathname);
  if (normalized === '/resultados') {
    return 1;
  }
  if (normalized === '/metas') {
    return 2;
  }
  return 0;
};

const TabsLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedIndex = selectedIndexForPath(location.pathname);

  const handleTabChange = ({ selectedIndex: nextIndex }: { selectedIndex: number }) => {
    if (nextIndex === 1) {
      navigate('/resultados');
    } else if (nextIndex === 2) {
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
  const { t } = useTranslation();
  const { isMockMode, isBackendAvailable } = useMockMode();
  useIndicatorsHealth();
  const spaBase = trimTrailingSlash(window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');
  const basePath = `${spaBase}/indicators`;

  return (
    <AppErrorBoundary appName="esm-indicadores-app">
      <BrowserRouter basename={basePath}>
        {isMockMode ? (
          <InlineNotification
            kind="warning"
            title={t('demoDataActiveTitle', 'Datos de demostración activos')}
            subtitle={t(
              'demoDataActiveBody',
              'La API no respondió. Los datos visibles son ejemplos y ninguna escritura se simulará.',
            )}
            lowContrast
          />
        ) : null}
        {!isMockMode && !isBackendAvailable ? (
          <InlineNotification
            kind="error"
            title={t('backendUnavailableTitle', 'Servicio de indicadores no disponible')}
            subtitle={t('backendUnavailableBody', 'No se mostrarán datos de ejemplo ni se simularán operaciones.')}
            lowContrast
          />
        ) : null}
        <Routes>
          <Route element={<TabsLayout />}>
            <Route path="/" element={<IndicadoresPage />} />
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

const RootComponent: React.FC = () => (
  <RequireModulePrivilege privilege={modulePrivileges.indicators}>
    <IndicatorsContent />
  </RequireModulePrivilege>
);

export default RootComponent;
