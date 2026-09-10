import 'fake-indexeddb/auto';
import { OfflineProfileDb } from '../../../libs/esm-offline/src/offline-profile-db';

vi.mock('@openmrs/esm-api', async () => ({
  ...(await vi.importActual('@openmrs/esm-api')),
  getSessionStore: () => ({
    getState: () => ({ loaded: true, session: { authenticated: true, user: { uuid: 'synthetic-cache-owner' } } }),
  }),
}));
beforeEach(async () => {
  const db = new OfflineProfileDb();
  await db.profile.put({
    id: 'profile',
    ownerId: 'synthetic-cache-owner',
    activeUserId: 'synthetic-cache-owner',
    phase: 'active',
    generation: 0,
    sessionUrl: 'https://synthetic.test/openmrs/ws/rest/v1/session',
  });
  db.close();
  vi.stubGlobal('navigator', {
    onLine: true,
    locks: {
      request: async (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) =>
        callback({ name, mode: options.mode ?? 'exclusive' } as Lock),
    },
  });
});

import {
  getConfig,
  getSessionStore,
  messageOmrsServiceWorker,
  type Session,
  type SyncProcessOptions,
} from '@openmrs/esm-framework';

import { cachePatientUrlsForOfflineUse, getPatientUrlsToBeCached, syncPatientRegistration } from './offline';
import { FormManager } from './patient-registration/form-manager';
import { type PatientRegistration } from './patient-registration/patient-registration.types';

vi.mock('@openmrs/esm-framework', async () => {
  const { refreshOfflineCacheEntry } = await vi.importActual<typeof import('@openmrs/esm-offline/src/public')>(
    '@openmrs/esm-offline/src/public',
  );
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    fhirBaseUrl: '/ws/fhir2/R4',
    getConfig: vi.fn(),
    getSessionStore: vi.fn(),
    makeUrl: vi.fn((url: string) => `/openmrs${url}`),
    messageOmrsServiceWorker: vi.fn(),
    omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
    refreshOfflineCacheEntry,
    restBaseUrl: '/ws/rest/v1',
  };
});

const mockGetConfig = vi.mocked(getConfig);
const mockGetSessionStore = vi.mocked(getSessionStore);
const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);

const createSession = (userUuid: string, privilegeNames: Array<string> = []): Session => ({
  authenticated: true,
  sessionId: `session-${userUuid}`,
  user: {
    uuid: userUuid,
    display: userUuid,
    username: userUuid,
    systemId: userUuid,
    userProperties: {},
    person: {} as never,
    privileges: privilegeNames.map((name) => ({
      uuid: name,
      name,
      display: name,
    })),
    roles: [],
    retired: false,
    locale: 'es',
    allowedLocales: ['es'],
  },
});

describe('patient registration offline cache and synchronization', () => {
  let cachedResponses: Map<string, Response>;
  let cachePut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionStore.mockReturnValue({
      getState: vi.fn(() => ({
        loaded: true,
        session: createSession('active-user'),
      })),
    } as never);
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
    cachedResponses = new Map();
    cachePut = vi.fn(async (request: RequestInfo | URL, response: Response) => {
      const key = request instanceof Request ? request.url : request.toString();
      cachedResponses.set(key, response.clone());
    });
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({
        match: async (request: RequestInfo | URL) => {
          const key = request instanceof Request ? request.url : request.toString();
          return cachedResponses.get(key)?.clone();
        },
        put: cachePut,
      })),
    });
  });

  it.each([
    {
      change: 'granted',
      queuedPrivileges: [],
      activePrivileges: ['Delete Relationships'],
    },
    {
      change: 'revoked',
      queuedPrivileges: ['Delete Relationships'],
      activePrivileges: [],
    },
  ])('uses current privileges after access is $change for the queue owner', async ({
    queuedPrivileges,
    activePrivileges,
  }) => {
    const queuedSession = {
      ...createSession('active-user', queuedPrivileges),
      currentProvider: { uuid: 'provider-uuid', identifier: 'provider-id' },
    };
    const activeSession = {
      ...createSession('active-user', activePrivileges),
      currentProvider: {
        uuid: 'new-provider-uuid',
        identifier: 'new-provider-id',
      },
    };
    mockGetSessionStore.mockReturnValue({
      getState: vi.fn(() => ({ loaded: true, session: activeSession })),
    } as never);
    const savePatientFormOnline = vi.spyOn(FormManager, 'savePatientFormOnline').mockResolvedValue(null);
    const queuedPatient = {
      _patientRegistrationData: {
        currentUser: queuedSession,
        identifierTypes: [],
      },
    } as PatientRegistration;
    const options = {
      abort: new AbortController(),
      userId: 'active-user',
      index: 0,
      items: [queuedPatient],
      dependencies: [],
      updateContent: vi.fn(async (update) => update(queuedPatient)),
    } as SyncProcessOptions<PatientRegistration>;

    await syncPatientRegistration(queuedPatient, options);

    expect(savePatientFormOnline).toHaveBeenCalledOnce();
    expect(savePatientFormOnline.mock.calls[0][8]).toEqual({
      ...queuedSession,
      user: activeSession.user,
    });
    expect(savePatientFormOnline.mock.calls[0][11]).toBe(options.abort);
    expect(queuedPatient._patientRegistrationData.currentUser).toBe(queuedSession);
    expect(queuedSession.user.privileges.map(({ name }) => name)).toEqual(queuedPrivileges);
  });

  it('does not synchronize a queued registration under a different active user', async () => {
    mockGetSessionStore.mockReturnValue({
      getState: vi.fn(() => ({
        loaded: true,
        session: createSession('different-user'),
      })),
    } as never);
    const savePatientFormOnline = vi.spyOn(FormManager, 'savePatientFormOnline').mockResolvedValue(null);
    const queuedPatient = {
      _patientRegistrationData: {
        currentUser: createSession('queue-owner'),
        identifierTypes: [],
      },
    } as PatientRegistration;
    const options = {
      abort: new AbortController(),
      userId: 'queue-owner',
      index: 0,
      items: [queuedPatient],
      dependencies: [],
      updateContent: vi.fn(async (update) => update(queuedPatient)),
    } as SyncProcessOptions<PatientRegistration>;

    await expect(syncPatientRegistration(queuedPatient, options)).rejects.toThrow(
      'The queued patient registration is not owned by the active session.',
    );
    expect(savePatientFormOnline).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { state: 'loading', sessionState: { loaded: false } },
    {
      state: 'expired',
      sessionState: {
        loaded: true,
        session: { ...createSession('queue-owner'), authenticated: false },
      },
    },
    {
      state: 'missing its user',
      sessionState: { loaded: true, session: { authenticated: true } },
    },
  ])('rejects before saving while the session is $state and allows an authenticated retry', async ({
    sessionState,
  }) => {
    const getState = vi.fn().mockReturnValue(sessionState);
    mockGetSessionStore.mockReturnValue({ getState } as never);
    const savePatientFormOnline = vi.spyOn(FormManager, 'savePatientFormOnline').mockResolvedValue(null);
    const queuedPatient = {
      _patientRegistrationData: { currentUser: createSession('queue-owner') },
    } as PatientRegistration;
    const options = {
      abort: new AbortController(),
      userId: 'queue-owner',
      index: 0,
      items: [queuedPatient],
      dependencies: [],
      updateContent: vi.fn(async (update) => update(queuedPatient)),
    } as SyncProcessOptions<PatientRegistration>;

    await expect(syncPatientRegistration(queuedPatient, options)).rejects.toThrow(
      'The queued patient registration is not owned by the active session.',
    );
    expect(savePatientFormOnline).not.toHaveBeenCalled();

    getState.mockReturnValue({
      loaded: true,
      session: createSession('queue-owner'),
    });
    await expect(syncPatientRegistration(queuedPatient, options)).resolves.toBeUndefined();
    expect(savePatientFormOnline).toHaveBeenCalledOnce();
    expect(savePatientFormOnline.mock.calls[0][6]).toEqual([]);
  });

  it('propagates a failed save so the queue can retain the registration for retry', async () => {
    const queuedPatient = {
      _patientRegistrationData: { currentUser: createSession('active-user') },
    } as PatientRegistration;
    const options = {
      abort: new AbortController(),
      userId: 'active-user',
      index: 0,
      items: [queuedPatient],
      dependencies: [],
      updateContent: vi.fn(async (update) => update(queuedPatient)),
    } as SyncProcessOptions<PatientRegistration>;
    const saveError = new Error('Synthetic save failure');
    const savePatientFormOnline = vi.spyOn(FormManager, 'savePatientFormOnline').mockRejectedValueOnce(saveError);

    await expect(syncPatientRegistration(queuedPatient, options)).rejects.toBe(saveError);
    expect(savePatientFormOnline).toHaveBeenCalledOnce();
  });

  it('caches every REST resource required to hydrate an existing patient', async () => {
    mockGetConfig.mockResolvedValue({
      registrationObs: { encounterTypeUuid: 'registration-encounter-type-uuid' },
    } as never);

    const urls = await getPatientUrlsToBeCached('patient-uuid');
    const baseUrl = `${globalThis.location.origin}/openmrs`;

    expect(urls).toEqual(
      expect.arrayContaining([
        `${baseUrl}/ws/fhir2/R4/Patient/patient-uuid`,
        `${baseUrl}/ws/rest/v1/person/patient-uuid?v=custom:(uuid,display,causeOfDeath,dead,deathDate,causeOfDeathNonCoded)`,
        `${baseUrl}/ws/rest/v1/person/patient-uuid/attribute?v=custom:(uuid,display,attributeType:(uuid,display,format),value)`,
        `${baseUrl}/ws/rest/v1/patient/patient-uuid/identifier?v=custom:(uuid,identifier,identifierType:(uuid,required,name),preferred)`,
        `${baseUrl}/ws/rest/v1/encounter?patient=patient-uuid&v=custom:(encounterDatetime,obs:(concept:ref,value:ref))&encounterType=registration-encounter-type-uuid`,
      ]),
    );
  });

  it('omits the registration encounter request when observations are not configured', async () => {
    mockGetConfig.mockResolvedValue({ registrationObs: { encounterTypeUuid: null } } as never);

    const urls = await getPatientUrlsToBeCached('patient-uuid');

    expect(urls.some((url) => url.includes('/encounter?'))).toBe(false);
  });

  it('surfaces a partial cache failure after attempting every resource and succeeds on retry', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/relationships', 'https://example.test/ids'];
    let relationshipsUnavailable = true;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (relationshipsUnavailable && new URL(input.toString()).pathname.endsWith('/relationships')) {
        throw new TypeError('network unavailable');
      }

      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const failedAttempt = cachePatientUrlsForOfflineUse(urls);
    await expect(failedAttempt).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 3 patient resources for offline use.',
    });
    await expect(failedAttempt).rejects.not.toThrow(/example\.test|relationships/);
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(cachePut).toHaveBeenCalledTimes(2);

    relationshipsUnavailable = false;

    await expect(cachePatientUrlsForOfflineUse(urls)).resolves.toBeUndefined();
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(6);
    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(cachePut).toHaveBeenCalledTimes(5);
  });

  it('treats a controlled service worker registration failure as a cache failure', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/relationships'];
    const mockFetch = vi.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
    mockMessageOmrsServiceWorker
      .mockResolvedValueOnce({ success: false, error: 'service worker unavailable' })
      .mockResolvedValue({ success: true });

    await expect(cachePatientUrlsForOfflineUse(urls)).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 2 patient resources for offline use.',
    });
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledOnce();
    const fetchedRequest = mockFetch.mock.calls.at(0)?.at(0);
    expect(fetchedRequest).toBeDefined();
    expect(new URL(fetchedRequest?.toString() ?? '').pathname).toBe('/relationships');
  });

  it('treats an unsuccessful HTTP response as a cache failure', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/identifiers'];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) =>
      new URL(input.toString()).pathname.endsWith('/identifiers')
        ? new Response(null, { status: 503 })
        : new Response(null, { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(cachePatientUrlsForOfflineUse(urls)).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 2 patient resources for offline use.',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not accept a stale cached 200 as a fresh update and preserves it for offline use', async () => {
    const url = 'https://example.test/patient/patient-uuid';
    cachedResponses.set(url, new Response('stale patient data', { status: 200 }));
    let networkAvailable = false;
    const mockFetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : input.toString();

      if (!networkAvailable) {
        return cachedResponses.get(requestUrl)?.clone() ?? new Response(null, { status: 503 });
      }

      return new Response('fresh patient data', { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);

    // This is the false-success behavior of a normal network-first fetch: the
    // stable URL already has a cached 200 even though the network is unavailable.
    await expect(mockFetch(url).then((response) => response.text())).resolves.toBe('stale patient data');
    mockFetch.mockClear();

    await expect(cachePatientUrlsForOfflineUse([url])).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 1 patient resources for offline use.',
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    const refreshCall = mockFetch.mock.calls.at(0);
    expect(refreshCall).toBeDefined();
    expect(refreshCall?.[0].toString()).toContain('_openmrsOfflineRefresh=');
    expect(refreshCall?.[1]).toMatchObject({
      cache: 'no-store',
      headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
    });
    await expect(cachedResponses.get(url)?.clone().text()).resolves.toBe('stale patient data');

    networkAvailable = true;

    await expect(cachePatientUrlsForOfflineUse([url])).resolves.toBeUndefined();
    await expect(cachedResponses.get(url)?.clone().text()).resolves.toBe('fresh patient data');
  });
});
