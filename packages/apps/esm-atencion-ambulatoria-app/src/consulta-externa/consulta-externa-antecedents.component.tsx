import { DataTableSkeleton, InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Friendship, ReminderMedical } from '@carbon/react/icons';
import { ExtensionSlot, useAssignedExtensions, useConfig, usePatient } from '@openmrs/esm-framework';
import { useClinicalEncounter } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import OutPatientMedicalHistory from '../clinical-encounter/summary/out-patient-summary/patient-medical-history.component';
import OutPatientSocialHistory from '../clinical-encounter/summary/out-patient-summary/patient-social-history.component';
import {
  consultaExternaAntecedentsSlot,
  moduleName,
  patientConditionsPrivilege,
  socialHistoryPrivilege,
} from '../utils/constants';

interface ConsultaExternaAntecedentsProps {
  patientUuid: string;
}

const PatientAntecedents: React.FC<ConsultaExternaAntecedentsProps> = ({ patientUuid }) => {
  const { t } = useTranslation(moduleName);
  const { patient, isLoading, error } = usePatient(patientUuid);
  const extensions = useAssignedExtensions(consultaExternaAntecedentsSlot);
  const state = useMemo(() => ({ patient, patientUuid }), [patient, patientUuid]);
  const unavailable = (
    <InlineNotification
      kind="error"
      lowContrast
      hideCloseButton
      title={t('antecedentsLoadFailed', 'Unable to load antecedents. Reload the page and try again.')}
    />
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" size="sm" zebra />;
  }
  if (error || !patient || patient.id !== patientUuid) {
    return unavailable;
  }

  return (
    <>
      <ExtensionSlot name={consultaExternaAntecedentsSlot} state={state} />
      {extensions.length === 0 ? unavailable : null}
    </>
  );
};

const ClinicalEncounterHistory: React.FC<ConsultaExternaAntecedentsProps & { medical: boolean }> = ({
  patientUuid,
  medical,
}) => {
  const {
    clinicalEncounterUuid,
    concepts,
    formsList: { clinicalEncounterFormUuid },
  } = useConfig<ConfigObject>();
  const history = useClinicalEncounter(clinicalEncounterUuid, clinicalEncounterFormUuid, patientUuid, [
    concepts.surgicalHistoryUuid,
    concepts.bloodTransfusionUuid,
    concepts.accidentTraumaUuid,
    concepts.alcoholUseUuid,
    concepts.alcoholUseDurationUuid,
    concepts.smokingUuid,
    concepts.smokingDurationUuid,
    concepts.otherSubstanceAbuseUuid,
  ]);

  return medical ? (
    <OutPatientMedicalHistory patientUuid={patientUuid} {...history} readOnly />
  ) : (
    <OutPatientSocialHistory patientUuid={patientUuid} {...history} />
  );
};

const ConsultaExternaAntecedents: React.FC<ConsultaExternaAntecedentsProps> = ({ patientUuid }) => {
  const { t } = useTranslation(moduleName);
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
      <TabList contained activation="manual" aria-label={t('antecedentsTabs', 'Antecedents tabs')}>
        <Tab renderIcon={ReminderMedical}>{t('antecedentsAndProblems', 'Antecedents and problems')}</Tab>
        <Tab renderIcon={Friendship}>{t('socialHistory', 'Social History')}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          {selectedTab === 0 ? (
            <>
              <RequirePrivilege privilege={patientConditionsPrivilege}>
                <PatientAntecedents patientUuid={patientUuid} />
              </RequirePrivilege>
              <RequirePrivilege privilege={socialHistoryPrivilege} hideUnauthorized>
                <ClinicalEncounterHistory patientUuid={patientUuid} medical />
              </RequirePrivilege>
            </>
          ) : null}
        </TabPanel>
        <TabPanel>
          {selectedTab === 1 ? (
            <RequirePrivilege privilege={socialHistoryPrivilege}>
              <ClinicalEncounterHistory patientUuid={patientUuid} medical={false} />
            </RequirePrivilege>
          ) : null}
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export default ConsultaExternaAntecedents;
