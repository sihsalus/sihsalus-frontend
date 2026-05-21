import { InlineLoading, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { EmptyState, ErrorState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { getObsFromEncounter } from '@sihsalus/esm-sihsalus-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';
import type { ConfigObject } from '../../../config-schema';
import type { OpenmrsEncounter } from '../../../types';
import { patientFormEntryWorkspace } from '../../../utils/constants';
import styles from '../../dashboard/in-patient.scss';
import SummaryCard from '../summary-card.component';

interface SurgicalSummaryProps {
  patientUuid: string;
  formEntrySub?: { unsubscribe: () => void } | null;
  encounters: OpenmrsEncounter[];
  isLoading: boolean;
  error: Error;
  isValidating: boolean;
  mutate: KeyedMutator<{ data: { results: OpenmrsEncounter[] } }>;
}
const ClinicalEncounter: React.FC<SurgicalSummaryProps> = ({
  patientUuid,
  encounters,
  isLoading,
  error,
  mutate,
  isValidating: _isValidating,
}) => {
  const { t } = useTranslation();
  const {
    concepts,
    formsList: { clinicalEncounterFormUuid },
  } = useConfig<ConfigObject>();
  const handleOpenOrEditClinicalEncounterForm = (encounterUUID = '') => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      workspaceTitle: t('clinicalEncounter', 'Clinical Encounter'),
      mutateForm: mutate,
      formInfo: {
        encounterUuid: encounterUUID,
        formUuid: clinicalEncounterFormUuid,
        patientUuid,
        visitTypeUuid: '',
        visitUuid: '',
      },
    });
  };
  const formattedEncounters = encounters.map((encounter) => {
    const admissionDate = getObsFromEncounter(encounter, concepts.admissionDateUuid);

    return {
      encounterDate: formatDate(new Date(encounter.encounterDatetime)),
      admissionDate:
        admissionDate === '--' || admissionDate == null
          ? formatDate(parseDate(encounter.encounterDatetime))
          : formatDate(parseDate(String(admissionDate))),
      primaryDiagnosis: encounter.diagnoses.length > 0 ? encounter.diagnoses[0].diagnosis.coded.display : '--',
      priorityOfAdmission: String(getObsFromEncounter(encounter, concepts.priorityOfAdmissionUuid)),
      admittingDoctor: encounter.encounterProviders.length > 0 ? encounter.encounterProviders[0].display : '',
      admissionWard: String(getObsFromEncounter(encounter, concepts.admissionWardUuid)),
      actions: (
        <OverflowMenu aria-label={t('actions', 'Actions')} flipped={false}>
          <OverflowMenuItem
            onClick={() => handleOpenOrEditClinicalEncounterForm(encounter.uuid)}
            itemText={t('edit', 'Edit')}
          />
          <OverflowMenuItem itemText={t('delete', 'Delete')} isDelete />
        </OverflowMenu>
      ),
    };
  });
  if (isLoading) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading...')}
        description={t('loadingData', 'Loading data')}
      />
    );
  }
  if (error) {
    return <ErrorState error={error} headerTitle={t('clinicalEncounter', 'Clinical Encounter')} />;
  }
  if (encounters.length === 0) {
    return (
      <EmptyState
        displayText={t('clinicalEncounter', 'Clinical Encounter')}
        headerTitle={t('clinicalEncounter', 'Clinical Encounter')}
        launchForm={handleOpenOrEditClinicalEncounterForm}
      />
    );
  }
  return (
    <div className={styles.cardContainer}>
      <SummaryCard title={t('dateOfSurgery', 'Date of Surgery')} value={formattedEncounters[0]?.encounterDate} />
      <SummaryCard title={t('typeOfSurgery', 'Type of Surgery')} value={formattedEncounters[0]?.primaryDiagnosis} />
      <SummaryCard
        title={t('postOperativeComplications', 'Post Operative Complications')}
        value={formattedEncounters[0]?.admissionDate}
      />
      <SummaryCard
        title={t('postOperativeDiagnosis', 'Post Operative Diagnosis')}
        value={formattedEncounters[0]?.priorityOfAdmission}
      />
      <SummaryCard title={t('operatingDoctor', 'Operating Doctor')} value={formattedEncounters[0]?.admittingDoctor} />
    </div>
  );
};
export default ClinicalEncounter;
