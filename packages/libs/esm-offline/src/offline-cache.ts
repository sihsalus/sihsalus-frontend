/** @module @category Offline */
import { makeUrl } from '@openmrs/esm-api';
import { omrsOfflineCachingStrategyHttpHeaderName } from './service-worker-http-headers';

const offlineCacheName = 'omrs-spa-cache-v1';
const offlineRefreshQueryParameter = '_openmrsOfflineRefresh';
const offlineRefreshErrorMessage = 'The offline resource could not be refreshed from the network.';

/**
 * Fetches a confirmed network response and stores it under the resource's stable offline cache key.
 * A failed or canceled refresh leaves any existing stable response untouched.
 */
export async function refreshOfflineCacheEntry(url: string, signal?: AbortSignal): Promise<void> {
  try {
    if (signal?.aborted) {
      throw new Error(offlineRefreshErrorMessage);
    }

    const stableUrl = new URL(makeUrl(url), globalThis.location.origin);
    const refreshUrl = new URL(stableUrl);
    refreshUrl.searchParams.set(offlineRefreshQueryParameter, globalThis.crypto.randomUUID());

    const response = await globalThis.fetch(refreshUrl, {
      cache: 'no-store',
      headers: {
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(offlineRefreshErrorMessage);
    }

    if (signal?.aborted) {
      throw new Error(offlineRefreshErrorMessage);
    }

    const cache = await globalThis.caches.open(offlineCacheName);
    if (signal?.aborted) {
      throw new Error(offlineRefreshErrorMessage);
    }
    await cache.put(stableUrl.href, response.clone());
  } catch {
    throw new Error(offlineRefreshErrorMessage);
  }
}
