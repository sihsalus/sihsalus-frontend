import { getDynamicOfflineDataEntries, syncDynamicOfflineData } from '@openmrs/esm-framework';

export interface SyncSelectedOfflinePatientsResult {
  failedCount: number;
  skippedCount: number;
}

/**
 * Synchronizes the selected patients, tolerating individual failures so one failed
 * patient does not abort or silently hide the rest of the batch.
 * @returns Counts for failed dynamic entries and selected rows that cannot be updated yet.
 */
export async function syncSelectedOfflinePatients(
  selectedPatientUuids: Array<string>,
): Promise<SyncSelectedOfflinePatientsResult> {
  const offlinePatientEntries = await getDynamicOfflineDataEntries('patient');
  const syncablePatientUuids = new Set(offlinePatientEntries.map((entry) => entry.identifier));
  const offlinePatientUuidsToSync = selectedPatientUuids.filter((id) => syncablePatientUuids.has(id));

  const results = await Promise.allSettled(
    offlinePatientUuidsToSync.map((patientUuid) => syncDynamicOfflineData('patient', patientUuid)),
  );

  return {
    failedCount: results.filter((result) => result.status === 'rejected').length,
    skippedCount: selectedPatientUuids.length - offlinePatientUuidsToSync.length,
  };
}
