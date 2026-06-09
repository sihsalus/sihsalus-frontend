import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Assessment1Pictogram, PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InterconsultaTrayFilter } from '../types';
import styles from './interconsultas-dashboard.scss';
import InterconsultasTable from './interconsultas-table.component';

const trayTabs: Array<{ filter: InterconsultaTrayFilter; labelKey: string; labelDefault: string }> = [
  { filter: 'REQUESTED', labelKey: 'tabRequested', labelDefault: 'Solicitadas' },
  { filter: 'RECEIVED', labelKey: 'tabReceived', labelDefault: 'Recibidas / Pendientes' },
  { filter: 'IN_PROGRESS', labelKey: 'tabInProgress', labelDefault: 'En atención' },
  { filter: 'COMPLETED', labelKey: 'tabCompleted', labelDefault: 'Respondidas' },
  { filter: 'CLOSED', labelKey: 'tabClosed', labelDefault: 'Rechazadas / Canceladas' },
];

const InterconsultasDashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.dashboardContainer}>
      <PageHeader className={styles.pageHeader}>
        <PageHeaderContent illustration={<Assessment1Pictogram />} title={t('interconsultas', 'Interconsultas')} />
      </PageHeader>
      <Tabs>
        <TabList aria-label={t('interconsultaTrays', 'Bandejas de interconsultas')} contained>
          {trayTabs.map((tab) => (
            <Tab key={tab.filter}>{t(tab.labelKey, tab.labelDefault)}</Tab>
          ))}
        </TabList>
        <TabPanels>
          {trayTabs.map((tab) => (
            <TabPanel key={tab.filter} className={styles.tabPanel}>
              <InterconsultasTable filter={tab.filter} />
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default InterconsultasDashboard;
