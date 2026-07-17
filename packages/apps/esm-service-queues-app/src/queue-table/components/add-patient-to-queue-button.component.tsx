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
  const { queues } = useQueues(selectedQueueLocationUuid);
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
  const selectedQueueUuid = useMemo(() => {
    if (!selectedServiceUuid) {
      return undefined;
    }

    const matchingQueues = queues.filter((queue) => queue.service?.uuid === selectedServiceUuid);
    return matchingQueues.length === 1 ? matchingQueues[0].uuid : undefined;
  }, [queues, selectedServiceUuid]);
  const isQueueLocationUnavailable =
    !selectedQueueLocationUuid || isLoadingQueueLocations || Boolean(queueLocationsError) || !selectedQueueLocation;

  return (
    <CanEditServiceQueues>
      <Button
        disabled={isQueueLocationUnavailable}
        title={isQueueLocationUnavailable ? t('selectQueueLocation', 'Select an available queue location') : undefined}
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
        {t('addPatientToQueue', 'Add patient to queue')}
      </Button>
    </CanEditServiceQueues>
  );
};

export default AddPatientToQueueButton;
