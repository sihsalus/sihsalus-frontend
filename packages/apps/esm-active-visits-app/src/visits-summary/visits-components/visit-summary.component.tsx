import { Tab, TabList, TabPanel, TabPanels, Tabs, Tag } from '@carbon/react';
import { formatTime, type OpenmrsResource, parseDate } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Encounter, Note, Observation, Order, OrderItem } from '../../types';
import styles from '../visit-detail-overview.scss';

function findGroupMemberValue(obs: Observation, conceptDisplay: string): string | undefined {
  return obs.groupMembers.find((mem) => mem.concept.display === conceptDisplay)?.value.display;
}

function extractDiagnosis(obs: Observation): DiagnosisItem | null {
  const diagnosis = findGroupMemberValue(obs, 'PROBLEM LIST');
  const order = findGroupMemberValue(obs, 'Diagnosis order');
  if (!diagnosis || !order) return null;
  return { uuid: obs.uuid, diagnosis, order };
}

import MedicationSummary from './medications-summary.component';
import NotesSummary from './notes-summary.component';
import TestsSummary from './tests-summary.component';

interface DiagnosisItem {
  uuid: string;
  diagnosis: string;
  order: string;
}

interface VisitSummaryProps {
  encounters: Array<Encounter | OpenmrsResource>;
  patientUuid: string;
}

const VisitSummary: React.FC<VisitSummaryProps> = ({ encounters, patientUuid }) => {
  const { t } = useTranslation();
  const [, setSelectedTab] = useState(0);

  const [diagnoses, notes, medications]: [Array<DiagnosisItem>, Array<Note>, Array<OrderItem>] = useMemo(() => {
    // Medication Tab
    const medications: Array<OrderItem> = [];
    // Diagnoses in a Visit
    const diagnoses: Array<DiagnosisItem> = [];
    // Notes Tab
    const notes: Array<Note> = [];

    // Iterating through every Encounter
    encounters.forEach((enc: Encounter) => {
      // Orders of every encounter put in a single array.
      medications.push(
        ...enc.orders.map((order: Order) => ({
          order,
          provider: {
            name: enc.encounterProviders.length ? enc.encounterProviders[0].provider.person.display : '',
            role: enc.encounterProviders.length ? enc.encounterProviders[0].encounterRole.display : '',
          },
        })),
      );

      // Check for Visit Diagnoses and Notes
      if (enc.encounterType.display === 'Visit Note') {
        enc.obs.forEach((obs: Observation) => {
          if (obs.concept.display === 'Visit Diagnoses') {
            // Putting all the diagnoses in a single array.
            const diagnosisItem = extractDiagnosis(obs);
            if (diagnosisItem) diagnoses.push(diagnosisItem);
          } else if (obs.concept.display === 'Text of encounter note') {
            // Putting all notes in a single array.
            notes.push({
              uuid: obs.uuid,
              note: typeof obs.value === 'string' ? obs.value : '',
              provider: {
                name: enc.encounterProviders.length ? enc.encounterProviders[0].provider.person.display : '',
                role: enc.encounterProviders.length ? enc.encounterProviders[0].encounterRole.display : '',
              },
              time: formatTime(parseDate(obs.obsDatetime)),
            });
          }
        });
      }
    });
    return [diagnoses, notes, medications];
  }, [encounters]);

  const verticalTabsProps = { className: styles.verticalTabs } as unknown as React.ComponentProps<typeof Tabs>;

  return (
    <div className={styles.summaryContainer}>
      <p className={styles.diagnosisLabel}>{t('diagnoses', 'Diagnoses')}</p>

      <div className={styles.diagnosesList}>
        {diagnoses.length > 0 ? (
          diagnoses.map((diagnosis) => (
            <Tag key={diagnosis.uuid} type={diagnosis.order === 'Primary' ? 'blue' : 'red'}>
              {diagnosis.diagnosis}
            </Tag>
          ))
        ) : (
          <p className={classNames(styles.bodyLong01, styles.text02)} style={{ marginBottom: '0.5rem' }}>
            {t('noDiagnosesFound', 'No diagnoses found')}
          </p>
        )}
      </div>
      <Tabs {...verticalTabsProps}>
        <TabList aria-label="Visit summary tabs" className={styles.tablist}>
          <Tab className={classNames(styles.tab, styles.bodyLong01)} onClick={() => setSelectedTab(0)} id="notes-tab">
            {t('notes', 'Notes')}
          </Tab>
          <Tab className={styles.tab} onClick={() => setSelectedTab(1)} id="tests-tab">
            {t('tests', 'Tests')}
          </Tab>
          <Tab className={styles.tab} onClick={() => setSelectedTab(2)} id="tab-3">
            {t('medications', 'Medications')}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <NotesSummary notes={notes} />
          </TabPanel>
          <TabPanel>
            <TestsSummary patientUuid={patientUuid} encounters={encounters as Array<Encounter>} />
          </TabPanel>
          <TabPanel>
            <MedicationSummary medications={medications} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default VisitSummary;
