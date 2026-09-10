/** @module @category Offline */
import { makeUrl } from '@openmrs/esm-api';
import { captureOfflineProfile, storeOfflineResponse } from './offline-profile';
import { omrsOfflineCachingStrategyHttpHeaderName } from './service-worker-http-headers';

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

    const profile = await captureOfflineProfile();
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

    await storeOfflineResponse(stableUrl.href, response.clone(), profile, signal);
  } catch {
    throw new Error(offlineRefreshErrorMessage);
  }
}
