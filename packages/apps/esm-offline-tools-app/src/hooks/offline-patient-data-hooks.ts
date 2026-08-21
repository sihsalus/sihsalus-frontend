import { fetchCurrentPatient, getDynamicOfflineDataEntries, getSynchronizationItems } from '@openmrs/esm-framework';
import merge from 'lodash-es/merge';
import { useMemo } from 'react';
import useSWR, { type SWRResponse } from 'swr';
import { useOfflineOwnerId } from './use-offline-owner';

function useDynamicOfflineDataEntries(type: string) {
  const ownerId = useOfflineOwnerId();
  return useSWR(ownerId ? ['dynamicOfflineData/entries', ownerId, type] : null, () =>
    getDynamicOfflineDataEntries(type),
  );
}

function useSynchronizationItems<T>(type: string) {
  const ownerId = useOfflineOwnerId();
  return useSWR(ownerId ? ['syncQueue/items', ownerId, type] : null, () => getSynchronizationItems<T>(type));
}

function useFhirPatients(ids: Array<string>) {
  const ownerId = useOfflineOwnerId();
  const stableIds = useMemo(() => [...ids].sort((a, b) => a.localeCompare(b)), [ids]);
  return useSWR(ownerId ? ['fhirPatients', ownerId, ...stableIds] : null, () =>
    Promise.all(stableIds.map((patientId) => fetchCurrentPatient(patientId, undefined, false))),
  );
}

export function useOfflineRegisteredPatients() {
  const offlinePatientsSwr = useDynamicOfflineDataEntries('patient');
  const patientSyncItemsSwr = useSynchronizationItems<{
    fhirPatient?: fhir.Patient;
  }>('patient-registration');

  return useMergedSwr(() => {
    return patientSyncItemsSwr.data
      .filter((patientRegistrationItem) => {
        const isNewlyRegistered =
          patientRegistrationItem.fhirPatient &&
          !offlinePatientsSwr.data.find(
            (offlinePatientEntry) => offlinePatientEntry.identifier === patientRegistrationItem.fhirPatient.id,
          );
        return isNewlyRegistered;
      })
      .map((item) => item.fhirPatient);
  }, [offlinePatientsSwr, patientSyncItemsSwr]);
}

export function useOfflinePatientsWithEntries() {
  const offlinePatientsSwr = useDynamicOfflineDataEntries('patient');
  const patientSyncItemsSwr = useSynchronizationItems<{
    fhirPatient?: fhir.Patient;
  }>('patient-registration');
  const fhirPatientsSwr = useFhirPatients(offlinePatientsSwr.data?.map((entry) => entry.identifier) ?? []);

  return useMergedSwr(() => {
    return offlinePatientsSwr.data.map((offlinePatientEntry) => {
      const matchingFhirPatient = fhirPatientsSwr.data.find((patient) => patient.id === offlinePatientEntry.identifier);
      const offlineUpdates = patientSyncItemsSwr.data
        .filter((syncItem) => syncItem.fhirPatient.id === offlinePatientEntry.identifier)
        .map((item) => item.fhirPatient);
      const finalPatient = merge(matchingFhirPatient, ...offlineUpdates) as fhir.Patient;

      return {
        patient: finalPatient,
        entry: offlinePatientEntry,
      };
    });
  }, [offlinePatientsSwr, patientSyncItemsSwr, fhirPatientsSwr]);
}

export function useOfflinePatientStats() {
  const offlinePatientsSwr = useDynamicOfflineDataEntries('patient');
  const offlineRegisteredPatientsSwr = useOfflineRegisteredPatients();

  return useMergedSwr(
    () => ({
      downloadedCount: offlinePatientsSwr.data.length,
      registeredCount: offlineRegisteredPatientsSwr.data.length,
    }),
    [offlinePatientsSwr, offlineRegisteredPatientsSwr],
  );
}

export function useLastSyncStateOfPatient(patientUuid: string) {
  const ownerId = useOfflineOwnerId();
  return useSWR(
    ownerId && patientUuid ? ['offlineTools/offlinePatient/lastSyncState', ownerId, patientUuid] : null,
    async () => {
      const offlinePatientEntries = await getDynamicOfflineDataEntries('patient');
      const patientEntry = offlinePatientEntries.find((entry) => entry.identifier === patientUuid);
      return patientEntry?.syncState;
    },
  );
}

export function useMergedSwr<T>(merge: () => T, swrResponses: Array<SWRResponse>): SWRResponse<T> {
  return useMemo(() => {
    const areAllLoaded = swrResponses.every((res) => !!res.data);
    const data = areAllLoaded ? merge() : null;
    const error = swrResponses.find((res) => res.error)?.error;
    const mutate: () => Promise<undefined> = async () => {
      const refreshResults = await Promise.allSettled(
        swrResponses.map((response) => Promise.resolve().then(() => response.mutate())),
      );

      if (refreshResults.some((result) => result.status === 'rejected')) {
        throw new Error('Offline patient data could not be refreshed.');
      }

      return undefined;
    };
    const isValidating = swrResponses.some((res) => res.isValidating);
    const isLoading = swrResponses.some((res) => res.isLoading);

    return {
      data,
      error,
      mutate,
      isValidating,
      isLoading,
    };
  }, [merge, swrResponses]);
}
