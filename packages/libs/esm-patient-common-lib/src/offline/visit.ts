import { type NewVisitPayload, type QueueItemDescriptor, useVisit, type Visit } from '@openmrs/esm-framework';
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

/**
 * The identifier of a visit in the sync queue.
 */
export const visitSyncType = 'visit';

/**
 * The shape of an offline visit queued up by the patient chart.
 */
export interface OfflineVisit extends NewVisitPayload {
  uuid: string;
}

/**
 * `useVisit` returns no error until a request fails, even though its upstream
 * `VisitReturnType` currently declares `error` as always present.
 */
export type VisitOrOfflineVisitResult = Omit<ReturnType<typeof useVisit>, 'error'> & {
  error: Error | null | undefined;
};

/**
 * Similar to {@link useVisit}, returns the given patient's active visit, but also considers
 * offline visits created by the patient chart while offline.
 * @param patientUuid The UUID of the patient.
 */
export function useVisitOrOfflineVisit(patientUuid: string): VisitOrOfflineVisitResult {
  const isOnline = useOnlineStatus();

  const onlineVisit = useVisit(patientUuid);
  const offlineVisit = useOfflineVisit(patientUuid);

  if (!isOnline) {
    return offlineVisit;
  }

  // In this framework version (9.x), useVisit().currentVisit requires the visit
  // context store to be initialized with the patient UUID (which only happens for
  // retrospective visits). For regular active visits, currentVisit stays null even
  // though activeVisit is correctly populated from the API. Fall back to activeVisit
  // so all downstream consumers (workspace launchers, form entry, etc.) can detect
  // the active visit.
  return {
    ...onlineVisit,
    currentVisit: onlineVisit.currentVisit ?? onlineVisit.activeVisit,
  };
}

/**
 * Returns the patient's current offline visit.
 * @param patientUuid The UUID of the patient.
 */
export function useOfflineVisit(patientUuid: string): VisitOrOfflineVisitResult {
  const [offlineVisitState, setOfflineVisitState] = useState<{
    data: Visit | null;
    error: Error | null;
    isLoading: boolean;
  }>({ data: null, error: null, isLoading: true });
  const [refreshCounter, setRefreshCounter] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCounter intentionally re-runs the read when mutate() is called
  useEffect(() => {
    // IndexedDB reads have variable latency; without this guard a slow read for a
    // previous patient could overwrite the current patient's visit state.
    let ignore = false;

    setOfflineVisitState({ data: null, error: null, isLoading: true });
    getOfflineVisitForPatient(patientUuid)
      .then((offlineVisit) => {
        if (!ignore) {
          setOfflineVisitState({
            error: null,
            data: offlineVisit ? offlineVisitToVisit(offlineVisit) : null,
            isLoading: false,
          });
        }
      })
      .catch((err) => {
        if (!ignore) {
          const error = err instanceof Error ? err : new Error(String(err));
          setOfflineVisitState({ error, data: null, isLoading: false });
        }
      });

    return () => {
      ignore = true;
    };
  }, [patientUuid, refreshCounter]);

  const mutate = useCallback((): void => setRefreshCounter((counter) => counter + 1), []);

  return {
    activeVisit: offlineVisitState.data,
    currentVisit: offlineVisitState.data,
    isLoading: offlineVisitState.isLoading,
    isValidating: false,
    currentVisitIsRetrospective: false,
    error: offlineVisitState.error,
    mutate,
  };
}

/**
 * While offline, if no offline visit for the given patient exists, creates one.
 * The existance of the offline visit leverages {@link useOfflineVisit}.
 * Mutates those SWR hooks when a new offline visit has been created.
 * @param patientUuid The UUID of the patient for which an offline visit should be created.
 * @param offlineVisitTypeUuid The UUID of the offline visit type.
 * @param operationalLocationUuid The UUID of the operational location selected for the offline visit.
 */
export function useAutoCreatedOfflineVisit(
  patientUuid: string,
  offlineVisitTypeUuid: string,
  operationalLocationUuid: string,
): void {
  const isOnline = useOnlineStatus();
  const { currentVisit, isLoading, isValidating, error, mutate } = useOfflineVisit(patientUuid);

  useEffect(() => {
    // Waiting for isLoading avoids queueing a duplicate offline visit while the
    // IndexedDB read for an existing one is still in flight.
    if (!isOnline && operationalLocationUuid && !isLoading && !isValidating && !currentVisit && !error) {
      void createOfflineVisitForPatient(patientUuid, operationalLocationUuid, offlineVisitTypeUuid, new Date())
        // Refresh only after a successful write. Refreshing an empty queue after
        // a rejected write would satisfy this effect again and create a retry loop.
        .then(() => mutate())
        // Queue and SWR-compatible refresh failures are fixed at their public
        // boundaries; consume them here without rendering technical detail.
        .catch(() => undefined);
    }
  }, [
    isOnline,
    currentVisit,
    isLoading,
    isValidating,
    error,
    mutate,
    offlineVisitTypeUuid,
    operationalLocationUuid,
    patientUuid,
  ]);
}

export async function getOfflineVisitForPatient(patientUuid: string): Promise<OfflineVisit | undefined> {
  const { getSynchronizationItems } = await import('@openmrs/esm-framework');
  const offlineVisits = await getSynchronizationItems<OfflineVisit>(visitSyncType);
  return offlineVisits.find((visit) => visit.patient === patientUuid);
}

export async function createOfflineVisitForPatient(
  patientUuid: string,
  location: string,
  offlineVisitTypeUuid: string,
  startDatetime: Date,
): Promise<OfflineVisit> {
  const { getSynchronizationItems, queueSynchronizationItem } = await import('@openmrs/esm-framework');
  const patientRegistrationSyncItems = await getSynchronizationItems<{ fhirPatient: fhir.Patient }>(
    'patient-registration',
  );
  const isVisitForOfflineRegisteredPatient = patientRegistrationSyncItems.some(
    (item) => item.fhirPatient.id === patientUuid,
  );

  const offlineVisit: OfflineVisit = {
    uuid: uuid(),
    patient: patientUuid,
    startDatetime,
    location,
    visitType: offlineVisitTypeUuid,
  };

  const descriptor: QueueItemDescriptor = {
    id: offlineVisit.uuid,
    displayName: 'Offline visit',
    patientUuid,
    dependencies: isVisitForOfflineRegisteredPatient
      ? [
          {
            type: 'patient-registration',
            id: patientUuid,
          },
        ]
      : [],
  };

  await queueSynchronizationItem(visitSyncType, offlineVisit, descriptor);
  return offlineVisit;
}

export function offlineVisitToVisit(offlineVisit: OfflineVisit): Visit {
  return {
    uuid: offlineVisit.uuid,
    startDatetime: offlineVisit.startDatetime?.toString(),
    stopDatetime: offlineVisit.stopDatetime?.toString(),
    encounters: [],
    location: {
      uuid: offlineVisit.location,
    },
    visitType: {
      uuid: offlineVisit.visitType,
      display: 'Offline',
    },
    patient: {
      uuid: offlineVisit.patient,
    },
  } as Visit;
}

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
