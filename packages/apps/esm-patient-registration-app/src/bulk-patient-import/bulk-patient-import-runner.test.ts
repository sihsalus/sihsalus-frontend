import { openmrsFetch } from '@openmrs/esm-framework';

import type { BulkPatientImportConfig } from '../config-schema';
import {
  assertFreshBulkPatientImportContext,
  bulkPatientImportLockName,
  bulkPatientImportSafetyErrorMessage,
  withBulkPatientImportLock,
} from './bulk-patient-import-runner';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  makeUrl: (path: string) => (path.startsWith('http') ? path : `${globalThis.openmrsBase}${path}`),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const approvedFileSha256 = 'a'.repeat(64);
const approvedBuildSha = 'b'.repeat(40);
const approvalCheckTime = '2026-08-21T12:00:00.000Z';
const approvalExpiresAt = '2026-08-21T12:30:00.000Z';

const approvedConfig: BulkPatientImportConfig = {
  enabled: true,
  approvedOrigin: globalThis.location.origin,
  approvedFileSha256,
  approvedBuildSha,
  approvalExpiresAt,
  approvedUserUuid: '11111111-1111-4111-8111-111111111111',
  approvedLocationUuid: '22222222-2222-4222-8222-222222222222',
  domicilioTarget: 'address4',
    maxRows: 250,
};

function setNavigatorLocks(lockManager?: LockManager) {
  Object.defineProperty(globalThis.navigator, 'locks', {
    configurable: true,
    value: lockManager,
  });
}

function buildSession() {
  return {
    authenticated: true,
    sessionId: 'synthetic-session',
    sessionLocation: { uuid: approvedConfig.approvedLocationUuid, display: 'Synthetic location', links: [] },
    user: {
      uuid: approvedConfig.approvedUserUuid,
      privileges: [{ uuid: 'synthetic-privilege', name: 'Manage Patients', display: 'Manage Patients' }],
      roles: [],
    },
  };
}

function buildApprovedContext() {
  return {
    config: approvedConfig,
    fileSha256: approvedFileSha256,
    userUuid: approvedConfig.approvedUserUuid,
    locationUuid: approvedConfig.approvedLocationUuid,
  };
}

describe('bulk patient import execution boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(approvalCheckTime);
    vi.clearAllMocks();
    setNavigatorLocks();
    Object.defineProperty(globalThis, 'getOpenmrsSpaBase', {
      configurable: true,
      value: () => '/openmrs/spa',
    });
    mockOpenmrsFetch.mockResolvedValue({ data: buildSession(), ok: true } as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ gitSha: approvedBuildSha }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    delete (globalThis.navigator as Navigator & { locks?: LockManager }).locks;
  });

  it('fails closed when Web Locks are unavailable', async () => {
    await expect(withBulkPatientImportLock(vi.fn())).rejects.toThrow(bulkPatientImportSafetyErrorMessage);
  });

  it('uses one identifier-free exclusive lock and refuses contention', async () => {
    const operation = vi.fn(async () => 'done');
    const request = vi.fn(async (name, options, callback) => {
      expect(name).toBe(bulkPatientImportLockName);
      expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
      return callback(null);
    });
    setNavigatorLocks({ request } as unknown as LockManager);

    await expect(withBulkPatientImportLock(operation)).rejects.toThrow(bulkPatientImportSafetyErrorMessage);
    expect(operation).not.toHaveBeenCalled();
    expect(bulkPatientImportLockName).not.toContain(approvedConfig.approvedUserUuid);
    expect(bulkPatientImportLockName).not.toContain(approvedFileSha256);
  });

  it('holds the lock until the operation settles', async () => {
    const request = vi.fn(async (_name, _options, callback) => callback({ name: bulkPatientImportLockName }));
    setNavigatorLocks({ request } as unknown as LockManager);

    await expect(withBulkPatientImportLock(async () => 'done')).resolves.toBe('done');
    expect(request).toHaveBeenCalledOnce();
  });

  it('requires the exact approved file, origin, build, user, location, and privilege', async () => {
    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).resolves.toBeUndefined();

    const sessionUrl = new URL(String(mockOpenmrsFetch.mock.calls[0][0]), globalThis.location.origin);
    expect(sessionUrl.pathname).toBe('/openmrs/ws/rest/v1/session');
    expect(sessionUrl.searchParams.has('_bulkPatientImportCheck')).toBe(true);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/openmrs/ws/rest/v1/session'),
      expect.objectContaining({
        cache: 'no-store',
        headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
        rejectOnAuthFailure: true,
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/openmrs/spa/build-info.json' }),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it.each([
    ['empty', ''],
    ['invalid', '2026-08-21T12:30:00Z'],
    ['expired', approvalCheckTime],
  ])('fails closed when approvalExpiresAt is %s', async (_label, expiresAt) => {
    await expect(
      assertFreshBulkPatientImportContext({
        ...buildApprovedContext(),
        config: { ...approvedConfig, approvalExpiresAt: expiresAt },
      }),
    ).rejects.toThrow(bulkPatientImportSafetyErrorMessage);

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fails closed if the approval expires while the fresh checks are in flight', async () => {
    mockOpenmrsFetch.mockImplementationOnce(async () => {
      vi.setSystemTime(approvalExpiresAt);
      return { data: buildSession(), ok: true } as never;
    });

    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).rejects.toThrow(
      bulkPatientImportSafetyErrorMessage,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it.each([
    ['file hash', { fileSha256: 'c'.repeat(64) }],
    ['user', { userUuid: '33333333-3333-4333-8333-333333333333' }],
    ['location', { locationUuid: '44444444-4444-4444-8444-444444444444' }],
  ])('returns only the fixed error for a mismatched %s', async (_label, override) => {
    const sensitiveDetails = 'https://clinical.invalid/patient/secret-uuid';
    mockOpenmrsFetch.mockRejectedValueOnce(new Error(sensitiveDetails));

    const outcome = assertFreshBulkPatientImportContext({
      config: approvedConfig,
      fileSha256: approvedFileSha256,
      userUuid: approvedConfig.approvedUserUuid,
      locationUuid: approvedConfig.approvedLocationUuid,
      ...override,
    });

    await expect(outcome).rejects.toThrow(bulkPatientImportSafetyErrorMessage);
    await expect(outcome).rejects.not.toThrow(sensitiveDetails);
  });

  it('fails closed when the live user loses Manage Patients', async () => {
    const session = buildSession();
    mockOpenmrsFetch.mockResolvedValue({
      data: { ...session, user: { ...session.user, privileges: [], roles: [] } },
      ok: true,
    } as never);

    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).rejects.toThrow(
      bulkPatientImportSafetyErrorMessage,
    );
  });

  it.each([
    ['authentication ends', { authenticated: false }],
    [
      'user changes',
      {
        user: {
          ...buildSession().user,
          uuid: '33333333-3333-4333-8333-333333333333',
        },
      },
    ],
    [
      'location changes',
      {
        sessionLocation: {
          ...buildSession().sessionLocation,
          uuid: '44444444-4444-4444-8444-444444444444',
        },
      },
    ],
  ])('fails closed when the live session %s', async (_label, sessionOverride) => {
    mockOpenmrsFetch.mockResolvedValue({ data: { ...buildSession(), ...sessionOverride }, ok: true } as never);

    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).rejects.toThrow(
      bulkPatientImportSafetyErrorMessage,
    );
  });

  it('fails closed when the served build no longer matches the approval', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ gitSha: 'c'.repeat(40) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).rejects.toThrow(
      bulkPatientImportSafetyErrorMessage,
    );
  });

  it.each([
    ['name', 'System Developer'],
    ['display', 'System Developer'],
    ['name', 'Application: Has Super User Privileges'],
    ['display', 'Application: Has Super User Privileges'],
  ] as const)('accepts the superuser role when %s matches %s', async (field, roleName) => {
    const session = buildSession();
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        ...session,
        user: {
          ...session.user,
          privileges: [],
          roles: [
            {
              uuid: '55555555-5555-4555-8555-555555555555',
              name: field === 'name' ? roleName : 'Synthetic role',
              display: field === 'display' ? roleName : 'Synthetic role',
            },
          ],
        },
      },
      ok: true,
    } as never);

    await expect(assertFreshBulkPatientImportContext(buildApprovedContext())).resolves.toBeUndefined();
  });
});
