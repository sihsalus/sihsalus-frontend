import { InlineNotification } from '@carbon/react';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';

import { useMockMode } from './api/mock-mode';
import styles from './indicators-dashboard.module.scss';
import IndicadorDetailPage from './pages/IndicadorDetailPage';
import IndicadoresPage from './pages/IndicadoresPage';
import IndicadorFormPage from './pages/IndicadorFormPage';
import ResultadosPage from './pages/ResultadosPage';

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const RootComponent: React.FC = () => {
  const { isMockMode, errorMessage } = useMockMode();
  const spaBase = trimTrailingSlash(window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');
  const basePath = `${spaBase}/indicators`;

  return (
    <AppErrorBoundary appName="esm-indicadores-app">
      <BrowserRouter basename={basePath}>
        <div className={styles.container}>
          <div className={styles.moduleHeader}>
            <div>
              <h1 className={styles.pageTitle}>Indicadores Clínicos</h1>
              <p className={styles.subtitle}>
                Configuración, versionado y resultados de indicadores clínicos en un solo módulo.
              </p>
            </div>
            <nav className={styles.navTabs} aria-label="Navegación de indicadores">
              <NavLink to="/" end className={({ isActive }) => (isActive ? styles.navTabActive : styles.navTab)}>
                Indicadores
              </NavLink>
              <NavLink to="/results" className={({ isActive }) => (isActive ? styles.navTabActive : styles.navTab)}>
                Resultados
              </NavLink>
            </nav>
          </div>

          {isMockMode ? (
            <InlineNotification
              kind="warning"
              title="Modo demo activo"
              subtitle={`La API no respondió correctamente. Se están mostrando datos mock. ${errorMessage ?? ''}`}
              lowContrast
            />
          ) : null}

          <Routes>
            <Route path="/" element={<IndicadoresPage />} />
            <Route path="/new" element={<IndicadorFormPage mode="create" />} />
            <Route path="/:id/edit" element={<IndicadorFormPage mode="edit" />} />
            <Route path="/:id" element={<IndicadorDetailPage />} />
            <Route path="/results" element={<ResultadosPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default RootComponent;
