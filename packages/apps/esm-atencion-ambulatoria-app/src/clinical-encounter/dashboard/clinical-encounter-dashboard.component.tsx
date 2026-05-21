import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, Tile } from '@carbon/react';
import { Activity, CloudMonitoring, Dashboard, Friendship, ReminderMedical } from '@carbon/react/icons';
import { useConfig, useVisit } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import { useClinicalEncounter } from '../../hooks/useClinicalEncounter';
import ClinicalEncounter from '../clinical-enc.component';
import InPatientSummary from '../summary/in-patient-medical-summary/in-patient-medical-summary.component';
import OutPatientMedicalHistory from '../summary/out-patient-summary/patient-medical-history.component';
import OutPatientSocialHistory from '../summary/out-patient-summary/patient-social-history.component';
import SurgicalSummary from '../summary/surgical summary/surgical-summary.component';

import styles from './in-patient.scss';

interface ClinicalEncounterDashboardProps {
  patientUuid: string;
  encounterTypeUuid: string;
  formEntrySub: { unsubscribe: () => void } | null;
}

const ClinicalEncounterDashboard: React.FC<ClinicalEncounterDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { currentVisit } = useVisit(patientUuid);
  const isInPatient = currentVisit?.visitType?.display?.toLocaleLowerCase() === 'inpatient';
  const {
    clinicalEncounterUuid,
    concepts,
    formsList: { clinicalEncounterFormUuid },
  } = useConfig<ConfigObject>();
  const { encounters, isLoading, error, mutate, isValidating } = useClinicalEncounter(
    clinicalEncounterUuid,
    clinicalEncounterFormUuid,
    patientUuid,
    [
      concepts.admissionDateUuid,
      concepts.priorityOfAdmissionUuid,
      concepts.accidentTraumaUuid,
      concepts.bloodTransfusionUuid,
      concepts.surgicalHistoryUuid,
      concepts.accidentTraumaUuid,
      concepts.bloodTransfusionUuid,
      concepts.alcoholUseUuid,
      concepts.alcoholUseDurationUuid,
      concepts.smokingUuid,
      concepts.smokingDurationUuid,
      concepts.otherSubstanceAbuseUuid,
      concepts.admissionWardUuid,
    ],
  );
  return (
    <div>
      <Layer>
        <Tile>
          <div className={styles.desktopHeading}>
            <h4>{t('clinicalEncounter', 'Clinical encounter')}</h4>
          </div>
        </Tile>
      </Layer>

      <Layer style={{ backgroundColor: 'white', padding: '0 1rem' }}>
        <Tabs>
          <TabList contained activation="manual" aria-label={t('listOfTabs', 'List of tabs')}>
            <Tab renderIcon={Friendship}>{t('socialHistory', 'Social History')}</Tab>
            <Tab renderIcon={ReminderMedical}>{t('medicalHistory', 'Medical History')}</Tab>
            {isInPatient && <Tab renderIcon={CloudMonitoring}>{t('encounterDetails', 'Encounter details')}</Tab>}
            {isInPatient && <Tab renderIcon={Activity}>{t('surgicalSummary', 'Surgical Summary')}</Tab>}
            {isInPatient && <Tab renderIcon={Dashboard}>{t('inPatientSummary', 'In-Patient Summary')}</Tab>}
          </TabList>

          <TabPanels>
            <TabPanel>
              {
                <OutPatientSocialHistory
                  patientUuid={patientUuid}
                  encounters={encounters}
                  isLoading={isLoading}
                  error={error}
                  mutate={mutate}
                  isValidating={isValidating}
                />
              }
            </TabPanel>
            <TabPanel>
              {
                <OutPatientMedicalHistory
                  patientUuid={patientUuid}
                  encounters={encounters}
                  isLoading={isLoading}
                  error={error}
                  mutate={mutate}
                  isValidating={isValidating}
                />
              }
            </TabPanel>
            <TabPanel>
              {
                <ClinicalEncounter
                  patientUuid={patientUuid}
                  encounters={encounters}
                  isLoading={isLoading}
                  error={error}
                  mutate={mutate}
                  isValidating={isValidating}
                />
              }
            </TabPanel>
            <TabPanel>
              <SurgicalSummary
                patientUuid={patientUuid}
                encounters={encounters}
                isLoading={isLoading}
                error={error}
                mutate={mutate}
                isValidating={isValidating}
              />
            </TabPanel>
            <TabPanel>
              <InPatientSummary
                patientUuid={patientUuid}
                encounters={encounters}
                isLoading={isLoading}
                error={error}
                mutate={mutate}
                isValidating={isValidating}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Layer>
    </div>
  );
};
export default ClinicalEncounterDashboard;
