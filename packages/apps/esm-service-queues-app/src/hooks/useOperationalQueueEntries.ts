import { useMemo } from 'react';

import { type QueueEntry, type QueueEntrySearchCriteria } from '../types';
import { useQueueEntries } from './useQueueEntries';

type QueueLocationSelection = QueueEntrySearchCriteria['location'];

/**
 * Queue 3 filters `location` by the queue's administrative location. The shared
 * triage queue belongs to the hospital, while its visits belong to the UPSS
 * that requested the triage. Prefer the visit location so the entry remains
 * visible under that UPSS, and fall back to the queue location for queue-only
 * workflows that have no clinical visit.
 */
export function getOperationalQueueLocationUuid(queueEntry: QueueEntry): string | undefined {
  return queueEntry.visit?.location?.uuid ?? queueEntry.queue?.location?.uuid;
}

export function matchesOperationalQueueLocation(
  queueEntry: QueueEntry,
  selectedLocation: QueueLocationSelection,
): boolean {
  const selectedLocationUuids = Array.isArray(selectedLocation)
    ? selectedLocation.filter(Boolean)
    : selectedLocation
      ? [selectedLocation]
      : [];

  if (selectedLocationUuids.length === 0) {
    return true;
  }

  const operationalLocationUuid = getOperationalQueueLocationUuid(queueEntry);
  return Boolean(operationalLocationUuid && selectedLocationUuids.includes(operationalLocationUuid));
}

/**
 * Fetches active entries without Queue 3's exact queue-location constraint and
 * applies the clinical UPSS rule locally. This keeps the central triage queue
 * visible under the visit's UPSS without exposing physical facilities in the
 * UPSS selector.
 */
export function useOperationalQueueEntries(searchCriteria?: QueueEntrySearchCriteria) {
  const selectedLocation = searchCriteria?.location;
  const backendSearchCriteria = useMemo(
    () => (searchCriteria ? { ...searchCriteria, location: null } : undefined),
    [searchCriteria],
  );
  const result = useQueueEntries(backendSearchCriteria);
  const queueEntries = useMemo(
    () => result.queueEntries.filter((entry) => matchesOperationalQueueLocation(entry, selectedLocation)),
    [result.queueEntries, selectedLocation],
  );

  return { ...result, queueEntries, totalCount: queueEntries.length };
}
