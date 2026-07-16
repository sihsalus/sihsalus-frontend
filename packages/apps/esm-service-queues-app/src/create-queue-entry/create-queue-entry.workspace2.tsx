import { Button, DataTableSkeleton } from '@carbon/react';
import {
  ArrowLeftIcon,
  ErrorState,
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  getPatientName,
  PatientBannerContactDetails,
  PatientBannerPatientInfo,
  PatientBannerToggleContactDetailsButton,
  PatientPhoto,
  showSnackbar,
  usePatient,
  useVisit,
  type Visit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './create-queue-entry.scss';
import { AddPatientToQueueContext } from './create-queue-entry.workspace';
import ExistingVisitFormComponent from './existing-visit-form/existing-visit-form.component';

interface CreateQueueEntryWorkspace2Props {
  selectedPatientUuid: string;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  activeVisit?: Visit;
  onBeforeQueueEntrySave?: (visit?: Visit) => boolean | Promise<boolean>;
  onQueueEntryAdded?: () => void | Promise<void>;
  startVisitWorkspaceName?: string;
  visitFormOpenedFrom?: string;
  patient?: fhir.Patient;
  requestedServiceName?: string;
  requiredVisitLocation?: {
    uuid: string;
    display: string;
  };
  requiredVisitTypeUuid?: string;
}

const defaultStartVisitWorkspaceName = 'queue-patient-search-start-visit-workspace';

const CreateQueueEntryWorkspace2: React.FC<Workspace2DefinitionProps<CreateQueueEntryWorkspace2Props>> = ({
  workspaceProps,
  launchChildWorkspace,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const {
    selectedPatientUuid,
    activeVisit: suppliedActiveVisit,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    onBeforeQueueEntrySave,
    onQueueEntryAdded,
    patient: searchedPatient,
    requestedServiceName,
    requiredVisitLocation,
    requiredVisitTypeUuid,
    startVisitWorkspaceName = defaultStartVisitWorkspaceName,
    visitFormOpenedFrom = 'service-queues-add-patient',
  } = workspaceProps ?? {};
  const { patient } = usePatient(selectedPatientUuid);
  const { activeVisit: fetchedActiveVisit, isLoading, error } = useVisit(selectedPatientUuid);
  const activeVisit = suppliedActiveVisit ?? fetchedActiveVisit;
  const [showContactDetails, setShowContactDetails] = useState(false);
  const hasLaunchedStartVisitWorkspace = useRef(false);

  const handleCloseWindow = useCallback(() => {
    void closeWorkspace({ closeWindow: true, discardUnsavedChanges: true });
  }, [closeWorkspace]);

  const handleQueueEntryAdded = useCallback(async () => {
    await onQueueEntryAdded?.();
  }, [onQueueEntryAdded]);

  const handleQueueEntryAddedAndClose = useCallback(async () => {
    await handleQueueEntryAdded();
    handleCloseWindow();
  }, [handleCloseWindow, handleQueueEntryAdded]);

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
      currentQueueLocationUuid,
      openedFrom: visitFormOpenedFrom,
      onBeforeVisitSave: onBeforeQueueEntrySave,
      patient: searchedPatient ?? patient,
      patientUuid: selectedPatientUuid,
      requestedServiceName,
      requiredVisitLocation,
      requiredVisitTypeUuid,
      workspaceTitle: t('addPatientToQueue', 'Add patient to queue'),
      onQueueEntryAdded: handleQueueEntryAddedAndClose,
    }).catch((launchError) => {
      hasLaunchedStartVisitWorkspace.current = false;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorAddingPatientToQueue', 'No se pudo agregar el paciente a la cola'),
        subtitle: getCompatibleUserFacingErrorMessage(
          launchError,
          t('queueEntryActionErrorMessage', 'No se pudo completar la acción de cola. Intente nuevamente.'),
          { logContext: 'Launch start visit workspace from service queues' },
          frameworkGetUserFacingErrorMessage,
        ),
      });
    });
  }, [
    activeVisit,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    error,
    handleQueueEntryAddedAndClose,
    isLoading,
    launchChildWorkspace,
    onBeforeQueueEntrySave,
    patient,
    searchedPatient,
    selectedPatientUuid,
    startVisitWorkspaceName,
    requestedServiceName,
    requiredVisitLocation,
    requiredVisitTypeUuid,
    t,
    visitFormOpenedFrom,
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
            <ExistingVisitFormComponent
              visit={activeVisit}
              closeWorkspace={handleCloseWindow}
              currentQueueLocationUuid={currentQueueLocationUuid}
              currentServiceQueueUuid={currentServiceQueueUuid}
              onBeforeQueueEntrySave={onBeforeQueueEntrySave}
              onQueueEntryAdded={handleQueueEntryAdded}
              requestedServiceName={requestedServiceName}
            />
          ) : (
            <DataTableSkeleton role="progressbar" />
          )}
        </AddPatientToQueueContext.Provider>
      </div>
    </Workspace2>
  );
};

export default CreateQueueEntryWorkspace2;
