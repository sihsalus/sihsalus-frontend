import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type APIResponse, type TestInfo } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivateFixtureJournal } from './e2e-fixture-journal';
import { nativeInterconsultationMetadata, withNativeSyntheticFixture } from './e2e-native-synthetic-fixtures';
import { FixtureAuthorizationError } from './e2e-synthetic-fixtures';

const doubles = vi.hoisted(() => ({ create: vi.fn(), cleanup: vi.fn(), configurations: [] as NodeJS.ProcessEnv[] }));
vi.mock('./e2e-synthetic-fixtures', async (original) => {
  const actual = await original<typeof import('./e2e-synthetic-fixtures')>();
  return {
    ...actual,
    SyntheticFixtures: class {
      constructor(
        _api: unknown,
        private journal: PrivateFixtureJournal,
        environment: NodeJS.ProcessEnv,
      ) {
        doubles.configurations.push(environment);
        journal.save({ pending: false });
      }
      async create(label: string) {
        this.journal.save({ pending: true });
        return doubles.create(label);
      }
      async cleanup() {
        await doubles.cleanup();
        this.journal.save({ pending: false });
      }
    },
  };
});
const environment: NodeJS.ProcessEnv = {
  E2E_GATE_TARGET: 'DEV',
  E2E_NATIVE_SUPERVISED_TARGET: 'DEV',
  E2E_API_BASE_URL: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
  E2E_BASE_URL: 'http://127.0.0.1:8080/openmrs/spa',
  E2E_LOGIN_DEFAULT_LOCATION_UUID: '11111111-1111-4111-8111-111111111111',
  E2E_USER_ADMIN_USERNAME: 'unit-test-only',
  E2E_USER_ADMIN_PASSWORD: 'unit-test-only',
};
const patientUuid = '22222222-2222-4222-8222-222222222222';
const visitUuid = '33333333-3333-4333-8333-333333333333';
const providerUuid = '44444444-4444-4444-8444-444444444444';
const familyName = 'SALUS UNITTEST Chart';
const attempt = {
  project: { name: 'desktop' } as TestInfo['project'],
  workerIndex: 0,
  retry: 0,
  skip: vi.fn(),
  errors: [] as TestInfo['errors'],
};
const directories: string[] = [];
function response(status: number, value: unknown = {}) {
  return { ok: () => status >= 200 && status < 300, status: () => status, json: async () => value } as APIResponse;
}
function setup() {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'native-adapter-unit-'));
  directories.push(root);
  const api = {
    post: vi.fn().mockResolvedValue(response(200)),
    get: vi.fn(async (url: string) => {
      if (url.includes(`/encountertype/${nativeInterconsultationMetadata.requestEncounterTypeUuid}`))
        return response(200, { uuid: nativeInterconsultationMetadata.requestEncounterTypeUuid, retired: false });
      if (url.includes(`/concept/${nativeInterconsultationMetadata.destinationConceptUuid}`))
        return response(200, {
          uuid: nativeInterconsultationMetadata.destinationConceptUuid,
          display: 'Consulta Ambulatoria',
          retired: false,
        });
      if (url.includes(`/concept/${nativeInterconsultationMetadata.destinationConceptSetUuid}`))
        return response(200, {
          uuid: nativeInterconsultationMetadata.destinationConceptSetUuid,
          retired: false,
          setMembers: [{ uuid: nativeInterconsultationMetadata.destinationConceptUuid }],
        });
      if (url.endsWith('/session')) return response(200, { currentProvider: { uuid: providerUuid } });
      return response(200, {
        uuid: url.split('/patient/')[1]?.split('?')[0],
        person: { names: [{ givenName: 'SYNTHETIC', familyName }] },
      });
    }),
  } as unknown as APIRequestContext;
  return { root, api };
}
function journals(root: string) {
  return readdirSync(root).map((name) => path.join(root, name));
}
function retained(directory: string | undefined) {
  if (!directory) throw new Error('Expected retained journal');
  expect(existsSync(path.join(directory, 'writer.lock'))).toBe(false);
  const journal = new PrivateFixtureJournal(directory);
  try {
    return journal.read();
  } finally {
    journal.close();
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  attempt.errors.length = 0;
  doubles.configurations.length = 0;
  doubles.create.mockResolvedValue({ patientUuid, visitUuid });
  doubles.cleanup.mockResolvedValue(undefined);
});
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('opt-in native fixture lifecycle with real private local journals', () => {
  it('establishes the exact Spanish session and provisions one foundation-owned patient/visit', async () => {
    const { api, root } = setup();
    const use = vi.fn().mockResolvedValue(undefined);
    await withNativeSyntheticFixture(api, attempt, use, environment, root);
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`${environment.E2E_API_BASE_URL}/ws/rest/v1/session`, {
      data: { sessionLocation: environment.E2E_LOGIN_DEFAULT_LOCATION_UUID, locale: 'es' },
      maxRedirects: 0,
      maxRetries: 0,
    });
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(
      doubles.create.mock.invocationCallOrder[0] ?? 0,
    );
    expect(doubles.create).toHaveBeenCalledExactlyOnceWith('outpatient');
    expect(doubles.configurations).toEqual([environment]);
    expect(use).toHaveBeenCalledExactlyOnceWith({
      patientUuid,
      visitUuid,
      familyName,
      providerUuid,
      locationUuid: environment.E2E_LOGIN_DEFAULT_LOCATION_UUID,
      serviceConcept: { uuid: nativeInterconsultationMetadata.destinationConceptUuid, display: 'Consulta Ambulatoria' },
      encounterTypeUuid: nativeInterconsultationMetadata.requestEncounterTypeUuid,
    });
    expect(doubles.cleanup).toHaveBeenCalledOnce();
    expect(retained(journals(root)[0])).toEqual({ pending: false });
  });

  it.each(['tablet', 'mobile'])('skips %s before requests, journals or provisioning', async (name) => {
    const { api, root } = setup();
    const use = vi.fn();
    await withNativeSyntheticFixture(api, { ...attempt, project: { ...attempt.project, name } }, use, {}, root);
    expect(attempt.skip).toHaveBeenCalledWith(true, expect.any(String));
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(doubles.create).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
    expect(journals(root)).toEqual([]);
  });

  it.each([{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }])(
    'blocks CI before requests or journal creation: %j',
    async (override) => {
      const { api, root } = setup();
      await expect(
        withNativeSyntheticFixture(api, attempt, vi.fn(), { ...environment, ...override }, root),
      ).rejects.toThrow('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
      expect(api.post).not.toHaveBeenCalled();
      expect(api.get).not.toHaveBeenCalled();
      expect(doubles.create).not.toHaveBeenCalled();
      expect(journals(root)).toEqual([]);
    },
  );

  it.each(['', 'QLTY'])('requires supervision of the configured target before requests: %s', async (target) => {
    const { api, root } = setup();
    await expect(
      withNativeSyntheticFixture(api, attempt, vi.fn(), { ...environment, E2E_NATIVE_SUPERVISED_TARGET: target }, root),
    ).rejects.toThrow('NATIVE_FIXTURE_SUPERVISION_REQUIRED');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(journals(root)).toEqual([]);
  });

  it.each([
    ['encountertype', { uuid: 'different', retired: false }],
    ['encountertype', { uuid: nativeInterconsultationMetadata.requestEncounterTypeUuid, retired: true }],
    [
      'concept-set',
      { uuid: nativeInterconsultationMetadata.destinationConceptSetUuid, retired: false, setMembers: [] },
    ],
    [
      'service',
      { uuid: nativeInterconsultationMetadata.destinationConceptUuid, retired: true, display: 'Consulta Ambulatoria' },
    ],
  ])('rejects incompatible %s metadata without clinical provisioning or catalogue fallback', async (kind, body) => {
    const { api, root } = setup();
    const original = vi.mocked(api.get).getMockImplementation();
    vi.mocked(api.get).mockImplementation((url, options) => {
      const selected =
        kind === 'encountertype'
          ? url.includes('/encountertype/')
          : url.includes(
              `/concept/${kind === 'concept-set' ? nativeInterconsultationMetadata.destinationConceptSetUuid : nativeInterconsultationMetadata.destinationConceptUuid}`,
            );
      if (selected) return Promise.resolve(response(200, body));
      if (!original) throw new Error('Expected API double');
      return original(url, options);
    });
    await expect(withNativeSyntheticFixture(api, attempt, vi.fn(), environment, root)).rejects.toThrow(
      'NATIVE_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL',
    );
    expect(doubles.create).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1); // Session configuration only.
    expect(
      vi.mocked(api.get).mock.calls.some(([url]) => url.includes('?q=') || url.includes('/encountertype/39da')),
    ).toBe(false);
    expect(retained(journals(root)[0])).toEqual({ pending: false });
  });

  it('attempts recoverable cleanup after partial provisioning failure without exposing transport details', async () => {
    const { api, root } = setup();
    doubles.create.mockRejectedValue(new Error('DO_NOT_LOG transport Authorization: private'));
    const use = vi.fn();
    const failure = withNativeSyntheticFixture(api, attempt, use, environment, root);
    await expect(failure).rejects.toThrow('NATIVE_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL');
    await expect(failure).rejects.not.toThrow('DO_NOT_LOG');
    expect(use).not.toHaveBeenCalled();
    expect(doubles.cleanup).toHaveBeenCalledOnce();
    expect(retained(journals(root)[0])).toEqual({ pending: false });
  });

  it('preserves the assertion and pending recovery state when cleanup also fails', async () => {
    const { api, root } = setup();
    const assertion = new Error('synthetic assertion');
    doubles.cleanup.mockRejectedValue(new Error('DO_NOT_LOG cleanup details'));
    const failure = await withNativeSyntheticFixture(
      api,
      attempt,
      async () => {
        throw assertion;
      },
      environment,
      root,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    if (!(failure instanceof AggregateError)) throw new Error('Expected both failures');
    expect(failure.errors).toHaveLength(2);
    expect(failure.errors[0]).toBe(assertion);
    expect(failure.errors[1].message).toBe('NATIVE_FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(retained(journals(root)[0])).toEqual({ pending: true });
  });

  it('isolates a retry without removing the previous attempt journal', async () => {
    const { api, root } = setup();
    const use = vi.fn().mockRejectedValueOnce(new Error('first attempt')).mockResolvedValueOnce(undefined);
    await expect(withNativeSyntheticFixture(api, attempt, use, environment, root)).rejects.toThrow('first attempt');
    const first = journals(root)[0];
    const nextPatient = '55555555-5555-4555-8555-555555555555';
    doubles.create.mockResolvedValue({ patientUuid: nextPatient, visitUuid });
    await withNativeSyntheticFixture(api, { ...attempt, retry: 1 }, use, environment, root);
    expect(journals(root)).toHaveLength(2);
    expect(journals(root)).toContain(first);
    expect(use.mock.calls[0]?.[0].patientUuid).toBe(patientUuid);
    expect(use.mock.calls[1]?.[0].patientUuid).toBe(nextPatient);
    for (const directory of journals(root)) expect(retained(directory)).toEqual({ pending: false });
  });

  it('recognizes an authorization failure recorded by Playwright when fixture use resolves', async () => {
    const { api, root } = setup();
    await withNativeSyntheticFixture(
      api,
      attempt,
      async () => {
        attempt.errors.push({ message: 'Polling failed: FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL' });
      },
      environment,
      root,
    );
    expect(doubles.cleanup).not.toHaveBeenCalled();
    expect(retained(journals(root)[0])).toEqual({ pending: true });
  });

  it.each(['session', 'provisioning', 'read', 'case'])(
    'stops cleanup writes after authorization denial in %s',
    async (stage) => {
      const { api, root } = setup();
      const denied = new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
      if (stage === 'session') vi.mocked(api.post).mockResolvedValue(response(403));
      if (stage === 'provisioning') doubles.create.mockRejectedValue(denied);
      if (stage === 'read') {
        const original = vi.mocked(api.get).getMockImplementation();
        if (!original) throw new Error('Expected API double');
        vi.mocked(api.get).mockImplementation((url, options) =>
          url.includes('/patient/') ? Promise.resolve(response(401)) : original(url, options),
        );
      }
      const use = stage === 'case' ? vi.fn().mockRejectedValue(denied) : vi.fn();
      await expect(withNativeSyntheticFixture(api, attempt, use, environment, root)).rejects.toThrow();
      expect(doubles.cleanup).not.toHaveBeenCalled();
      if (stage === 'session') expect(doubles.create).not.toHaveBeenCalled();
      expect(retained(journals(root)[0])).toEqual({ pending: stage !== 'session' });
    },
  );
});
