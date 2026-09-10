import { getSessionStore } from '@openmrs/esm-api';
import {
  canUseOfflineProfile,
  clinicalOfflineCacheName,
  matchesOfflineProfile,
  type OfflineProfile,
  offlineProfileErrorMessage,
  readOfflineProfile,
  withOfflineStorageLock,
} from './offline-profile-db';
import { messageOmrsServiceWorker } from './service-worker-messaging';

function currentUserId() {
  const state = getSessionStore().getState();
  return state.loaded && state.session.authenticated ? state.session.user?.uuid : undefined;
}

export async function captureOfflineProfile(): Promise<OfflineProfile> {
  const profile = await readOfflineProfile();
  if (!canUseOfflineProfile(profile, currentUserId())) throw new Error(offlineProfileErrorMessage);
  return profile;
}

/** Presence alone in a shared or historical cache is not evidence of an owned download. */
export async function areOfflineResourcesCached(urls: string[]): Promise<boolean> {
  try {
    if (!urls.length) return false;
    return await withOfflineStorageLock('shared', async () => {
      const before = await captureOfflineProfile();
      const cache = await globalThis.caches.open(clinicalOfflineCacheName);
      const found = await Promise.all(urls.map((url) => cache.match(url)));
      return found.every((response) => response?.ok) && matchesOfflineProfile(await captureOfflineProfile(), before);
    });
  } catch {
    return false;
  }
}

/** Capture before the network request; session transitions take the exclusive lock. */
export async function storeOfflineResponse(
  url: string,
  response: Response,
  expected: OfflineProfile,
  signal?: AbortSignal,
): Promise<void> {
  return withOfflineStorageLock('shared', async () => {
    if (signal?.aborted || !response.ok || !matchesOfflineProfile(await captureOfflineProfile(), expected)) {
      throw new Error(offlineProfileErrorMessage);
    }
    const cache = await globalThis.caches.open(clinicalOfflineCacheName);
    if (signal?.aborted) throw new Error(offlineProfileErrorMessage);
    await cache.put(url, response);
  });
}

export async function clearOfflineDownloads(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      messageOmrsServiceWorker({ type: 'clearOfflineDownloads' }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(offlineProfileErrorMessage)), 15000);
      }),
    ]);
    if (!result.success) throw new Error(offlineProfileErrorMessage);
  } catch {
    throw new Error(offlineProfileErrorMessage);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getOfflineProfileStatus(): Promise<'ready' | 'needs-cleanup' | 'unavailable'> {
  try {
    const userId = currentUserId();
    const profile = await readOfflineProfile();
    if (!profile || !userId || profile.ownerId !== userId || profile.activeUserId !== userId) return 'unavailable';
    return profile.phase === 'active' ? 'ready' : 'needs-cleanup';
  } catch {
    return 'unavailable';
  }
}
