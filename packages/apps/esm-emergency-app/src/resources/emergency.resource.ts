import { type FetchResponse, getLocale, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRImmutable from 'swr/immutable';
import { type Config } from '../config-schema';
import { omrsDateFormat } from '../constants';
import { useServiceQueuesFilters } from '../utils/service-queues-integration';

/**
 * Revalidates every queue-entry-related SWR key — both the emergency hooks and
 * the standard service-queues hooks — and dispatches the same
 * `queue-entry-updated` CustomEvent that service-queues' useMutateQueueEntries
 * emits, so tables in both apps refresh regardless of which one made the change.
 */
export function useMutateEmergencyQueueEntries() {
  const { mutate } = useSWRConfig();

  const mutateEmergencyQueueEntries = useCallback(async () => {
    await mutate(
      (key) =>
        typeof key === 'string' &&
        (key.includes(`${restBaseUrl}/queue-entry`) || key.includes(`${restBaseUrl}/visit-queue-entry`)),
    );
    globalThis.dispatchEvent(new CustomEvent('queue-entry-updated'));
  }, [mutate]);

  return { mutateEmergencyQueueEntries };
}

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

  // Refresh when the standard service-queues tables announce a change, so a
  // transition made from either app is reflected in both.
  useEffect(() => {
    const listener = () => {
      void mutate();
    };
    globalThis.addEventListener('queue-entry-updated', listener);
    return () => globalThis.removeEventListener('queue-entry-updated', listener);
  }, [mutate]);

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
export const EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED = 'EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED';
export const EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE = 'EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE';
export const EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT = 'EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT';
export const EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS = 'EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS';
export const EMERGENCY_QUEUE_ENTRY_SEARCH_STALLED = 'EMERGENCY_QUEUE_ENTRY_SEARCH_STALLED';

interface EmergencyQueueEntryCreationRequest {
  patientUuid: string;
  visitUuid: string;
  priorityUuid: string;
  statusUuid: string;
  queueUuid: string;
  sortWeight: number;
}

interface PendingEmergencyQueueCreation {
  signature: string;
  promise: Promise<FetchResponse<QueueEntryState>>;
}

const pendingEmergencyQueueCreations = new Map<string, PendingEmergencyQueueCreation>();

function queueEntryMatchesCreation(entry: QueueEntryState, request: EmergencyQueueEntryCreationRequest) {
  return (
    entry.patient?.uuid === request.patientUuid &&
    entry.visit?.uuid === request.visitUuid &&
    entry.queue?.uuid === request.queueUuid &&
    entry.status?.uuid === request.statusUuid &&
    entry.priority?.uuid === request.priorityUuid &&
    entry.sortWeight === request.sortWeight
  );
}

async function findActiveEmergencyQueueEntriesForVisit(
  visitUuid: string,
): Promise<FetchResponse<Array<QueueEntryState>>> {
  const pageSize = 100;
  const entriesByUuid = new Map<string, QueueEntryState>();
  let firstResponse: FetchResponse<QueueEntrySearchResponse> | null = null;

  for (let startIndex = 0; ; startIndex += pageSize) {
    const searchParams = new URLSearchParams({
      visit: visitUuid,
      isEnded: 'false',
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: emergencyQueueEntryStateRepresentation,
    });
    const response = await openmrsFetch<QueueEntrySearchResponse>(
      `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
    );
    firstResponse ??= response;
    const page = (response.data?.results ?? []).filter((entry) => !entry.endedAt);
    if (page.some((entry) => !entry.uuid)) {
      throw emergencyQueueEntryError(
        EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE,
        'An active emergency queue entry did not include a UUID.',
      );
    }
    let newEntryCount = 0;
    page.forEach((entry) => {
      if (entry.uuid && !entriesByUuid.has(entry.uuid)) {
        entriesByUuid.set(entry.uuid, entry);
        newEntryCount += 1;
      }
    });

    // More than one unique active entry already proves ambiguity; no later
    // page can restore the one-active-entry invariant.
    if (entriesByUuid.size > 1 || page.length < pageSize) {
      return {
        ...firstResponse,
        data: [...entriesByUuid.values()],
      } as FetchResponse<Array<QueueEntryState>>;
    }
    if (newEntryCount === 0) {
      throw emergencyQueueEntryError(
        EMERGENCY_QUEUE_ENTRY_SEARCH_STALLED,
        'Emergency queue entry pagination did not advance.',
      );
    }
  }
}

function resolveEmergencyQueueCreation(
  response: FetchResponse<Array<QueueEntryState>>,
  request: EmergencyQueueEntryCreationRequest,
): FetchResponse<QueueEntryState> | null {
  if (response.data.length > 1) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS,
      'The emergency visit has multiple active queue entries.',
    );
  }
  const entry = response.data[0];
  if (!entry) {
    return null;
  }
  if (!entry.uuid) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE,
      'The active emergency queue entry did not include a UUID.',
    );
  }
  if (!queueEntryMatchesCreation(entry, request)) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT,
      'The emergency visit already has a conflicting active queue entry.',
    );
  }
  return { ...response, data: entry } as FetchResponse<QueueEntryState>;
}

async function createEmergencyQueueEntryOnce(
  request: EmergencyQueueEntryCreationRequest,
): Promise<FetchResponse<QueueEntryState>> {
  const existingResponse = await findActiveEmergencyQueueEntriesForVisit(request.visitUuid);
  const existingEntry = resolveEmergencyQueueCreation(existingResponse, request);
  if (existingEntry) {
    await assertQueueEntryPatientIsAlive(existingEntry.data);
    return existingEntry;
  }

  // Keep the authoritative assertion adjacent to the operational write after
  // all idempotency reads have completed.
  await assertFreshPatientIsAlive(request.patientUuid);
  let writeResponse: FetchResponse<QueueEntryState>;
  try {
    writeResponse = await openmrsFetch<QueueEntryState>(`${restBaseUrl}/visit-queue-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        visit: { uuid: request.visitUuid },
        queueEntry: {
          status: { uuid: request.statusUuid },
          priority: { uuid: request.priorityUuid },
          queue: { uuid: request.queueUuid },
          patient: { uuid: request.patientUuid },
          startedAt: dayjs().format(omrsDateFormat),
          sortWeight: request.sortWeight,
        },
      },
    });
  } catch (error) {
    try {
      const currentResponse = await findActiveEmergencyQueueEntriesForVisit(request.visitUuid);
      const reconciledEntry = resolveEmergencyQueueCreation(currentResponse, request);
      if (reconciledEntry) {
        await assertQueueEntryPatientIsAlive(reconciledEntry.data);
        return reconciledEntry;
      }
    } catch (reconciliationError) {
      const code = (reconciliationError as { code?: string })?.code;
      if (
        code === EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS ||
        code === EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT ||
        code === EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE ||
        code === DECEASED_PATIENT_OPERATION_BLOCKED ||
        code === PATIENT_VITAL_STATUS_UNAVAILABLE
      ) {
        throw reconciliationError;
      }
      // Preserve the original write error if reconciliation itself is unavailable.
    }
    throw error;
  }

  const currentResponse = await findActiveEmergencyQueueEntriesForVisit(request.visitUuid);
  const createdEntry = resolveEmergencyQueueCreation(currentResponse, request);
  const responseEntryUuid = writeResponse.data?.uuid;
  if (!createdEntry || (responseEntryUuid && createdEntry.data.uuid !== responseEntryUuid)) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED,
      'The emergency queue entry creation could not be verified.',
    );
  }
  return { ...writeResponse, data: createdEntry.data } as FetchResponse<QueueEntryState>;
}

export function createEmergencyQueueEntry(
  patientUuid: string,
  visitUuid: string,
  priorityUuid: string,
  statusUuid: string,
  queueUuid: string,
  sortWeight?: number,
) {
  const request: EmergencyQueueEntryCreationRequest = {
    patientUuid,
    visitUuid,
    priorityUuid,
    statusUuid,
    queueUuid,
    sortWeight: sortWeight ?? 4,
  };
  const signature = JSON.stringify(request);
  const pending = pendingEmergencyQueueCreations.get(visitUuid);
  if (pending?.signature === signature) {
    return pending.promise;
  }
  if (pending) {
    return pending.promise.then(
      () => createEmergencyQueueEntry(patientUuid, visitUuid, priorityUuid, statusUuid, queueUuid, sortWeight),
      () => createEmergencyQueueEntry(patientUuid, visitUuid, priorityUuid, statusUuid, queueUuid, sortWeight),
    );
  }

  let trackedPromise: Promise<FetchResponse<QueueEntryState>>;
  trackedPromise = createEmergencyQueueEntryOnce(request).finally(() => {
    if (pendingEmergencyQueueCreations.get(visitUuid)?.promise === trackedPromise) {
      pendingEmergencyQueueCreations.delete(visitUuid);
    }
  });
  pendingEmergencyQueueCreations.set(visitUuid, { signature, promise: trackedPromise });
  return trackedPromise;
}

/**
 * Update an existing emergency queue entry
 * @param queueEntryUuid - UUID of the queue entry to update
 * @param updates - Partial updates to apply
 * @returns Promise with the updated queue entry
 */
interface QueueEntryState {
  uuid: string;
  startedAt?: string | null;
  status?: { uuid: string };
  priority?: { uuid: string };
  priorityComment?: string | null;
  queue?: { uuid: string };
  patient?: { uuid?: string | null };
  visit?: { uuid?: string | null } | null;
  queueComingFrom?: { uuid?: string | null } | null;
  sortWeight?: number | null;
  endedAt?: string | null;
}

interface QueueEntrySearchResponse {
  results?: Array<QueueEntryState>;
}

export const EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE = 'EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE';
export const EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED = 'EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED';
export const EMERGENCY_QUEUE_ENTRY_UPDATE_UNVERIFIED = 'EMERGENCY_QUEUE_ENTRY_UPDATE_UNVERIFIED';
export const EMERGENCY_QUEUE_ENTRY_TRANSITION_UNVERIFIED = 'EMERGENCY_QUEUE_ENTRY_TRANSITION_UNVERIFIED';
export const EMERGENCY_QUEUE_ENTRY_RECONCILIATION_STALLED = 'EMERGENCY_QUEUE_ENTRY_RECONCILIATION_STALLED';
export const EMERGENCY_QUEUE_ENTRY_CLOSE_UNVERIFIED = 'EMERGENCY_QUEUE_ENTRY_CLOSE_UNVERIFIED';
export const EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT = 'EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT';

const emergencyQueueEntryStateRepresentation =
  'custom:(uuid,startedAt,endedAt,status:(uuid),priority:(uuid),priorityComment,queue:(uuid),patient:(uuid),visit:(uuid),queueComingFrom:(uuid),sortWeight)';

function emergencyQueueEntryError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

/**
 * Re-reads the queue entry and its patient instead of trusting a table row or
 * modal payload that may have become stale.
 */
async function fetchQueueEntryState(queueEntryUuid: string): Promise<FetchResponse<QueueEntryState>> {
  const searchParams = new URLSearchParams({ v: emergencyQueueEntryStateRepresentation });
  return openmrsFetch<QueueEntryState>(`${restBaseUrl}/queue-entry/${queueEntryUuid}?${searchParams.toString()}`);
}

async function assertQueueEntryPatientIsAlive(queueEntry: QueueEntryState) {
  const patientUuid = queueEntry.patient?.uuid;
  if (!patientUuid) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE,
      'The emergency queue entry patient could not be verified.',
    );
  }

  return assertFreshPatientIsAlive(patientUuid);
}

function queueEntryMatchesUpdate(
  queueEntry: QueueEntryState,
  updates: { priorityUuid?: string; statusUuid?: string; priorityComment?: string },
) {
  return (
    (!updates.statusUuid || queueEntry.status?.uuid === updates.statusUuid) &&
    (!updates.priorityUuid || queueEntry.priority?.uuid === updates.priorityUuid) &&
    (!updates.priorityComment || queueEntry.priorityComment === updates.priorityComment)
  );
}

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

  const freshResponse = await fetchQueueEntryState(queueEntryUuid);
  if (freshResponse.data.endedAt) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED,
      'Cannot update an emergency queue entry that has already ended.',
    );
  }
  await assertQueueEntryPatientIsAlive(freshResponse.data);

  let response: FetchResponse;
  try {
    response = await openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
  } catch (error) {
    let current: FetchResponse<QueueEntryState>;
    try {
      current = await fetchQueueEntryState(queueEntryUuid);
    } catch {
      throw error;
    }
    if (!current.data.endedAt && queueEntryMatchesUpdate(current.data, updates)) {
      await assertQueueEntryPatientIsAlive(current.data);
      return null;
    }
    throw error;
  }

  const current = await fetchQueueEntryState(queueEntryUuid);
  if (current.data.endedAt || !queueEntryMatchesUpdate(current.data, updates)) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_UPDATE_UNVERIFIED,
      'The emergency queue entry update could not be verified.',
    );
  }
  return response;
}

/**
 * End a queue entry (mark as ended)
 * @param queueEntryUuid - UUID of the queue entry to end
 * @returns Promise with the ended queue entry
 */
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
  const freshResponse = await fetchQueueEntryState(queueEntryUuid);
  if (freshResponse.data.endedAt) {
    if (await findAnyEmergencyQueueTransitionSuccessor(freshResponse.data)) {
      throw emergencyQueueEntryError(
        EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
        'The emergency queue entry was transitioned by another user.',
      );
    }
    return freshResponse;
  }

  const responseDate = freshResponse.headers?.get?.('Date');
  const parsedResponseDate = responseDate ? new Date(responseDate) : null;
  const serverDate =
    parsedResponseDate && !Number.isNaN(parsedResponseDate.valueOf()) ? parsedResponseDate : new Date();
  const startedAt = freshResponse.data.startedAt ? new Date(freshResponse.data.startedAt) : null;
  const endedAt =
    startedAt && !Number.isNaN(startedAt.valueOf()) && startedAt > serverDate ? startedAt : serverDate;

  try {
    await openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        endedAt: dayjs(endedAt).format(omrsDateFormat),
      },
    });
  } catch (error) {
    let current: FetchResponse<QueueEntryState>;
    try {
      current = await fetchQueueEntryState(queueEntryUuid);
    } catch {
      // Preserve the original write error when its outcome cannot be verified.
      throw error;
    }
    if (!current.data.endedAt) {
      throw error;
    }
    if (await findAnyEmergencyQueueTransitionSuccessor(current.data)) {
      throw emergencyQueueEntryError(
        EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
        'The emergency queue entry was transitioned by another user.',
      );
    }
    return current;
  }

  const current = await fetchQueueEntryState(queueEntryUuid);
  if (!current.data.endedAt) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_CLOSE_UNVERIFIED,
      'The emergency queue entry close could not be verified.',
    );
  }
  if (await findAnyEmergencyQueueTransitionSuccessor(current.data)) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
      'The emergency queue entry was transitioned by another user.',
    );
  }
  return current;
}

interface EmergencyQueueTransitionParams {
  queueEntryToTransition: string;
  newStatus?: string;
  newPriority?: string;
  newPriorityComment?: string;
  newQueue?: string;
  transitionDate?: string;
}

function isSameQueueEntrySubject(candidate: QueueEntryState, source: QueueEntryState) {
  if (source.visit?.uuid) {
    return candidate.visit?.uuid === source.visit.uuid;
  }
  return !candidate.visit?.uuid && Boolean(source.patient?.uuid) && candidate.patient?.uuid === source.patient.uuid;
}

function queueEntryMatchesTransition(
  candidate: QueueEntryState,
  source: QueueEntryState,
  params: EmergencyQueueTransitionParams,
) {
  const sourceEndedAt = source.endedAt ? new Date(source.endedAt).valueOf() : Number.NaN;
  const candidateStartedAt = candidate.startedAt ? new Date(candidate.startedAt).valueOf() : Number.NaN;

  return (
    candidate.uuid !== source.uuid &&
    Number.isFinite(sourceEndedAt) &&
    candidateStartedAt === sourceEndedAt &&
    isSameQueueEntrySubject(candidate, source) &&
    candidate.queueComingFrom?.uuid === source.queue?.uuid &&
    candidate.queue?.uuid === (params.newQueue ?? source.queue?.uuid) &&
    candidate.status?.uuid === (params.newStatus ?? source.status?.uuid) &&
    candidate.priority?.uuid === (params.newPriority ?? source.priority?.uuid) &&
    (candidate.priorityComment ?? '') === (params.newPriorityComment ?? source.priorityComment ?? '')
  );
}

function isPossibleDirectTransitionSuccessor(candidate: QueueEntryState, source: QueueEntryState) {
  const sourceEndedAt = source.endedAt ? new Date(source.endedAt).valueOf() : Number.NaN;
  const candidateStartedAt = candidate.startedAt ? new Date(candidate.startedAt).valueOf() : Number.NaN;

  return (
    candidate.uuid !== source.uuid &&
    isSameQueueEntrySubject(candidate, source) &&
    candidate.queueComingFrom?.uuid === source.queue?.uuid &&
    Number.isFinite(sourceEndedAt) &&
    Number.isFinite(candidateStartedAt) &&
    candidateStartedAt === sourceEndedAt
  );
}

async function findEmergencyQueueSuccessor(
  source: QueueEntryState,
  matches: (candidate: QueueEntryState) => boolean,
): Promise<FetchResponse<QueueEntryState> | null> {
  const subject = source.visit?.uuid
    ? { visit: source.visit.uuid }
    : source.patient?.uuid
      ? { patient: source.patient.uuid }
      : null;
  if (!source.endedAt || !source.queue?.uuid || !subject) {
    return null;
  }

  const pageSize = 100;
  const seenEntries = new Set<string>();
  for (let startIndex = 0; ; startIndex += pageSize) {
    const searchParams = new URLSearchParams({
      ...subject,
      queueComingFrom: source.queue.uuid,
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: emergencyQueueEntryStateRepresentation,
    });
    const response = await openmrsFetch<QueueEntrySearchResponse>(
      `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
    );
    const page = response.data?.results ?? [];
    const matchingEntry = page.find(matches);
    if (matchingEntry) {
      return { ...response, data: matchingEntry } as FetchResponse<QueueEntryState>;
    }

    let newEntryCount = 0;
    page.forEach((entry) => {
      if (!seenEntries.has(entry.uuid)) {
        seenEntries.add(entry.uuid);
        newEntryCount += 1;
      }
    });
    if (page.length < pageSize) {
      return null;
    }
    if (newEntryCount === 0) {
      throw emergencyQueueEntryError(
        EMERGENCY_QUEUE_ENTRY_RECONCILIATION_STALLED,
        'Emergency queue transition reconciliation did not advance.',
      );
    }
  }
}

function findAnyEmergencyQueueTransitionSuccessor(source: QueueEntryState) {
  return findEmergencyQueueSuccessor(source, (candidate) => isPossibleDirectTransitionSuccessor(candidate, source));
}

/** Finds the exact successor requested by this transition, across capped result pages. */
async function findEmergencyQueueTransitionSuccessor(
  source: QueueEntryState,
  params: EmergencyQueueTransitionParams,
): Promise<FetchResponse<QueueEntryState> | null> {
  return findEmergencyQueueSuccessor(source, (candidate) => queueEntryMatchesTransition(candidate, source, params));
}

/**
 * Transition a queue entry using the OpenMRS Queue Module transition endpoint.
 * This ends the current entry and creates a new one with the specified parameters.
 */
export async function transitionEmergencyQueueEntry(params: EmergencyQueueTransitionParams) {
  const freshResponse = await fetchQueueEntryState(params.queueEntryToTransition);
  await assertQueueEntryPatientIsAlive(freshResponse.data);

  if (freshResponse.data.endedAt) {
    const existingSuccessor = await findEmergencyQueueTransitionSuccessor(freshResponse.data, params);
    if (existingSuccessor) {
      await assertQueueEntryPatientIsAlive(freshResponse.data);
      return existingSuccessor;
    }
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED,
      'Cannot transition an emergency queue entry that has already ended.',
    );
  }

  try {
    await openmrsFetch(`${restBaseUrl}/queue-entry/transition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params,
    });
  } catch (error) {
    let current: FetchResponse<QueueEntryState>;
    let successor: FetchResponse<QueueEntryState> | null;
    try {
      current = await fetchQueueEntryState(params.queueEntryToTransition);
      successor = await findEmergencyQueueTransitionSuccessor(current.data, params);
    } catch {
      // Preserve the original write error when its outcome cannot be verified.
      throw error;
    }
    if (successor) {
      // Do not let a response-loss reconciliation resume care if the patient
      // died while the transition request was in flight.
      await assertQueueEntryPatientIsAlive(current.data);
      return successor;
    }
    throw error;
  }

  const current = await fetchQueueEntryState(params.queueEntryToTransition);
  const successor = await findEmergencyQueueTransitionSuccessor(current.data, params);
  if (!successor) {
    throw emergencyQueueEntryError(
      EMERGENCY_QUEUE_ENTRY_TRANSITION_UNVERIFIED,
      'The emergency queue transition could not be verified.',
    );
  }
  await assertQueueEntryPatientIsAlive(current.data);
  return successor;
}

/**
 * Stops (closes) an emergency visit after disposition.
 */
export async function stopEmergencyVisit(visitUuid: string) {
  return openmrsFetch(`${restBaseUrl}/visit/${visitUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      stopDatetime: dayjs().format(omrsDateFormat),
    },
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
