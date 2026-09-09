import '@openmrs/esm-app-shell/default-service-worker';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { omrsOfflineCachingStrategyHttpHeaderName } from '../../libs/esm-offline/src/service-worker-http-headers';

// Fresh clinical reads explicitly opt out of storage. Handle that contract in
// the worker, before its default network/cache fallback can return an old 200.
// Ordinary offline reads and upstream navigation/precache routes retain their
// existing strategies.
registerRoute(
  ({ request }) =>
    request.cache === 'no-store' &&
    request.headers.get(omrsOfflineCachingStrategyHttpHeaderName) === 'network-only-or-cache-only',
  new NetworkOnly(),
  'GET',
);
