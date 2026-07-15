import { Button } from '@carbon/react';
import { AddIcon, launchWorkspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { serviceQueuesPatientSearchWorkspace, serviceQueuesStartVisitWorkspace } from '../../constants';
import { CanEditServiceQueues } from '../../permissions';
import { useServiceQueuesStore } from '../../store/store';

const AddPatientToQueueButton: React.FC = () => {
  const { t } = useTranslation();
  const { selectedServiceUuid } = useServiceQueuesStore();

  return (
    <CanEditServiceQueues>
      <Button
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
                  currentServiceQueueUuid: selectedServiceUuid,
                  patient,
                  selectedPatientUuid: patientUuid,
                });
              },
            },
            {
              startVisitWorkspaceName: serviceQueuesStartVisitWorkspace,
              startVisitWorkspaceProps: {
                currentServiceQueueUuid: selectedServiceUuid,
                openedFrom: 'service-queues-add-patient',
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
