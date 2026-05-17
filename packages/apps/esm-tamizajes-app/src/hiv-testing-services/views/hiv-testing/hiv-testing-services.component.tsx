import { ContentSwitcher, Switch, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { CardHeader } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from '../../hiv-testing-component.scss';

import HivScreeningEncounters from './tabs/hiv-screening.component';
import HivTestingEncounters from './tabs/hiv-testing.component';

interface OverviewListProps {
  patientUuid: string;
}

const HivTestingEncountersList: React.FC<OverviewListProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('htsClinicalView', 'HTS Clinical View')}>
        <div className={styles.contextSwitcherContainer}>
          <ContentSwitcher selectedIndex={selectedIndex} onChange={({ index }) => setSelectedIndex(index)}>
            <Switch name={'screening'} text="Screening" />
            <Switch name={'hivTesting'} text="Testing" />
          </ContentSwitcher>
        </div>
      </CardHeader>
      {selectedIndex === 0 ? <HivScreeningEncounters patientUuid={patientUuid} /> : null}
      {selectedIndex === 1 ? <HivTestingEncounters patientUuid={patientUuid} /> : null}
    </div>
  );
};

export default HivTestingEncountersList;
