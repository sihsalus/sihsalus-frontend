/// <reference lib="webworker" />
import { registerRoute } from 'workbox-routing';
import {
  handleOfflineDataRequest,
  isProtectedOfflineRequest,
  purgeOfflineDownloads,
} from '../../libs/esm-offline/src/offline-profile-worker';

declare const self: ServiceWorkerGlobalScope;

// This module runs before the upstream worker installs its fallback and message listener.
registerRoute(
  ({ request }) => isProtectedOfflineRequest(request, self.registration.scope),
  ({ request }) => handleOfflineDataRequest(request, self.registration.scope),
  'GET',
);
for (const method of ['POST', 'DELETE', 'PUT', 'PATCH'] as const) {
  registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('/ws/rest/v1/session'),
    ({ request }) => handleOfflineDataRequest(request, self.registration.scope),
    method,
  );
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'clearOfflineDownloads') return;
  event.stopImmediatePropagation();
  event.waitUntil(
    (async () => {
      try {
        const source = event.source;
        const client = source && 'id' in source ? await self.clients.get(source.id) : undefined;
        // Only a controlled SPA window may ask to purge its own prepared downloads.
        if (!client || !client.url.startsWith(self.registration.scope)) {
          event.ports[0]?.postMessage({ success: false });
          return;
        }
        await purgeOfflineDownloads(self.registration.scope);
        event.ports[0]?.postMessage({ success: true });
      } catch {
        event.ports[0]?.postMessage({ success: false });
      }
    })(),
  );
});
