import {
  areOfflineResourcesCached,
  makeUrl,
  messageOmrsServiceWorker,
  refreshOfflineCacheEntry,
  setupDynamicOfflineDataHandler,
} from '@openmrs/esm-framework';

const patientOfflineRefreshErrorMessage = 'Patient offline data could not be refreshed.';

export function setupOffline() {
  setupDynamicOfflineDataHandler({
    id: 'esm-offline-tools-app:patient',
    displayName: 'Offline tools',
    type: 'patient',
    async isSynced(identifier) {
      const expectedUrls = [`/ws/fhir2/R4/Patient/${identifier}`];
      const absoluteExpectedUrls = expectedUrls.map((url) => globalThis.location.origin + makeUrl(url));
      return areOfflineResourcesCached(absoluteExpectedUrls);
    },
    async sync(identifier, abortSignal) {
      const patientUrl = `/ws/fhir2/R4/Patient/${identifier}`;

      try {
        const routeRegistration = await messageOmrsServiceWorker({
          type: 'registerDynamicRoute',
          pattern: patientUrl,
        });

        if (!routeRegistration.success) {
          throw new Error(patientOfflineRefreshErrorMessage);
        }

        await refreshOfflineCacheEntry(patientUrl, abortSignal);
      } catch {
        throw new Error(patientOfflineRefreshErrorMessage);
      }
    },
  });
}
