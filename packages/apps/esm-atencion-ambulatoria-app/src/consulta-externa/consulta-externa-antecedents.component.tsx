import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Friendship, ReminderMedical } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useClinicalEncounter } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import OutPatientMedicalHistory from '../clinical-encounter/summary/out-patient-summary/patient-medical-history.component';
import OutPatientSocialHistory from '../clinical-encounter/summary/out-patient-summary/patient-social-history.component';
import { socialHistoryPrivilege } from '../utils/constants';

interface ConsultaExternaAntecedentsProps {
  patientUuid: string;
}

const AuthorizedConsultaExternaAntecedents: React.FC<ConsultaExternaAntecedentsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
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
      concepts.surgicalHistoryUuid,
      concepts.bloodTransfusionUuid,
      concepts.accidentTraumaUuid,
      concepts.alcoholUseUuid,
      concepts.alcoholUseDurationUuid,
      concepts.smokingUuid,
      concepts.smokingDurationUuid,
      concepts.otherSubstanceAbuseUuid,
    ],
  );

  return (
    <Tabs>
      <TabList contained activation="manual" aria-label={t('antecedentsTabs', 'Antecedents tabs')}>
        <Tab renderIcon={ReminderMedical}>{t('medicalHistory', 'Medical History')}</Tab>
        <Tab renderIcon={Friendship}>{t('socialHistory', 'Social History')}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <OutPatientMedicalHistory
            patientUuid={patientUuid}
            encounters={encounters}
            isLoading={isLoading}
            error={error}
            mutate={mutate}
            isValidating={isValidating}
          />
        </TabPanel>
        <TabPanel>
          <OutPatientSocialHistory
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
  );
};

const ConsultaExternaAntecedents: React.FC<ConsultaExternaAntecedentsProps> = ({ patientUuid }) => (
  <RequirePrivilege privilege={socialHistoryPrivilege}>
    <AuthorizedConsultaExternaAntecedents patientUuid={patientUuid} />
  </RequirePrivilege>
);

export default ConsultaExternaAntecedents;
