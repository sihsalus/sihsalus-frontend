import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { useConfig, usePatient, useVisit } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type Encounter } from '../types';
import { getMenuItemTabsConfiguration } from '../utils/encounter-list-config-builder';
import { filter } from '../utils/helpers';
import { EncounterList } from './encounter-list.component';
import styles from './encounter-list-tabs.scss';

interface EncounterListTabsComponentProps {
  patientUuid: string;
}

const EncounterListTabsComponent: React.FC<EncounterListTabsComponentProps> = ({ patientUuid }) => {
  const config = useConfig();
  const configConcepts = useMemo(
    () => ({
      trueConceptUuid: config.trueConceptUuid,
      falseConceptUuid: config.falseConceptUuid,
      otherConceptUuid: config.otherConceptUuid,
    }),
    [config.trueConceptUuid, config.falseConceptUuid, config.otherConceptUuid],
  );
  const { t } = useTranslation();
  const tabsConfig = useMemo(
    () => getMenuItemTabsConfiguration(config.tabDefinitions ?? [], configConcepts),
    [config.tabDefinitions, configConcepts],
  );
  const patient = usePatient(patientUuid);
  const { currentVisit } = useVisit(patientUuid);
  const tabFilters = useMemo(() => {
    return tabsConfig.map((tab) => ({
      name: tab.name,
      filter: tab.hasFilter ? (encounter: Encounter) => filter(encounter, tab.formList?.[0]?.uuid) : null,
    }));
  }, [tabsConfig]);

  return (
    <div className={styles.tabContainer}>
      <Tabs>
        <TabList contained>
          {tabsConfig.map((tab) => (
            <Tab key={tab.name}>{t(tab.name)}</Tab>
          ))}
        </TabList>
        <TabPanels>
          {tabsConfig.map((tab) => {
            const tabFilter = tabFilters.find((t) => t.name === tab.name)?.filter;

            return (
              <TabPanel key={tab.name}>
                <EncounterList
                  filter={tabFilter}
                  patientUuid={patientUuid}
                  formList={tab.formList}
                  columns={tab.columns}
                  encounterType={tab.encounterType}
                  launchOptions={tab.launchOptions}
                  headerTitle={tab.headerTitle}
                  description={tab.description}
                  currentVisit={currentVisit}
                  deathStatus={patient?.patient?.deceasedBoolean}
                />
              </TabPanel>
            );
          })}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default EncounterListTabsComponent;
