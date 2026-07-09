import { Button, DataTableSkeleton } from '@carbon/react';
import {
  ArrowLeftIcon,
  ErrorState,
  getPatientName,
  PatientBannerContactDetails,
  PatientBannerPatientInfo,
  PatientBannerToggleContactDetailsButton,
  PatientPhoto,
  showSnackbar,
  usePatient,
  useVisit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './create-queue-entry.scss';
import { AddPatientToQueueContext } from './create-queue-entry.workspace';
import ExistingVisitFormComponent from './existing-visit-form/existing-visit-form.component';

interface CreateQueueEntryWorkspace2Props {
  selectedPatientUuid: string;
  currentServiceQueueUuid?: string;
  patient?: fhir.Patient;
}

const startVisitWorkspaceName = 'queue-patient-search-start-visit-workspace';

const CreateQueueEntryWorkspace2: React.FC<Workspace2DefinitionProps<CreateQueueEntryWorkspace2Props>> = ({
  workspaceProps,
  launchChildWorkspace,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { selectedPatientUuid, currentServiceQueueUuid, patient: searchedPatient } = workspaceProps ?? {};
  const { patient } = usePatient(selectedPatientUuid);
  const { activeVisit, isLoading, error } = useVisit(selectedPatientUuid);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const hasLaunchedStartVisitWorkspace = useRef(false);

  const handleCloseWindow = useCallback(() => {
    void closeWorkspace({ closeWindow: true, discardUnsavedChanges: true });
  }, [closeWorkspace]);

  const handleToggleContactDetails = useCallback(() => {
    setShowContactDetails((value) => !value);
  }, []);

  useEffect(() => {
    if (!selectedPatientUuid || isLoading || error || activeVisit || hasLaunchedStartVisitWorkspace.current) {
      return;
    }

    hasLaunchedStartVisitWorkspace.current = true;

    void launchChildWorkspace(startVisitWorkspaceName, {
      currentServiceQueueUuid,
      openedFrom: 'service-queues-add-patient',
      patient: searchedPatient ?? patient,
      patientUuid: selectedPatientUuid,
      workspaceTitle: t('addPatientToQueue', 'Add patient to queue'),
      onQueueEntryAdded: handleCloseWindow,
    }).catch((launchError) => {
      hasLaunchedStartVisitWorkspace.current = false;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorAddingPatientToQueue', 'Error adding patient to queue'),
        subtitle: launchError?.message ?? t('unexpectedError', 'An unexpected error occurred'),
      });
    });
  }, [
    activeVisit,
    currentServiceQueueUuid,
    error,
    handleCloseWindow,
    isLoading,
    launchChildWorkspace,
    patient,
    searchedPatient,
    selectedPatientUuid,
    t,
  ]);

  const patientToDisplay = patient ?? searchedPatient;
  const patientName = patientToDisplay && getPatientName(patientToDisplay);

  return (
    <Workspace2 title={t('addPatientToQueue', 'Add patient to queue')}>
      <div className={styles.patientSearchContainer}>
        <AddPatientToQueueContext.Provider value={{ currentServiceQueueUuid }}>
          {patientToDisplay ? (
            <div className={styles.patientBannerContainer}>
              <div className={styles.patientBanner}>
                <div className={styles.patientPhoto} role="img">
                  <PatientPhoto patientUuid={selectedPatientUuid} patientName={patientName} />
                </div>
                <PatientBannerPatientInfo patient={patientToDisplay} />
                <PatientBannerToggleContactDetailsButton
                  className={styles.toggleContactDetailsButton}
                  showContactDetails={showContactDetails}
                  toggleContactDetails={handleToggleContactDetails}
                />
              </div>
              {showContactDetails ? (
                <PatientBannerContactDetails
                  deceased={patientToDisplay.deceasedBoolean}
                  patientId={selectedPatientUuid}
                />
              ) : null}
            </div>
          ) : null}
          <div className={styles.backButton}>
            <Button
              className={styles.backButton}
              kind="ghost"
              renderIcon={(props) => <ArrowLeftIcon size={24} {...props} />}
              iconDescription={t('backToSearchResults', 'Back to search results')}
              size="sm"
              onClick={() => void closeWorkspace({ discardUnsavedChanges: true })}
            >
              <span>{t('backToSearchResults', 'Back to search results')}</span>
            </Button>
          </div>
          {isLoading ? (
            <DataTableSkeleton role="progressbar" />
          ) : error ? (
            <ErrorState headerTitle={t('errorFetchingVisit', 'Error fetching patient visit')} error={error} />
          ) : activeVisit ? (
            <ExistingVisitFormComponent visit={activeVisit} closeWorkspace={handleCloseWindow} />
          ) : (
            <DataTableSkeleton role="progressbar" />
          )}
        </AddPatientToQueueContext.Provider>
      </div>
    </Workspace2>
  );
};

export default CreateQueueEntryWorkspace2;
