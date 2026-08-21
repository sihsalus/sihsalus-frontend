import {
  fhirBaseUrl,
  makeUrl,
  messageOmrsServiceWorker,
  refreshOfflineCacheEntry,
  setupDynamicOfflineDataHandler,
} from '@openmrs/esm-framework';

const patientOfflineRefreshErrorMessage = 'Patient offline data could not be refreshed.';

export function setupOffline() {
  setupDynamicOfflineDataHandler({
    id: 'esm-patient-list-management-app:patient',
    type: 'patient',
    displayName: 'Patient list',
    async isSynced(patientUuid) {
      const expectedUrls = [`${fhirBaseUrl}/Patient/${patientUuid}`];
      const absoluteExpectedUrls = expectedUrls.map((url) => globalThis.location.origin + makeUrl(url));
      const cache = await caches.open('omrs-spa-cache-v1');
      const keys = (await cache.keys()).map((key) => key.url);
      return absoluteExpectedUrls.every((url) => keys.includes(url));
    },
    async sync(patientUuid, abortSignal) {
      const patientUrl = `${fhirBaseUrl}/Patient/${patientUuid}`;

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
