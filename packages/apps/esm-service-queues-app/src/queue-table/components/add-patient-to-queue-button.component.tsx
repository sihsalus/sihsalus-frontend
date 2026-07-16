import { Button } from '@carbon/react';
import { AddIcon, launchWorkspace2, useLocations, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { serviceQueuesPatientSearchWorkspace, serviceQueuesStartVisitWorkspace } from '../../constants';
import { CanEditServiceQueues } from '../../permissions';
import { useServiceQueuesStore } from '../../store/store';

const AddPatientToQueueButton: React.FC = () => {
  const { t } = useTranslation();
  const { selectedQueueLocationName, selectedQueueLocationUuid, selectedServiceUuid } = useServiceQueuesStore();
  const visitLocations = useLocations('Visit Location');
  const selectedVisitLocation = visitLocations?.find((location) => location.uuid === selectedQueueLocationUuid);
  const requiredVisitLocation = selectedVisitLocation
    ? {
        uuid: selectedVisitLocation.uuid,
        display: selectedVisitLocation.display ?? selectedQueueLocationName ?? selectedVisitLocation.uuid,
      }
    : undefined;

  return (
    <CanEditServiceQueues>
      <Button
        disabled={!requiredVisitLocation}
        title={
          requiredVisitLocation
            ? undefined
            : t('selectOperationalQueueLocation', 'Select an operational visit location before adding a patient')
        }
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
                  currentServiceQueueUuid: selectedServiceUuid,
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
                currentServiceQueueUuid: selectedServiceUuid,
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
