import { Button } from '@carbon/react';
import { AddIcon, launchWorkspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceQueuesPatientSearchWorkspace, serviceQueuesStartVisitWorkspace } from '../../constants';
import { isVisitLocation, useQueueLocations } from '../../create-queue-entry/hooks/useQueueLocations';
import { useQueues } from '../../hooks/useQueues';
import { CanEditServiceQueues } from '../../permissions';
import { useServiceQueuesStore } from '../../store/store';

const AddPatientToQueueButton: React.FC = () => {
  const { t } = useTranslation();
  const { selectedQueueLocationName, selectedQueueLocationUuid, selectedServiceUuid } = useServiceQueuesStore();
  const { queueLocations, isLoading: isLoadingQueueLocations, error: queueLocationsError } = useQueueLocations();
  const { queues, isLoading: isLoadingQueues, error: queuesError } = useQueues(selectedQueueLocationUuid);
  const selectedQueueLocation = selectedQueueLocationUuid
    ? queueLocations.find((location) => location.id === selectedQueueLocationUuid)
    : undefined;
  const selectedQueueLocationIsVisitLocation = selectedQueueLocation ? isVisitLocation(selectedQueueLocation) : false;
  const requiredVisitLocation =
    selectedQueueLocationUuid && selectedQueueLocationIsVisitLocation
      ? {
          uuid: selectedQueueLocationUuid,
          display: selectedQueueLocation?.name ?? selectedQueueLocationName ?? selectedQueueLocationUuid,
        }
      : undefined;
  const matchingQueues = useMemo(() => {
    if (!selectedServiceUuid) {
      return [];
    }

    return queues.filter((queue) => queue.service?.uuid === selectedServiceUuid);
  }, [queues, selectedServiceUuid]);
  const selectedQueueUuid = matchingQueues.length === 1 ? matchingQueues[0].uuid : undefined;
  const isResolvingQueueContext = isLoadingQueueLocations || (Boolean(selectedServiceUuid) && Boolean(isLoadingQueues));
  const queueContextError = queueLocationsError ?? (selectedServiceUuid ? queuesError : undefined);
  const isQueueLocationUnavailable = !selectedQueueLocationUuid || !selectedQueueLocation;
  const isSelectedServiceUnavailable =
    Boolean(selectedServiceUuid) && !isLoadingQueues && !queuesError && matchingQueues.length === 0;
  const isDisabled =
    isResolvingQueueContext || Boolean(queueContextError) || isQueueLocationUnavailable || isSelectedServiceUnavailable;
  const disabledReason = isResolvingQueueContext
    ? t('loadingQueueContext', 'Loading queues…')
    : queueContextError
      ? t('queueContextUnavailable', 'Queues are temporarily unavailable')
      : isSelectedServiceUnavailable
        ? t('selectedServiceUnavailable', 'The selected service is not available at this UPSS')
        : isQueueLocationUnavailable
          ? t('selectQueueLocation', 'Select an available queue UPSS')
          : undefined;
  const buttonLabel = disabledReason ?? t('addPatientToQueue', 'Add patient to queue');

  return (
    <CanEditServiceQueues>
      <Button
        aria-busy={isResolvingQueueContext}
        aria-label={buttonLabel}
        disabled={isDisabled}
        title={disabledReason}
        kind="primary"
        renderIcon={(props) => <AddIcon size={16} {...props} />}
        size="sm"
        onClick={() =>
          launchWorkspace2(
            'queue-patient-search-workspace',
            {
              initialQuery: '',
              workspaceTitle: t('addPatientToQueue', 'Add patient to queue'),
              onPatientSelected(
                patientUuid: string,
                patient: fhir.Patient,
                launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
                _closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
              ) {
                launchChildWorkspace(serviceQueuesPatientSearchWorkspace, {
                  currentQueueLocationUuid: selectedQueueLocationUuid,
                  currentServiceQueueUuid: selectedQueueUuid,
                  patient,
                  requiredVisitLocation,
                  selectedPatientUuid: patientUuid,
                });
              },
            },
            {
              startVisitWorkspaceName: serviceQueuesStartVisitWorkspace,
              startVisitWorkspaceProps: {
                currentQueueLocationUuid: selectedQueueLocationUuid,
                currentServiceQueueUuid: selectedQueueUuid,
                openedFrom: 'service-queues-add-patient',
                requiredVisitLocation,
                workspaceTitle: t('addPatientToQueue', 'Add patient to queue'),
              },
            },
          )
        }
      >
        {buttonLabel}
      </Button>
    </CanEditServiceQueues>
  );
};

export default AddPatientToQueueButton;
