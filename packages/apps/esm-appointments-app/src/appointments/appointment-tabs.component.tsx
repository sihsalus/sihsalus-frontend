import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';

import styles from './appointment-tabs.scss';
import ScheduledAppointments from './scheduled/scheduled-appointments.component';
import UnscheduledAppointments from './unscheduled/unscheduled-appointments.component';

interface AppointmentTabsProps {
  appointmentServiceTypes: Array<string>;
}

const AppointmentTabs: React.FC<AppointmentTabsProps> = ({ appointmentServiceTypes }) => {
  const { t } = useTranslation();
  const { showUnscheduledAppointmentsTab } = useConfig<ConfigObject>();
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabChange = ({ selectedIndex }: { selectedIndex: number }) => {
    setActiveTabIndex(selectedIndex);
  };

  return (
    <div className={styles.appointmentList} data-testid="appointment-list">
      {showUnscheduledAppointmentsTab ? (
        <div className={styles.tabs}>
          <Tabs selectedIndex={activeTabIndex} onChange={handleTabChange}>
            <TabList style={{ paddingLeft: '1rem' }} aria-label="Appointment tabs" contained>
              <Tab className={styles.tab}>{t('scheduledAppointmentsTab', 'Scheduled')}</Tab>
              <Tab className={styles.tab}>{t('unscheduledAppointmentsTab', 'Unscheduled')}</Tab>
            </TabList>
            <TabPanels>
              <TabPanel className={styles.tabPanel}>
                <ScheduledAppointments appointmentServiceTypes={appointmentServiceTypes} />
              </TabPanel>
              <TabPanel className={styles.tabPanel}>
                <UnscheduledAppointments />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      ) : (
        <ScheduledAppointments appointmentServiceTypes={appointmentServiceTypes} />
      )}
    </div>
  );
};

export default AppointmentTabs;
