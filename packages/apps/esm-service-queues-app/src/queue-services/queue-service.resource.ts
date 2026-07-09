import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { useConcept } from '../hooks/useConcept';
import { useSystemSetting } from '../hooks/useSystemSetting';

function useConfiguredConceptSet(systemSettingName: string) {
  const {
    systemSetting,
    error: systemSettingError,
    isLoading: isLoadingSystemSetting,
  } = useSystemSetting(systemSettingName);
  const { concept, error: conceptError, isLoading: isLoadingConcept } = useConcept(systemSetting?.value);

  return {
    conceptSet: concept,
    error: systemSettingError ?? conceptError,
    isLoading: isLoadingSystemSetting || isLoadingConcept,
  };
}

export function useServiceConcepts() {
  const { systemSetting: serviceConceptSetting } = useSystemSetting('queue.serviceConceptSetName');
  const { concept: serviceConceptSet, error, isLoading } = useConcept(serviceConceptSetting?.value);
  return {
    queueConcepts: serviceConceptSet?.setMembers?.slice().sort((c1, c2) => c1.display.localeCompare(c2.display)) || [],
    error,
    isLoading,
  };
}

export function useQueueConceptSets() {
  const {
    conceptSet: priorityConceptSet,
    error: priorityConceptSetError,
    isLoading: isLoadingPriorityConceptSet,
  } = useConfiguredConceptSet('queue.priorityConceptSetName');
  const {
    conceptSet: statusConceptSet,
    error: statusConceptSetError,
    isLoading: isLoadingStatusConceptSet,
  } = useConfiguredConceptSet('queue.statusConceptSetName');

  return {
    priorityConceptSet,
    statusConceptSet,
    error: priorityConceptSetError ?? statusConceptSetError,
    isLoading: isLoadingPriorityConceptSet || isLoadingStatusConceptSet,
  };
}

export function saveQueue(
  queueName: string,
  queueServiceType: string,
  queuePriorityConceptSet: string,
  queueStatusConceptSet: string,
  queueDescription?: string,
  queueLocation?: string,
) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      name: queueName,
      description: queueDescription,
      service: { uuid: queueServiceType },
      priorityConceptSet: { uuid: queuePriorityConceptSet },
      statusConceptSet: { uuid: queueStatusConceptSet },
      location: {
        uuid: queueLocation,
      },
    },
  });
}
