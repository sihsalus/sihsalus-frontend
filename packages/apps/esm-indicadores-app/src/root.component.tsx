import { InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import DefinirIndicadores from './definir-indicadores.component';
import { useIndicatorsHealth } from './hooks/useIndicatorsHealth';
import styles from './indicators-dashboard.module.scss';
import VerResultados from './ver-resultados.component';

const RootComponent: React.FC = () => {
  const { t } = useTranslation();
  const { isChecking, isMockMode, errorMessage } = useIndicatorsHealth();

  return (
    <AppErrorBoundary appName="esm-indicadores-app">
      <div className={styles.container}>
        <h2>{t('indicatorsTitle', 'Indicadores')}</h2>
        {isMockMode && !isChecking ? (
          <InlineNotification
            kind="warning"
            title={t('connectionError', 'Error de conexión')}
            subtitle={t('connectionErrorDetail', { errorMessage: errorMessage ?? '404 (Not Found)' })}
            lowContrast
          />
        ) : null}
        <Tabs>
          <TabList aria-label={t('indicatorsTabs', 'Secciones de indicadores')} contained>
            <Tab>{t('defineIndicators', 'Definir indicadores')}</Tab>
            <Tab>{t('viewResults', 'Ver resultados')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <DefinirIndicadores />
            </TabPanel>
            <TabPanel>
              <VerResultados />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </AppErrorBoundary>
  );
};

export default RootComponent;
