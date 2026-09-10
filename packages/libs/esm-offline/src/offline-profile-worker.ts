import Dexie from 'dexie';
import { OfflineDb } from './offline-db';
import {
  clinicalOfflineCacheName,
  legacyOfflineCacheName,
  matchesOfflineProfile,
  type OfflineProfile,
  OfflineProfileDb,
  offlineProfileErrorMessage,
  offlineSynchronizationLockName,
  readOfflineProfile,
  withOfflineStorageLock,
} from './offline-profile-db';
import { omrsOfflineCachingStrategyHttpHeaderName } from './service-worker-http-headers';

const sessionPath = '/ws/rest/v1/session';
const unavailable = () => new Response(null, { status: 503 });

export function isProtectedOfflineRequest(request: Request, scope: string) {
  const url = new URL(request.url);
  const shell = new URL(scope);
  // Compiled assets stay in the upstream shell cache. Responses outside the SPA
  // (including API, images and external resources) require the assigned profile.
  return url.origin !== shell.origin || !url.pathname.startsWith(shell.pathname);
}

function sessionUser(value: unknown): string | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('authenticated' in value) ||
    value.authenticated !== true ||
    !('user' in value) ||
    !value.user ||
    typeof value.user !== 'object' ||
    !('uuid' in value.user)
  )
    return undefined;
  return typeof value.user.uuid === 'string' && value.user.uuid.trim() ? value.user.uuid : undefined;
}

async function recordSession(response: Response, request: Request, scope: string, previous?: OfflineProfile) {
  const userId = response.ok
    ? sessionUser(
        await response
          .clone()
          .json()
          .catch(() => undefined),
      )
    : undefined;
  return withOfflineStorageLock('exclusive', async () => {
    const db = new OfflineProfileDb();
    try {
      const hasLegacyData =
        !previous &&
        (await (await caches.open(legacyOfflineCacheName)).keys()).some((key) => isProtectedOfflineRequest(key, scope));
      return await db.transaction('rw', db.profile, async () => {
        const current = await db.profile.get('profile');
        // A late session read must not reverse a logout or a newer account change.
        if (current && (!previous || current.generation !== previous.generation)) return undefined;
        const ownerId = current?.ownerId ?? userId;
        if (!ownerId) return undefined;
        const next: OfflineProfile = current
          ? {
              ...current,
              activeUserId: userId,
              generation: current.generation + (userId === current.activeUserId ? 0 : 1),
            }
          : {
              id: 'profile',
              ownerId,
              activeUserId: userId,
              generation: 0,
              phase: hasLegacyData ? 'needs-cleanup' : 'active',
              sessionUrl: new URL(request.url).origin + new URL(request.url).pathname,
            };
        await db.profile.put(next);
        return next;
      });
    } finally {
      db.close();
    }
  });
}

async function invalidateSession() {
  return withOfflineStorageLock('exclusive', async () => {
    const db = new OfflineProfileDb();
    try {
      await db.transaction('rw', db.profile, async () => {
        const current = await db.profile.get('profile');
        if (current)
          await db.profile.update('profile', { activeUserId: undefined, generation: current.generation + 1 });
      });
    } finally {
      db.close();
    }
  });
}

async function shouldCache(request: Request) {
  const strategy = request.headers.get(omrsOfflineCachingStrategyHttpHeaderName);
  if (strategy) return strategy === 'network-first';
  const db = new Dexie('ServiceWorker');
  db.version(1).stores({ dynamicRouteRegistrations: '++,&pattern' });
  try {
    const routes = await db.table<{ pattern: string; strategy?: string }>('dynamicRouteRegistrations').toArray();
    return routes.some((route) => {
      try {
        return new RegExp(route.pattern).test(request.url) && (!route.strategy || route.strategy === 'network-first');
      } catch {
        return false;
      }
    });
  } finally {
    db.close();
  }
}

async function cachedResponse(request: Request, expected: OfflineProfile | undefined): Promise<Response> {
  return withOfflineStorageLock('shared', async () => {
    if (!matchesOfflineProfile(await readOfflineProfile(), expected)) return unavailable();
    const cache = await caches.open(clinicalOfflineCacheName);
    return (await cache.match(request)) ?? unavailable();
  });
}

async function cacheResponse(request: Request, response: Response, expected: OfflineProfile | undefined) {
  return withOfflineStorageLock('shared', async () => {
    if (!matchesOfflineProfile(await readOfflineProfile(), expected)) return;
    const cache = await caches.open(clinicalOfflineCacheName);
    await cache.put(request, response.clone());
  });
}

/** Registered ahead of upstream fallback routes; legacy clinical responses are never used. */
export async function handleOfflineDataRequest(request: Request, scope: string): Promise<Response> {
  const url = new URL(request.url);
  const sameOrigin = url.origin === new URL(scope).origin;
  const isSession = sameOrigin && url.pathname.endsWith(sessionPath);
  // External resources cannot establish ownership or enter the clinical cache.
  const freshOnly =
    !sameOrigin || request.cache === 'no-store' || request.headers.has('Authorization') || request.method !== 'GET';
  if (
    typeof navigator.locks?.request === 'function' &&
    sameOrigin &&
    (request.headers.has('Authorization') || (isSession && request.method !== 'GET'))
  ) {
    try {
      await invalidateSession();
    } catch {
      return unavailable();
    }
  }
  const before = await readOfflineProfile().catch(() => undefined);
  let response: Response;
  try {
    response = await fetch(request, { cache: 'no-store' });
  } catch {
    if (freshOnly) return unavailable();
    return cachedResponse(request, before).catch(unavailable);
  }
  // A storage failure must never replay an HTTP request or hide a received response.
  try {
    if (isSession && request.method === 'GET' && (response.ok || response.status === 401 || response.status === 403)) {
      const recorded = await recordSession(response, request, scope, before);
      if (recorded && !freshOnly && response.ok) await cacheResponse(request, response, recorded);
    } else if (sameOrigin && response.status === 401) {
      await invalidateSession();
    } else if (!freshOnly && response.ok && (await shouldCache(request))) {
      await cacheResponse(request, response, before);
    }
  } catch {
    /* The online response remains usable; cached reads still require ownership. */
  }
  return response;
}

/** Removes downloads only. Failed/incomplete purge remains blocked and never touches queued content. */
export async function purgeOfflineDownloads(scope: string): Promise<void> {
  const profile = await readOfflineProfile();
  if (!profile || profile.activeUserId !== profile.ownerId || !navigator.locks?.request) {
    throw new Error(offlineProfileErrorMessage);
  }
  if (new URL(profile.sessionUrl).origin !== new URL(scope).origin) throw new Error(offlineProfileErrorMessage);
  const response = await fetch(profile.sessionUrl, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok || sessionUser(await response.json()) !== profile.ownerId)
    throw new Error(offlineProfileErrorMessage);
  await withOfflineStorageLock(
    'exclusive',
    () =>
      navigator.locks.request(
        offlineSynchronizationLockName,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) throw new Error(offlineProfileErrorMessage);
          const queue = new OfflineDb();
          const db = new OfflineProfileDb();
          try {
            if (await queue.syncQueue.count()) throw new Error(offlineProfileErrorMessage);
            const current = await db.profile.get('profile');
            if (!current || current.generation !== profile.generation || current.activeUserId !== profile.ownerId) {
              throw new Error(offlineProfileErrorMessage);
            }
            const generation = current.generation + 1;
            await db.profile.update('profile', { phase: 'clearing', generation });
            await caches.delete(clinicalOfflineCacheName);
            const legacy = await caches.open(legacyOfflineCacheName);
            const legacyKeys = (await legacy.keys()).filter((key) => isProtectedOfflineRequest(key, scope));
            await Promise.all(legacyKeys.map((key) => legacy.delete(key)));
            if (
              (await caches.keys()).includes(clinicalOfflineCacheName) ||
              (await legacy.keys()).some((key) => isProtectedOfflineRequest(key, scope))
            ) {
              throw new Error(offlineProfileErrorMessage);
            }
            await queue.dynamicOfflineData
              .where('users')
              .equals(profile.ownerId)
              .modify((entry) => {
                delete entry.syncState;
              });
            await db.transaction('rw', db.profile, async () => {
              const final = await db.profile.get('profile');
              if (!final || final.generation !== generation || final.activeUserId !== profile.ownerId) {
                throw new Error(offlineProfileErrorMessage);
              }
              await db.profile.update('profile', { phase: 'active' });
            });
          } finally {
            queue.close();
            db.close();
          }
        },
      ),
    true,
  );
}
