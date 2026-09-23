import { useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import { type ConfigObject } from '../config-schema';
import { type QueueEntry, type QueueEntrySearchCriteria } from '../types';
import { useQueueEntries } from './useQueueEntries';

type QueueLocationSelection = QueueEntrySearchCriteria['location'];

/**
 * Clinical queues belong to the receiving UPSS, which may differ from the
 * visit's original location after a transfer. Only the configured shared triage
 * queue uses the visit's UPSS instead of its administrative queue location.
 */
export function getOperationalQueueLocationUuid(queueEntry: QueueEntry, triageQueueUuid?: string): string | undefined {
  const visitLocationUuid = queueEntry.visit?.location?.uuid;
  const queueLocationUuid = queueEntry.queue?.location?.uuid;

  return triageQueueUuid && queueEntry.queue?.uuid === triageQueueUuid
    ? visitLocationUuid || queueLocationUuid
    : queueLocationUuid || visitLocationUuid;
}

export function matchesOperationalQueueLocation(
  queueEntry: QueueEntry,
  selectedLocation: QueueLocationSelection,
  triageQueueUuid?: string,
): boolean {
  const selectedLocationUuids = Array.isArray(selectedLocation)
    ? selectedLocation.filter(Boolean)
    : selectedLocation
      ? [selectedLocation]
      : [];

  if (selectedLocationUuids.length === 0) {
    return true;
  }

  const operationalLocationUuid = getOperationalQueueLocationUuid(queueEntry, triageQueueUuid);
  return Boolean(operationalLocationUuid && selectedLocationUuids.includes(operationalLocationUuid));
}

/**
 * Fetches active entries without Queue 3's exact queue-location constraint and
 * applies the clinical UPSS rule locally. This keeps the central triage queue
 * visible under the visit's UPSS without exposing physical facilities in the
 * UPSS selector.
 */
export function useOperationalQueueEntries(searchCriteria?: QueueEntrySearchCriteria) {
  const { appointmentTriage } = useConfig<ConfigObject>();
  const triageQueueUuid = appointmentTriage?.triageRouting?.queueUuid;
  const selectedLocation = searchCriteria?.location;
  const backendSearchCriteria = useMemo(
    () => (searchCriteria ? { ...searchCriteria, location: null } : undefined),
    [searchCriteria],
  );
  const result = useQueueEntries(backendSearchCriteria);
  const queueEntries = useMemo(
    () =>
      result.queueEntries.filter((entry) => matchesOperationalQueueLocation(entry, selectedLocation, triageQueueUuid)),
    [result.queueEntries, selectedLocation, triageQueueUuid],
  );

  return { ...result, queueEntries, totalCount: queueEntries.length };
}
