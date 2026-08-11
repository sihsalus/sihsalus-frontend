import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { formatTime, parseDate, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useVitalsFromObs } from '../../current-visit/hooks/useVitalsConceptMetadata';
import Vitals from '../../current-visit/visit-details/vitals.component';
import {
  type DiagnosisItem,
  type Encounter,
  type Note,
  type Observation,
  type Order,
  type OrderItem,
} from '../../types/index';
import styles from '../past-visit.scss';

import EncounterList from './encounter-list.component';
import Medications from './medications-list.component';
import Notes from './notes-list.component';

interface PastVisitSummaryProps {
  encounters: unknown[];
  patientUuid: string;
}

enum visitTypes {
  CURRENT = 'currentVisit',
  PAST = 'pastVisit',
}

const formatEncounterTime = (date?: string) => {
  if (!date) {
    return '';
  }
  try {
    return formatTime(parseDate(date));
  } catch {
    return '';
  }
};

const PastVisitSummary: React.FC<PastVisitSummaryProps> = ({ encounters, patientUuid }) => {
  const { t } = useTranslation();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const isTablet = useLayoutType() === 'tablet';
  const safeEncounters = (Array.isArray(encounters) ? encounters : []) as Array<Partial<Encounter>>;

  const encountersToDisplay = useMemo(
    () =>
      safeEncounters.map((encounter) => ({
        id: encounter?.uuid ?? '',
        datetime: encounter?.encounterDatetime ?? '',
        encounterType: encounter?.encounterType?.display ?? '--',
        form: encounter?.form,
        obs: encounter?.obs ?? [],
        provider:
          encounter?.encounterProviders?.length > 0 ? encounter.encounterProviders[0].provider?.person?.display : '--',
      })),
    [safeEncounters],
  );

  const [medications, notes, diagnoses, vitalsToRetrieve]: [
    Array<OrderItem>,
    Array<Note>,
    Array<DiagnosisItem>,
    Array<Partial<Encounter>>,
  ] = useMemo(() => {
    // Medication Tab
    const medications: Array<OrderItem> = [];
    const notes: Array<Note> = [];
    const diagnoses: Array<DiagnosisItem> = [];
    const vitalsToRetrieve: Array<Partial<Encounter>> = [];

    // Iterating through every Encounter
    safeEncounters.forEach((encounter) => {
      const encounterProvider = encounter?.encounterProviders?.[0];
      const observations = Array.isArray(encounter?.obs) ? encounter.obs : [];

      if (Array.isArray(encounter?.orders)) {
        medications.push(
          ...encounter.orders.map((order: Order) => ({
            order,
            provider: {
              name: encounterProvider?.provider?.person?.display ?? '',
              role: encounterProvider?.encounterRole?.display ?? '',
            },
            time: formatEncounterTime(encounter.encounterDatetime),
          })),
        );
      }

      // Check for Visit Diagnoses and Notes
      observations.forEach((obs: Observation) => {
        if (obs?.concept?.display === 'Visit Diagnoses') {
          const diagnosis = obs.groupMembers?.find((member) => member?.concept?.display === 'PROBLEM LIST')?.value
            ?.display;
          if (diagnosis) {
            diagnoses.push({ diagnosis });
          }
        } else if (obs?.concept?.display === 'General patient note') {
          // Putting all notes in a single array.
          notes.push({
            note: obs.value,
            provider: {
              name: encounterProvider?.provider?.person?.display ?? '',
              role: encounterProvider?.encounterRole?.display ?? '',
            },
            time: formatEncounterTime(encounter.encounterDatetime),
            concept: obs.concept,
          });
        }
      });

      vitalsToRetrieve.push(encounter);
    });
    return [medications, notes, diagnoses, vitalsToRetrieve];
  }, [safeEncounters]);

  const tabsClasses = classNames(styles.verticalTabs, {
    [styles.tabletTabs]: isTablet,
    [styles.desktopTabs]: !isTablet,
  });

  const tabClasses = (index) =>
    classNames(styles.tab, styles.bodyLong01, {
      [styles.selectedTab]: selectedTabIndex === index,
    });

  return (
    <div className={styles.wrapper}>
      <div className={styles.visitContainer}>
        <div className={tabsClasses}>
          <Tabs>
            <TabList className={styles.verticalTabList} aria-label="Past visits tabs">
              <Tab className={tabClasses(0)} id="vitals-tab" onClick={() => setSelectedTabIndex(0)}>
                {t('vitals', 'Vitals')}
              </Tab>
              <Tab className={tabClasses(1)} id="notes-tab" onClick={() => setSelectedTabIndex(1)}>
                {t('notes', 'Notes')}
              </Tab>
              <Tab className={tabClasses(2)} id="medications-tab" onClick={() => setSelectedTabIndex(2)}>
                {t('medications', 'Medications')}
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Vitals
                  vitals={useVitalsFromObs(vitalsToRetrieve)}
                  patientUuid={patientUuid}
                  visitType={visitTypes.PAST}
                />
              </TabPanel>
              <TabPanel>
                <Notes notes={notes} diagnoses={diagnoses} />
              </TabPanel>
              <TabPanel>
                <Medications medications={medications} />
              </TabPanel>
              <TabPanel>
                <EncounterList encounters={encountersToDisplay} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PastVisitSummary;
