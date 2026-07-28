import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import FuaFormatTable from '../fua/fua-format-table';
import FuaRequestTable from '../fua/fua-request-table';
import VisitTable from '../fua/visit-table';

import styles from './fua-tabs.scss';

const FuaOrdersTabs: React.FC = () => {
  const { t } = useTranslation();
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabChange = ({ selectedIndex }: { selectedIndex: number }) => {
    setActiveTabIndex(selectedIndex);
  };

  return (
    <div className={styles.appointmentList} data-testid="fua-tabs">
      <div className={styles.tabs}>
        <Tabs selectedIndex={activeTabIndex} onChange={handleTabChange}>
          <TabList style={{ paddingLeft: '1rem' }} aria-label="FUA tabs" contained>
            <Tab className={styles.tab}>{t('inProgressFuas', 'Visitas')}</Tab>
            <Tab className={styles.tab}>{t('completedFuas', 'Lista de Formatos FUA')}</Tab>
            <Tab className={styles.tab}>{t('allFuas', 'FUAs solicitados')}</Tab>
            <Tab className={styles.tab}>{t('envioFuas', 'Envio FUAs')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel className={styles.tabPanel}>
              <VisitTable />
            </TabPanel>
            <TabPanel className={styles.tabPanel}>
              <FuaFormatTable />
            </TabPanel>
            <TabPanel className={styles.tabPanel}>
              <FuaRequestTable statusFilter="all" />
            </TabPanel>
            <TabPanel className={styles.tabPanel}>
              <FuaRequestTable statusFilter="declined" />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default FuaOrdersTabs;
