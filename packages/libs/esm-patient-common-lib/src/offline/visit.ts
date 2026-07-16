import { type NewVisitPayload, type QueueItemDescriptor, useVisit, type Visit } from '@openmrs/esm-framework';
import { useEffect, useState } from 'react';
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
 * Similar to {@link useVisit}, returns the given patient's active visit, but also considers
 * offline visits created by the patient chart while offline.
 * @param patientUuid The UUID of the patient.
 */
export function useVisitOrOfflineVisit(patientUuid: string): ReturnType<typeof useVisit> {
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
export function useOfflineVisit(patientUuid: string): ReturnType<typeof useVisit> {
  const [offlineVisitState, setOfflineVisitState] = useState<{
    data: Visit | null;
    error: Error | null;
    isLoading: boolean;
  }>({ data: null, error: null, isLoading: true });
  useEffect(() => {
    getOfflineVisitForPatient(patientUuid)
      .then((offlineVisit) => {
        setOfflineVisitState({
          error: null,
          data: offlineVisit ? offlineVisitToVisit(offlineVisit) : null,
          isLoading: false,
        });
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setOfflineVisitState({ error, data: null, isLoading: false });
      });
  }, [patientUuid]);

  return {
    activeVisit: offlineVisitState.data,
    currentVisit: offlineVisitState.data,
    isLoading: offlineVisitState.isLoading,
    isValidating: false,
    currentVisitIsRetrospective: false,
    error: offlineVisitState.error,
    mutate: (): void => {},
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
  const { currentVisit, isValidating, error, mutate } = useOfflineVisit(patientUuid);

  useEffect(() => {
    if (!isOnline && operationalLocationUuid && !isValidating && !currentVisit && !error) {
      void createOfflineVisitForPatient(patientUuid, operationalLocationUuid, offlineVisitTypeUuid, new Date()).finally(
        () => {
          void mutate();
        },
      );
    }
  }, [isOnline, currentVisit, isValidating, error, mutate, offlineVisitTypeUuid, operationalLocationUuid, patientUuid]);
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
