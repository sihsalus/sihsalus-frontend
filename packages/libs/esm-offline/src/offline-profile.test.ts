// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshOfflineCacheEntry } from './offline-cache';
import { OfflineDb } from './offline-db';
import { areOfflineResourcesCached } from './offline-profile';
import {
  clinicalOfflineCacheName,
  legacyOfflineCacheName,
  OfflineProfileDb,
  readOfflineProfile,
} from './offline-profile-db';
import { handleOfflineDataRequest, purgeOfflineDownloads } from './offline-profile-worker';

const { session } = vi.hoisted(() => ({ session: { authenticated: true, user: { uuid: 'synthetic-a' } } }));
vi.mock('@openmrs/esm-api', () => ({
  getSessionStore: () => ({ getState: () => ({ loaded: true, session }) }),
  makeUrl: (url: string) => url,
}));
const scope = 'https://example.test/openmrs/spa/';
const sessionUrl = 'https://example.test/openmrs/ws/rest/v1/session';
const resource = 'https://example.test/openmrs/ws/fhir2/R4/Patient/synthetic';
const stores = new Map<string, Map<string, Response>>();
const key = (input: RequestInfo | URL) => (input instanceof Request ? input.url : input.toString());
const fetchMock = vi.fn<typeof fetch>();
const deleteCache = vi.fn(async (name: string) => stores.delete(name));
const held = new Set<string>();

async function authenticate(user = 'synthetic-a') {
  fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: user } }));
  const response = await handleOfflineDataRequest(new Request(sessionUrl), scope);
  expect(response.status).toBe(200);
}
async function cached(name: string, url: string, body: string) {
  const cache = await caches.open(name);
  await cache.put(url, new Response(body));
}

beforeEach(async () => {
  await new OfflineProfileDb().delete();
  await new OfflineDb().delete();
  stores.clear();
  held.clear();
  session.user.uuid = 'synthetic-a';
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('location', { origin: 'https://example.test' });
  vi.stubGlobal('navigator', {
    locks: {
      request: async (name: string, _options: LockOptions, callback: LockGrantedCallback<unknown>) => {
        if (held.has(name)) return callback(null);
        held.add(name);
        try {
          return await callback({ name, mode: 'exclusive' } as Lock);
        } finally {
          held.delete(name);
        }
      },
    },
  });
  deleteCache.mockImplementation(async (name) => stores.delete(name));
  vi.stubGlobal('caches', {
    open: vi.fn(async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (url: RequestInfo | URL) => store.get(key(url))?.clone(),
        put: async (url: RequestInfo | URL, response: Response) => {
          store.set(key(url), response.clone());
        },
        keys: async () => [...store.keys()].map((url) => new Request(url)),
        delete: async (url: RequestInfo | URL) => store.delete(key(url)),
      };
    }),
    keys: async () => [...stores.keys()],
    delete: deleteCache,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('owned offline responses', () => {
  it('persists ownership across database reopen and serves only prepared responses', async () => {
    await authenticate();
    fetchMock.mockResolvedValueOnce(new Response('synthetic data'));
    await handleOfflineDataRequest(
      new Request(resource, { headers: { 'x-omrs-offline-caching-strategy': 'network-first' } }),
      scope,
    );
    expect((await readOfflineProfile())?.ownerId).toBe('synthetic-a');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(await (await handleOfflineDataRequest(new Request(resource), scope)).text()).toBe('synthetic data');
    expect(await areOfflineResourcesCached([resource])).toBe(true);
    expect(await areOfflineResourcesCached([])).toBe(false);
  });

  it('blocks another user and logout while retaining the assigned user downloads', async () => {
    await authenticate();
    await cached(clinicalOfflineCacheName, resource, 'A only');
    await authenticate('synthetic-b');
    session.user.uuid = 'synthetic-b';
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect((await handleOfflineDataRequest(new Request(resource), scope)).status).toBe(503);
    expect(await areOfflineResourcesCached([resource])).toBe(false);
    await authenticate();
    session.user.uuid = 'synthetic-a';
    expect(await areOfflineResourcesCached([resource])).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await handleOfflineDataRequest(new Request(sessionUrl, { method: 'DELETE' }), scope);
    expect((await handleOfflineDataRequest(new Request(resource), scope)).status).toBe(503);
    expect(stores.get(clinicalOfflineCacheName)?.has(resource)).toBe(true);
  });

  it('rejects late refreshes even when the original user logs back in', async () => {
    await authenticate();
    await cached(clinicalOfflineCacheName, resource, 'previous');
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const refresh = refreshOfflineCacheEntry(resource);
    await vi.waitFor(() => expect(resolve).toBeDefined());
    await authenticate('synthetic-b');
    await authenticate();
    resolve(new Response('late'));
    await expect(refresh).rejects.toThrow('The offline resource could not be refreshed from the network.');
    expect(await stores.get(clinicalOfflineCacheName)?.get(resource)?.clone().text()).toBe('previous');
  });

  it('does not allow old session reads to restore a logged out profile', async () => {
    await authenticate();
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = handleOfflineDataRequest(new Request(sessionUrl), scope);
    await vi.waitFor(() => expect(resolve).toBeDefined());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await handleOfflineDataRequest(new Request(sessionUrl, { method: 'DELETE' }), scope);
    resolve(Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    await pending;
    expect((await readOfflineProfile())?.activeUserId).toBeUndefined();
  });

  it.each([
    ['no-store', resource, { cache: 'no-store' }],
    ['credentials', resource, { headers: { Authorization: 'Basic synthetic' } }],
    ['external', 'https://external.test/ws/rest/v1/session', {}],
  ] as const)('never uses cached data for %s', async (_label, url, init) => {
    await authenticate();
    await cached(clinicalOfflineCacheName, url, 'must not return');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect((await handleOfflineDataRequest(new Request(url, init), scope)).status).toBe(503);
  });

  it('does not replay a received response when metadata or cache processing fails', async () => {
    await authenticate();
    fetchMock.mockResolvedValueOnce(new Response('{invalid-json'));
    expect((await handleOfflineDataRequest(new Request(sessionUrl), scope)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await readOfflineProfile())?.activeUserId).toBeUndefined();
  });

  it('keeps online login available in browsers without Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    expect(
      (
        await handleOfflineDataRequest(
          new Request(sessionUrl, { headers: { Authorization: 'Basic synthetic' } }),
          scope,
        )
      ).status,
    ).toBe(200);
    expect(await areOfflineResourcesCached([resource])).toBe(false);
  });
});

describe('verified download cleanup', () => {
  it('blocks legacy data, removes only downloads, and retains selected membership and shell', async () => {
    await cached(legacyOfflineCacheName, resource, 'legacy');
    await cached(legacyOfflineCacheName, `${scope}index.html`, 'shell');
    await authenticate();
    expect((await readOfflineProfile())?.phase).toBe('needs-cleanup');
    const db = new OfflineDb();
    await db.dynamicOfflineData.add({
      type: 'patient',
      identifier: 'synthetic',
      users: ['synthetic-a'],
      syncState: {
        syncedBy: 'synthetic-a',
        syncedOn: new Date(),
        succeededHandlers: ['test'],
        erroredHandlers: [],
        errors: [],
      },
    });
    db.close();
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    await purgeOfflineDownloads(scope);
    expect((await readOfflineProfile())?.phase).toBe('active');
    expect(stores.get(legacyOfflineCacheName)?.has(resource)).toBe(false);
    expect(stores.get(legacyOfflineCacheName)?.has(`${scope}index.html`)).toBe(true);
    const reopened = new OfflineDb();
    const entries = await reopened.dynamicOfflineData.toArray();
    expect(entries).toMatchObject([{ identifier: 'synthetic' }]);
    expect(entries[0]?.syncState).toBeUndefined();
    reopened.close();
  });

  it.each([
    'synthetic-a',
    'synthetic-b',
  ])('preserves pending content owned by %s and rejects cleanup', async (userId) => {
    await authenticate();
    await cached(clinicalOfflineCacheName, resource, 'retained');
    const db = new OfflineDb();
    await db.syncQueue.add({
      userId,
      type: 'test',
      descriptor: {},
      createdOn: new Date(),
      content: { checkpoint: 'attempted' },
    });
    db.close();
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    await expect(purgeOfflineDownloads(scope)).rejects.toThrow('The offline profile is unavailable.');
    const reopened = new OfflineDb();
    expect(await reopened.syncQueue.toArray()).toMatchObject([{ content: { checkpoint: 'attempted' } }]);
    reopened.close();
    expect(stores.get(clinicalOfflineCacheName)?.has(resource)).toBe(true);
  });

  it('leaves an incomplete cleanup blocked and supports verified retry', async () => {
    await authenticate();
    await cached(clinicalOfflineCacheName, resource, 'retained');
    fetchMock.mockImplementation(async () => Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    deleteCache.mockResolvedValueOnce(false);
    await expect(purgeOfflineDownloads(scope)).rejects.toThrow();
    expect((await readOfflineProfile())?.phase).toBe('clearing');
    expect(await areOfflineResourcesCached([resource])).toBe(false);
    await expect(purgeOfflineDownloads(scope)).resolves.toBeUndefined();
    expect((await readOfflineProfile())?.phase).toBe('active');
  });

  it('rejects cleanup during synchronization and when the fresh session cannot be confirmed', async () => {
    await authenticate();
    held.add('openmrs-offline-synchronization');
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: 'synthetic-a' } }));
    await expect(purgeOfflineDownloads(scope)).rejects.toThrow();
    held.clear();
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true, user: { uuid: 'synthetic-b' } }));
    await expect(purgeOfflineDownloads(scope)).rejects.toThrow();
    expect(deleteCache).not.toHaveBeenCalled();
  });
});

it.each([
  NaN,
  -1,
  Number.MAX_SAFE_INTEGER + 1,
])('fails closed for corrupt ownership generation %s', async (generation) => {
  await authenticate();
  await cached(clinicalOfflineCacheName, resource, 'must remain blocked');
  const db = new OfflineProfileDb();
  await db.profile.update('profile', { generation });
  db.close();
  fetchMock.mockRejectedValue(new TypeError('offline'));
  expect(await areOfflineResourcesCached([resource])).toBe(false);
  expect((await handleOfflineDataRequest(new Request(resource), scope)).status).toBe(503);
});
