import { InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { AppErrorBoundary, modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import React, { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { useMockMode } from './api/mock-mode';
import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';
import styles from './indicators-dashboard.module.scss';
import IndicadorDetailPage from './pages/IndicadorDetailPage';
import IndicadoresPage from './pages/IndicadoresPage';
import IndicadorFormPage from './pages/IndicadorFormPage';
import MetasPage from './pages/MetasPage';
import ResultadosPage from './pages/ResultadosPage';

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const TabsLayout: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <div className={styles.container}>
      <div className={styles.moduleHeader}>
        <div>
          <h1 className={styles.pageTitle}>Indicadores Clínicos</h1>
          <p className={styles.subtitle}>
            Configuración, versionado y resultados de indicadores clínicos en un solo módulo.
          </p>
        </div>
      </div>
      <Tabs selectedIndex={tabIndex} onChange={({ selectedIndex }) => setTabIndex(selectedIndex)}>
        <TabList aria-label="Navegación de indicadores">
          <Tab>Indicadores</Tab>
          <Tab>Resultados</Tab>
          <Tab>Metas</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <IndicadoresPage />
          </TabPanel>
          <TabPanel>
            <ResultadosPage />
          </TabPanel>
          <TabPanel>
            <MetasPage />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

const IndicatorsContent: React.FC = () => {
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
            title="Datos de demostración activos"
            subtitle="La API no respondió. Los datos visibles son ejemplos y ninguna escritura se simulará."
            lowContrast
          />
        ) : null}
        {!isMockMode && !isBackendAvailable ? (
          <InlineNotification
            kind="error"
            title="Servicio de indicadores no disponible"
            subtitle="No se mostrarán datos de ejemplo ni se simularán operaciones."
            lowContrast
          />
        ) : null}
        <Routes>
          <Route path="/" element={<TabsLayout />} />
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
