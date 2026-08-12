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
  useSession,
  useVisit,
  type Visit,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  serviceQueuesCompanionPersonRegistrationWorkspace,
  serviceQueuesCompanionPersonSearchWorkspace,
} from '../constants';
import { canStartQueueVisit, hasQueueCompanionCapability } from '../permissions';
import styles from './create-queue-entry.scss';
import { AddPatientToQueueContext } from './create-queue-entry.workspace';
import ExistingVisitFormComponent from './existing-visit-form/existing-visit-form.component';
import QueueOnlyForm from './queue-only-form/queue-only-form.component';
import QueueVisitStartPreflightNotice from './queue-visit-start-preflight.component';
import { getQueueVisitStartPreflightState } from './queue-visit-start-preflight';

interface CreateQueueEntryWorkspace2Props {
  selectedPatientUuid: string;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  companionPersonSearchWorkspaceName?: string;
  companionPersonRegistrationWorkspaceName?: string;
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
type StartVisitLaunchState = 'idle' | 'launching' | 'recovery-required';

const CreateQueueEntryWorkspace2: React.FC<Workspace2DefinitionProps<CreateQueueEntryWorkspace2Props>> = ({
  workspaceProps,
  launchChildWorkspace,
  closeWorkspace,
  isLeafWorkspace = true,
}) => {
  const { t } = useTranslation();
  const {
    selectedPatientUuid,
    activeVisit: suppliedActiveVisit,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    companionPersonSearchWorkspaceName = serviceQueuesCompanionPersonSearchWorkspace,
    companionPersonRegistrationWorkspaceName = serviceQueuesCompanionPersonRegistrationWorkspace,
    onBeforeQueueEntrySave,
    onQueueEntryAdded,
    patient: searchedPatient,
    requestedServiceName,
    requiredVisitLocation,
    requiredVisitTypeUuid,
    startVisitWorkspaceName = defaultStartVisitWorkspaceName,
    visitFormOpenedFrom = 'service-queues-add-patient',
  } = workspaceProps ?? {};
  const session = useSession();
  const { patient, isLoading: isLoadingPatient, error: patientError } = usePatient(selectedPatientUuid);
  const { activeVisit: fetchedActiveVisit, isLoading, error } = useVisit(selectedPatientUuid);
  const activeVisit = suppliedActiveVisit ?? fetchedActiveVisit;
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [startVisitLaunchState, setStartVisitLaunchState] = useState<StartVisitLaunchState>('idle');
  const hasLaunchedStartVisitWorkspace = useRef(false);
  const startVisitChildWasOpened = useRef(false);

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

  const handleRetryStartVisitLaunch = useCallback(() => {
    hasLaunchedStartVisitWorkspace.current = false;
    startVisitChildWasOpened.current = false;
    setStartVisitLaunchState('idle');
  }, []);

  const needsNewVisit = Boolean(selectedPatientUuid && !isLoading && !error && !activeVisit && requiredVisitLocation);
  const startVisitPreflightState = getQueueVisitStartPreflightState({
    birthDate: patient?.birthDate,
    canStartVisit: canStartQueueVisit(session?.user),
    hasCompanionCapability: hasQueueCompanionCapability(session?.user),
    needsNewVisit,
    patientError,
    patientIsLoading: isLoadingPatient,
  });

  useEffect(() => {
    if (startVisitLaunchState !== 'launching') {
      return;
    }

    if (!isLeafWorkspace) {
      startVisitChildWasOpened.current = true;
      return;
    }

    if (startVisitChildWasOpened.current) {
      hasLaunchedStartVisitWorkspace.current = false;
      startVisitChildWasOpened.current = false;
      setStartVisitLaunchState('recovery-required');
    }
  }, [isLeafWorkspace, startVisitLaunchState]);

  useEffect(() => {
    if (
      !selectedPatientUuid ||
      isLoading ||
      error ||
      activeVisit ||
      !requiredVisitLocation ||
      startVisitPreflightState !== 'ready' ||
      startVisitLaunchState !== 'idle' ||
      hasLaunchedStartVisitWorkspace.current
    ) {
      return;
    }

    hasLaunchedStartVisitWorkspace.current = true;
    setStartVisitLaunchState('launching');

    void launchChildWorkspace(startVisitWorkspaceName, {
      currentServiceQueueUuid,
      currentQueueLocationUuid,
      companionPersonSearchWorkspaceName,
      companionPersonRegistrationWorkspaceName,
      openedFrom: visitFormOpenedFrom,
      onBeforeVisitSave: onBeforeQueueEntrySave,
      patient: searchedPatient ?? patient,
      patientUuid: selectedPatientUuid,
      requestedServiceName,
      requiredVisitLocation,
      requiredVisitTypeUuid,
      workspaceTitle: t('addPatientToQueue', 'Add patient to queue'),
      onQueueEntryAdded: handleQueueEntryAddedAndClose,
    })
      .then((workspaceOpened) => {
        if (!workspaceOpened) {
          hasLaunchedStartVisitWorkspace.current = false;
          setStartVisitLaunchState('recovery-required');
        }
      })
      .catch((launchError) => {
        hasLaunchedStartVisitWorkspace.current = false;
        setStartVisitLaunchState('recovery-required');
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
    companionPersonRegistrationWorkspaceName,
    companionPersonSearchWorkspaceName,
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
    startVisitPreflightState,
    startVisitLaunchState,
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
        <AddPatientToQueueContext.Provider value={{ currentQueueLocationUuid, currentServiceQueueUuid }}>
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
          ) : requiredVisitLocation ? (
            startVisitPreflightState === 'ready' ? (
              startVisitLaunchState === 'recovery-required' ? (
                <QueueVisitStartPreflightNotice
                  state="workspace-launch-recovery"
                  onRetry={handleRetryStartVisitLaunch}
                />
              ) : (
                <DataTableSkeleton role="progressbar" />
              )
            ) : startVisitPreflightState === 'not-required' ? null : (
              <QueueVisitStartPreflightNotice state={startVisitPreflightState} />
            )
          ) : (
            <QueueOnlyForm
              closeWorkspace={handleCloseWindow}
              currentQueueLocationUuid={currentQueueLocationUuid}
              currentServiceQueueUuid={currentServiceQueueUuid}
              onBeforeQueueEntrySave={() => onBeforeQueueEntrySave?.() ?? true}
              onQueueEntryAdded={handleQueueEntryAdded}
              patientUuid={selectedPatientUuid}
              requestedServiceName={requestedServiceName}
            />
          )}
        </AddPatientToQueueContext.Provider>
      </div>
    </Workspace2>
  );
};

export default CreateQueueEntryWorkspace2;
