import {
  makeUrl,
  messageOmrsServiceWorker,
  openmrsFetch,
  refreshOfflineCacheEntry,
  restBaseUrl,
  setupDynamicOfflineDataHandler,
  subscribePrecacheStaticDependencies,
} from '@openmrs/esm-framework';
import escapeRegExp from 'lodash-es/escapeRegExp';

export function setupStaticDataOfflinePrecaching() {
  subscribePrecacheStaticDependencies(() => {
    void (async () => {
      const urlsToCache = [
        `${restBaseUrl}/location?q=&v=custom:(uuid,display)`,
        `${restBaseUrl}/provider?q=&v=custom:(uuid,display,person:(uuid))`,
      ];

      await Promise.all(
        urlsToCache.map(async (url) => {
          await messageOmrsServiceWorker({
            type: 'registerDynamicRoute',
            pattern: '.+' + url,
          });
          await openmrsFetch(url);
        }),
      );
    })();
  });
}

export function setupDynamicOfflineFormDataHandler() {
  setupDynamicOfflineDataHandler({
    id: 'esm-form-entry-react-app:form',
    type: 'form',
    displayName: 'Form entry',
    async isSynced(identifier) {
      const expectedUrls = await getCacheableFormUrls(identifier);
      const absoluteExpectedUrls = expectedUrls.map((url) => globalThis.location.origin + makeUrl(url));
      const cache = await caches.open('omrs-spa-cache-v1');
      const keys = (await cache.keys()).map((key) => key.url);
      return absoluteExpectedUrls.every((url) => keys.includes(url));
    },
    async sync(identifier, abortSignal) {
      const urlsToCache = getCacheableFormUrls(identifier);
      const cacheResults = await Promise.allSettled(
        urlsToCache.map(async (urlToCache) => {
          const routeRegistration = await messageOmrsServiceWorker({
            type: 'registerDynamicRoute',
            pattern: escapeRegExp(urlToCache),
            strategy: 'network-first',
          });

          if (!routeRegistration.success) {
            throw new Error(routeRegistration.error ?? 'The offline form cache route could not be registered.');
          }

          await refreshOfflineCacheEntry(urlToCache, abortSignal);
        }),
      );

      if (cacheResults.some((x) => x.status === 'rejected')) {
        throw new Error('Some form data could not be properly downloaded.');
      }
    },
  });
}

function getCacheableFormUrls(formUuid: string) {
  return [`${restBaseUrl}/form/${formUuid}?v=full`, `${restBaseUrl}/o3/forms/${formUuid}`];
}
