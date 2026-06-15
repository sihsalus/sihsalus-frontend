import { InlineLoading, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { EmptyState, ErrorState, getObsFromEncounter, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import capitalize from 'lodash-es/capitalize';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyedMutator } from 'swr';
import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { patientFormEntryWorkspace } from '../utils/constants';

import styles from './dashboard/in-patient.scss';
import SummaryCard from './summary/summary-card.component';

interface ClinicalEncounterProps {
  patientUuid: string;
  encounters: OpenmrsEncounter[];
  isLoading: boolean;
  error: Error;
  isValidating: boolean;
  mutate: KeyedMutator<{ data: { results: OpenmrsEncounter[] } }>;
}

const ClinicalEncounter: React.FC<ClinicalEncounterProps> = ({
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
  const tableRows = encounters?.map((encounter) => {
    const admissionDate = getObsFromEncounter(encounter, concepts.admissionDateUuid);

    return {
      id: `${encounter.uuid}`,
      encounterDate: formatDate(new Date(encounter.encounterDatetime)),
      admissionDate:
        admissionDate === '--' || admissionDate == null
          ? formatDate(parseDate(encounter.encounterDatetime))
          : formatDate(parseDate(String(admissionDate))),
      primaryDiagnosis: encounter.diagnoses.length > 0 ? encounter.diagnoses[0].diagnosis.coded.display : '--',
      priorityOfAdmission: String(getObsFromEncounter(encounter, concepts.priorityOfAdmissionUuid)),
      admittingDoctor: encounter.encounterProviders.length > 0 ? encounter.encounterProviders[0].provider.name : '',
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
      <SummaryCard title={t('encounterDate', 'Encounter Date')} value={tableRows[0]?.encounterDate} />
      <SummaryCard title={t('primaryDiagnosis', 'Primary Diagnosis')} value={tableRows[0]?.primaryDiagnosis} />
      <SummaryCard title={t('admissionDate', 'Admission Date')} value={tableRows[0]?.admissionDate} />
      <SummaryCard
        title={t('priorityOfAdmission', 'Priority Of Admission')}
        value={tableRows[0]?.priorityOfAdmission}
      />
      <SummaryCard title={t('admittingDoctor', 'Admitting Doctor')} value={capitalize(tableRows[0]?.admittingDoctor)} />
      <SummaryCard title={t('admissionWard', 'Admission Ward')} value={tableRows[0]?.admissionWard} />
    </div>
  );
};
export default ClinicalEncounter;
