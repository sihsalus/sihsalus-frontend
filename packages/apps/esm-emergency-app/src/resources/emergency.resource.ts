import { getLocale, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import { type Config } from '../config-schema';
import { omrsDateFormat } from '../constants';
import { useServiceQueuesFilters } from '../utils/service-queues-integration';

/**
 * Represents a single patient entry in an emergency queue.
 * Fetched from `/ws/rest/v1/queue-entry` with a custom representation
 * that includes nested patient demographics, visit encounters, and priority details.
 */
export interface EmergencyQueueEntry {
  uuid: string;
  patient: {
    uuid: string;
    display: string;
    person?: {
      uuid: string;
      display: string;
      gender: string;
      age: number;
      birthdate: string;
      attributes?: Array<{
        attributeType?: {
          display?: string;
        };
        value?: string | { display?: string; uuid?: string };
      }>;
    };
    identifiers?: Array<{
      uuid: string;
      display: string;
      identifier: string;
      identifierType: {
        uuid: string;
        display: string;
      };
    }>;
  };
  priority: {
    uuid: string;
    display: string;
  };
  status: {
    uuid: string;
    display: string;
  };
  queue: {
    uuid: string;
    display: string;
    location?: {
      uuid: string;
      display: string;
    };
  };
  visit?: {
    uuid: string;
    display: string;
    startDatetime: string;
    encounters?: Array<{
      uuid: string;
      encounterType: {
        uuid: string;
        display: string;
      };
      voided: boolean;
    }>;
  };
  startedAt: string;
  sortWeight: number;
  previousQueueEntry?: { uuid: string } | null;
  providerWaitingFor?: { uuid: string; display: string } | null;
  locationWaitingFor?: { uuid: string; display: string } | null;
}

/**
 * Aggregated metrics computed client-side from queue entries.
 * Used by dashboard cards and alert components.
 */
export interface EmergencyMetrics {
  totalPatients: number;
  patientsByPriority: {
    priorityI: number;
    priorityII: number;
    priorityIII: number;
    priorityIV: number;
  };
  patientsWithoutTriage: number;
  averageWaitTime: {
    priorityI: number | null;
    priorityII: number | null;
    priorityIII: number | null;
    priorityIV: number | null;
    overall: number | null;
  };
}

interface EmergencyQueue {
  uuid: string;
  display: string;
  name?: string;
}

function useEmergencyQueues(locationUuid?: string) {
  const config = useConfig<Config>();
  const queueUrl = useMemo(() => {
    if (!locationUuid) {
      return null;
    }

    const params = new URLSearchParams();
    params.append('location', locationUuid);
    params.append('v', 'custom:(uuid,display,name)');
    params.append('limit', '100');

    return `${restBaseUrl}/queue?${params.toString()}`;
  }, [locationUuid]);

  const { data, error, isLoading } = useSWR<{ data: { results: Array<EmergencyQueue> } }, Error>(
    queueUrl,
    openmrsFetch,
    { refreshInterval: config.autoRefreshInterval },
  );

  return {
    queues: data?.data?.results ?? [],
    error,
    isLoading,
  };
}

/**
 * Hook to fetch emergency queue entries from the database
 * Uses the same endpoint as Service Queues with full custom representation
 *
 * @param serviceUuid - Optional service UUID to filter by
 * @param statusUuid - Optional status UUID to filter by
 * @param locationUuid - Optional location UUID to filter by (useful when integrated with service-queues-app)
 * @param queueUuid - Optional queue UUID to filter by (e.g., triage queue vs attention queue)
 */
export function useEmergencyQueueEntries(
  serviceUuid?: string,
  statusUuid?: string,
  locationUuid?: string,
  queueUuid?: string,
) {
  // If no explicit filters are provided, try to get them from the service-queues store.
  // This keeps the emergency table aligned with the standard service-queues header.
  const serviceQueuesFilters = useServiceQueuesFilters();
  const config = useConfig<Config>();

  const isValidUuid = useCallback((uuid?: string): boolean => {
    if (!uuid || uuid === 'all' || uuid === '') return false;
    // Basic UUID format validation (8-4-4-4-12 hex digits)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }, []);

  const resolveStoreBackedUuid = useCallback(
    (explicitUuid: string | undefined, storeUuid: string | undefined) => {
      if (explicitUuid !== undefined) {
        return isValidUuid(explicitUuid) ? explicitUuid : undefined;
      }

      return isValidUuid(storeUuid) ? storeUuid : undefined;
    },
    [isValidUuid],
  );

  // Priority: explicit param > service-queues store > config emergency location (standalone fallback)
  const actualLocationUuid = useMemo(
    () =>
      locationUuid ??
      serviceQueuesFilters.locationUuid ??
      config?.upssEmergencyLocationUuid ??
      config?.emergencyLocationUuid,
    [locationUuid, serviceQueuesFilters.locationUuid, config?.upssEmergencyLocationUuid, config?.emergencyLocationUuid],
  );

  const actualServiceUuid = useMemo(
    () => resolveStoreBackedUuid(serviceUuid, serviceQueuesFilters.serviceUuid),
    [resolveStoreBackedUuid, serviceQueuesFilters.serviceUuid, serviceUuid],
  );

  const actualStatusUuid = useMemo(() => {
    return resolveStoreBackedUuid(statusUuid, serviceQueuesFilters.statusUuid);
  }, [resolveStoreBackedUuid, serviceQueuesFilters.statusUuid, statusUuid]);

  const { queues: availableQueues, isLoading: isLoadingQueues } = useEmergencyQueues(actualLocationUuid);
  const actualQueueUuid = useMemo(() => {
    if (!queueUuid) {
      return undefined;
    }

    return availableQueues.some((queue) => queue.uuid === queueUuid) ? queueUuid : undefined;
  }, [availableQueues, queueUuid]);
  const shouldWaitForQueueValidation = Boolean(queueUuid && actualLocationUuid && isLoadingQueues);
  const shouldSkipMissingQueue = Boolean(queueUuid && actualLocationUuid && !isLoadingQueues && !actualQueueUuid);

  // Custom representation - same as Service Queues for full compatibility
  const customRepresentation =
    'custom:(uuid,display,queue:(uuid,display,location:(uuid,display)),status,patient:(uuid,display,person:(uuid,display,gender,age,birthdate,attributes:(attributeType:(display),value)),identifiers:(uuid,display,identifier,identifierType)),visit:(uuid,display,startDatetime,encounters:(uuid,display,diagnoses,encounterDatetime,encounterType,obs,encounterProviders,voided),attributes:(uuid,display,value,attributeType)),priority,priorityComment,sortWeight,startedAt,endedAt,locationWaitingFor,queueComingFrom,providerWaitingFor,previousQueueEntry)';

  const searchCriteria = {
    service: actualServiceUuid,
    isEnded: false,
    status: actualStatusUuid,
    location: actualLocationUuid,
    queue: actualQueueUuid,
  };

  const params = new URLSearchParams();
  // Add custom representation for full data
  params.append('v', customRepresentation);
  params.append('totalCount', 'true');

  // Add search criteria
  if (searchCriteria.service) params.append('service', searchCriteria.service);
  if (searchCriteria.status) params.append('status', searchCriteria.status);
  if (searchCriteria.location) params.append('location', searchCriteria.location);
  if (searchCriteria.queue) params.append('queue', searchCriteria.queue);
  params.append('isEnded', 'false');

  const url = `${restBaseUrl}/queue-entry?${params.toString()}`;

  // Include actualLocationUuid in SWR key to ensure cache updates when filters change
  // Note: actualStatusUuid is intentionally excluded to avoid cache issues when status is not used
  const swrKey = useMemo(() => {
    if (shouldWaitForQueueValidation || shouldSkipMissingQueue) {
      return null;
    }

    let key = actualLocationUuid ? `${url}&_location=${actualLocationUuid}` : url;
    if (actualServiceUuid) key += `&_service=${actualServiceUuid}`;
    if (actualStatusUuid) key += `&_status=${actualStatusUuid}`;
    if (actualQueueUuid) key += `&_queue=${actualQueueUuid}`;
    return key;
  }, [
    url,
    actualLocationUuid,
    actualServiceUuid,
    actualStatusUuid,
    actualQueueUuid,
    shouldWaitForQueueValidation,
    shouldSkipMissingQueue,
  ]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    { data: { results: Array<EmergencyQueueEntry>; totalCount: number } },
    Error
  >(swrKey, openmrsFetch, { refreshInterval: config.autoRefreshInterval });

  return {
    queueEntries: shouldSkipMissingQueue ? [] : data?.data?.results || [],
    totalCount: shouldSkipMissingQueue ? 0 : data?.data?.totalCount || 0,
    isLoading: isLoading || shouldWaitForQueueValidation,
    error,
    isValidating,
    mutate,
  };
}

/**
 * Hook to fetch emergency metrics
 * Aggregates data from queue entries
 *
 * @param serviceUuid - Optional service UUID to filter by
 * @param locationUuid - Optional location UUID to filter by
 * @param queueUuid - Optional queue UUID to filter by
 */
export function useEmergencyMetrics(serviceUuid?: string, locationUuid?: string, queueUuid?: string) {
  const { queueEntries, isLoading, error } = useEmergencyQueueEntries(serviceUuid, undefined, locationUuid, queueUuid);

  const metrics: EmergencyMetrics = {
    totalPatients: queueEntries.length,
    patientsByPriority: {
      priorityI: 0,
      priorityII: 0,
      priorityIII: 0,
      priorityIV: 0,
    },
    patientsWithoutTriage: 0,
    averageWaitTime: {
      priorityI: null,
      priorityII: null,
      priorityIII: null,
      priorityIV: null,
      overall: null,
    },
  };

  // Calculate patients by priority and waiting status
  const config = useConfig<Config>();
  queueEntries.forEach((entry) => {
    const priorityUuid = entry.priority?.uuid || '';
    if (priorityUuid === config.concepts.priorityIConceptUuid) {
      metrics.patientsByPriority.priorityI++;
    } else if (priorityUuid === config.concepts.priorityIIConceptUuid) {
      metrics.patientsByPriority.priorityII++;
    } else if (priorityUuid === config.concepts.priorityIIIConceptUuid) {
      metrics.patientsByPriority.priorityIII++;
    } else if (priorityUuid === config.concepts.priorityIVConceptUuid) {
      metrics.patientsByPriority.priorityIV++;
    }

    // Count patients waiting for triage: status = "waiting" AND in the triage queue
    if (
      entry.status?.uuid === config.queueStatuses.waitingUuid &&
      entry.queue?.uuid === config.emergencyTriageQueueUuid
    ) {
      metrics.patientsWithoutTriage++;
    }
  });

  // Calculate average wait times
  if (queueEntries.length > 0) {
    const now = dayjs();
    const waitTimes = queueEntries.map((entry) => {
      const startedAt = dayjs(entry.startedAt);
      return now.diff(startedAt, 'minute');
    });
    metrics.averageWaitTime.overall = Math.round(waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length);
  }

  return {
    metrics,
    isLoading,
    error,
  };
}

/**
 * Hook to get patients count by priority
 *
 * @param serviceUuid - Optional service UUID to filter by
 * @param locationUuid - Optional location UUID to filter by
 * @param queueUuid - Optional queue UUID to filter by
 */
export function usePatientsByPriority(serviceUuid?: string, locationUuid?: string, queueUuid?: string) {
  const { queueEntries, isLoading, error } = useEmergencyQueueEntries(serviceUuid, undefined, locationUuid, queueUuid);
  const config = useConfig<Config>();

  const counts = {
    priorityI: 0,
    priorityII: 0,
    priorityIII: 0,
    priorityIV: 0,
  };

  // Count patients by priority - usando UUID en lugar de label
  queueEntries.forEach((entry) => {
    const priorityUuid = entry.priority?.uuid || '';
    if (priorityUuid === config.concepts.priorityIConceptUuid) {
      counts.priorityI++;
    } else if (priorityUuid === config.concepts.priorityIIConceptUuid) {
      counts.priorityII++;
    } else if (priorityUuid === config.concepts.priorityIIIConceptUuid) {
      counts.priorityIII++;
    } else if (priorityUuid === config.concepts.priorityIVConceptUuid) {
      counts.priorityIV++;
    }
  });

  return {
    counts,
    isLoading,
    error,
  };
}

/**
 * Hook to get average wait time by priority
 *
 * @param serviceUuid - Optional service UUID to filter by
 * @param locationUuid - Optional location UUID to filter by
 * @param queueUuid - Optional queue UUID to filter by
 */
export function useAverageWaitTimeByPriority(serviceUuid?: string, locationUuid?: string, queueUuid?: string) {
  const { queueEntries, isLoading, error } = useEmergencyQueueEntries(serviceUuid, undefined, locationUuid, queueUuid);
  const config = useConfig<Config>();

  const now = dayjs();
  const waitTimesByPriority = {
    priorityI: [] as number[],
    priorityII: [] as number[],
    priorityIII: [] as number[],
    priorityIV: [] as number[],
  };

  queueEntries.forEach((entry) => {
    const startedAt = dayjs(entry.startedAt);
    const waitTime = now.diff(startedAt, 'minute');
    const priorityUuid = entry.priority?.uuid || '';

    if (priorityUuid === config.concepts.priorityIConceptUuid) {
      waitTimesByPriority.priorityI.push(waitTime);
    } else if (priorityUuid === config.concepts.priorityIIConceptUuid) {
      waitTimesByPriority.priorityII.push(waitTime);
    } else if (priorityUuid === config.concepts.priorityIIIConceptUuid) {
      waitTimesByPriority.priorityIII.push(waitTime);
    } else if (priorityUuid === config.concepts.priorityIVConceptUuid) {
      waitTimesByPriority.priorityIV.push(waitTime);
    }
  });

  const averages = {
    priorityI: waitTimesByPriority.priorityI.length
      ? Math.round(waitTimesByPriority.priorityI.reduce((a, b) => a + b, 0) / waitTimesByPriority.priorityI.length)
      : null,
    priorityII: waitTimesByPriority.priorityII.length
      ? Math.round(waitTimesByPriority.priorityII.reduce((a, b) => a + b, 0) / waitTimesByPriority.priorityII.length)
      : null,
    priorityIII: waitTimesByPriority.priorityIII.length
      ? Math.round(waitTimesByPriority.priorityIII.reduce((a, b) => a + b, 0) / waitTimesByPriority.priorityIII.length)
      : null,
    priorityIV: waitTimesByPriority.priorityIV.length
      ? Math.round(waitTimesByPriority.priorityIV.reduce((a, b) => a + b, 0) / waitTimesByPriority.priorityIV.length)
      : null,
    overall: queueEntries.length
      ? Math.round(
          queueEntries
            .map((entry) => now.diff(dayjs(entry.startedAt), 'minute'))
            .reduce((total, waitTime) => total + waitTime, 0) / queueEntries.length,
        )
      : null,
  };

  return {
    averages,
    isLoading,
    error,
  };
}

/**
 * Create a new emergency queue entry
 * @param patientUuid - UUID of the patient
 * @param visitUuid - UUID of the visit
 * @param priorityUuid - UUID of the priority concept
 * @param statusUuid - UUID of the status concept
 * @param queueUuid - UUID of the emergency queue
 * @param sortWeight - Sort weight for the priority (optional)
 * @returns Promise with the created queue entry
 */
export async function createEmergencyQueueEntry(
  patientUuid: string,
  visitUuid: string,
  priorityUuid: string,
  statusUuid: string,
  queueUuid: string,
  sortWeight?: number,
) {
  return openmrsFetch(`${restBaseUrl}/visit-queue-entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      visit: { uuid: visitUuid },
      queueEntry: {
        status: { uuid: statusUuid },
        priority: { uuid: priorityUuid },
        queue: { uuid: queueUuid },
        patient: { uuid: patientUuid },
        startedAt: dayjs().format(omrsDateFormat),
        sortWeight: sortWeight ?? 4,
      },
    },
  });
}

/**
 * Update an existing emergency queue entry
 * @param queueEntryUuid - UUID of the queue entry to update
 * @param updates - Partial updates to apply
 * @returns Promise with the updated queue entry
 */
export async function updateEmergencyQueueEntry(
  queueEntryUuid: string,
  updates: {
    priorityUuid?: string;
    statusUuid?: string;
    priorityComment?: string;
  },
) {
  const body: Record<string, unknown> = {};

  if (updates.priorityUuid) {
    body.priority = { uuid: updates.priorityUuid };
  }

  if (updates.statusUuid) {
    body.status = { uuid: updates.statusUuid };
  }

  if (updates.priorityComment) {
    body.priorityComment = updates.priorityComment;
  }

  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });
}

/**
 * End a queue entry (mark as ended)
 * @param queueEntryUuid - UUID of the queue entry to end
 * @returns Promise with the ended queue entry
 */
/**
 * Create a triage encounter with vital signs observations
 * @param patientUuid - UUID of the patient
 * @param visitUuid - UUID of the visit
 * @param locationUuid - UUID of the location
 * @param encounterTypeUuid - UUID of the triage encounter type
 * @param observations - Array of observations (concept + value)
 * @returns Promise with the created encounter
 */
export async function createTriageEncounter(
  patientUuid: string,
  visitUuid: string,
  locationUuid: string,
  encounterTypeUuid: string,
  observations: Array<{ concept: string; value: string | number }>,
) {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      patient: patientUuid,
      visit: visitUuid,
      encounterType: encounterTypeUuid,
      location: locationUuid,
      encounterDatetime: dayjs().format(omrsDateFormat),
      obs: observations.map((obs) => ({
        concept: obs.concept,
        value: obs.value,
      })),
    },
  });
}

/**
 * Transition a patient from triage queue to attention queue
 * using the Queue Module transition endpoint.
 *
 * @param currentQueueEntryUuid - UUID of the current queue entry to end
 * @param _patientUuid - UUID of the patient, kept for backward-compatible call sites
 * @param _visitUuid - UUID of the visit, kept for backward-compatible call sites
 * @param priorityUuid - UUID of the assigned priority (I-IV)
 * @param attentionQueueUuid - UUID of the attention queue
 * @param waitingStatusUuid - UUID of the "waiting" status
 * @param sortWeight - Sort weight for the priority
 */
export async function transitionToAttentionQueue(
  currentQueueEntryUuid: string,
  _patientUuid: string,
  _visitUuid: string,
  priorityUuid: string,
  attentionQueueUuid: string,
  waitingStatusUuid: string,
  _sortWeight: number,
) {
  return transitionEmergencyQueueEntry({
    queueEntryToTransition: currentQueueEntryUuid,
    newQueue: attentionQueueUuid,
    newPriority: priorityUuid,
    newStatus: waitingStatusUuid,
  });
}

export async function endEmergencyQueueEntry(queueEntryUuid: string) {
  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      endedAt: dayjs().format(omrsDateFormat),
    },
  });
}

/**
 * Transition a queue entry using the OpenMRS Queue Module transition endpoint.
 * This ends the current entry and creates a new one with the specified parameters.
 */
export async function transitionEmergencyQueueEntry(params: {
  queueEntryToTransition: string;
  newStatus?: string;
  newPriority?: string;
  newPriorityComment?: string;
  newQueue?: string;
  transitionDate?: string;
}) {
  return openmrsFetch(`${restBaseUrl}/queue-entry/transition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: params,
  });
}

// --- Queue list ---

export interface Queue {
  uuid: string;
  display: string;
  name: string;
  description: string;
  location: {
    uuid: string;
    display: string;
  };
  allowedPriorities: Array<{ uuid: string; display: string }>;
  allowedStatuses: Array<{ uuid: string; display: string }>;
}

export function useQueues(locationUuid?: string) {
  const customRepresentation =
    'custom:(uuid,display,name,description,location:(uuid,display),allowedPriorities:(uuid,display),allowedStatuses:(uuid,display))';
  const apiUrl = `${restBaseUrl}/queue?v=${customRepresentation}` + (locationUuid ? `&location=${locationUuid}` : '');

  const { data, ...rest } = useSWRImmutable<{ data: { results: Array<Queue> } }, Error>(apiUrl, openmrsFetch);

  const queues = useMemo(
    () => [...(data?.data?.results ?? [])].sort((a, b) => a.display.localeCompare(b.display, getLocale())),
    [data?.data?.results],
  );

  return { queues, ...rest };
}
