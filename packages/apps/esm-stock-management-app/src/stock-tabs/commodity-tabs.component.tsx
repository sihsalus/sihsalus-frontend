import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import StockItems from '../stock-items/stock-items.component';
import StockOperations from '../stock-operations/stock-operations-table.component';
import StockSources from '../stock-sources/stock-sources.component';
import StockUserScopes from '../stock-user-role-scopes/stock-user-role-scopes.component';
import styles from './commodity-tabs.scss';

const StockCommodityTabs: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.tabContainer}>
      <Tabs>
        <TabList contained fullWidth>
          <Tab>{t('stockItems', 'Stock items')}</Tab>
          <Tab>{t('stockOperations', 'Stock operations')}</Tab>
          <Tab>{t('userRoleScopes', 'User role scopes')}</Tab>
          <Tab>{t('sources', 'Sources')}</Tab>
          {/* <Tab>Locations</Tab> */}
          {/*<Tab>Reports</Tab>*/}
        </TabList>
        <TabPanels>
          <TabPanel>
            <StockItems />
          </TabPanel>
          <TabPanel>
            <StockOperations />
          </TabPanel>
          <TabPanel>
            <StockUserScopes />
          </TabPanel>
          <TabPanel>
            <StockSources />
          </TabPanel>
          {/* <TabPanel>
            <StockLocations />
          </TabPanel> */}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default StockCommodityTabs;
