import {
  isOnline,
  makeUrl,
  messageOmrsServiceWorker,
  refreshOfflineCacheEntry,
  restBaseUrl,
  setupDynamicOfflineDataHandler,
  showSnackbar,
  subscribePrecacheStaticDependencies,
  translateFrom,
} from '@openmrs/esm-framework';
import escapeRegExp from 'lodash-es/escapeRegExp';

const moduleName = '@sihsalus/esm-form-entry-react-app';

export function setupStaticDataOfflinePrecaching() {
  subscribePrecacheStaticDependencies(() => {
    if (!isOnline()) {
      return;
    }

    void precacheStaticFormDependencies().catch(() => {
      if (!isOnline()) {
        return;
      }

      showSnackbar({
        kind: 'warning',
        title: translateFrom(
          moduleName,
          'offlineFormDependenciesRefreshFailed',
          'Information for offline use could not be updated',
        ),
        subtitle: translateFrom(
          moduleName,
          'offlineFormDependenciesRefreshFailedSubtitle',
          'Location or clinical provider options may be out of date. Try again before working offline.',
        ),
      });
    });
  });
}

async function precacheStaticFormDependencies(): Promise<void> {
  const urlsToCache = [
    `${restBaseUrl}/location?q=&v=custom:(uuid,display)`,
    `${restBaseUrl}/provider?q=&v=custom:(uuid,display,person:(uuid))`,
  ];
  const results = await Promise.allSettled(
    urlsToCache.map(async (url) => {
      const routeRegistration = await messageOmrsServiceWorker({
        type: 'registerDynamicRoute',
        pattern: escapeRegExp(url),
      });
      if (!routeRegistration.success) {
        throw new Error('A required offline form route could not be registered.');
      }

      await refreshOfflineCacheEntry(url);
    }),
  );

  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Required offline form dependencies could not be refreshed.');
  }
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
