import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type APIRequestContext } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPatient, getVisit } from '../laboratory/commands';
import { type Patient, type Visit } from '../laboratory/commands/types';
import { laboratoryFixtureRequiredPrivileges, laboratoryOrderFixture } from '../laboratory/core/fixture-config';
import { withLaboratoryFixture } from '../laboratory/core/synthetic-fixtures';
import { PrivateFixtureJournal } from './e2e-fixture-journal';
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
vi.mock('../laboratory/commands', () => ({
  getPatient: vi.fn(async (_api, uuid) => ({ uuid })),
  getVisit: vi.fn(async (_api, uuid) => ({ uuid })),
}));

const environment: NodeJS.ProcessEnv = {
  E2E_GATE_TARGET: 'DEV',
  E2E_LABORATORY_SUPERVISED_TARGET: 'DEV',
  E2E_API_BASE_URL: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
  E2E_BASE_URL: 'http://127.0.0.1:8080/openmrs/spa',
  E2E_LOGIN_DEFAULT_LOCATION_UUID: '11111111-1111-4111-8111-111111111111',
  E2E_USER_ADMIN_USERNAME: 'unit-test-only',
  E2E_USER_ADMIN_PASSWORD: 'unit-test-only',
  E2E_FIXTURE_EXPECTED_SHA: '0123456789abcdef0123456789abcdef01234567',
  E2E_FIXTURE_REQUIRED_PRIVILEGES: JSON.stringify(laboratoryFixtureRequiredPrivileges),
};
const patientUuid = '22222222-2222-4222-8222-222222222222';
const visitUuid = '33333333-3333-4333-8333-333333333333';
const attempt = { workerIndex: 0, retry: 0 };
const directories: string[] = [];
function setup() {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'laboratory-adapter-unit-'));
  directories.push(root);
  const api = {
    post: vi.fn().mockResolvedValue({ ok: () => true, status: () => 200 }),
    get: vi.fn(),
  } as unknown as APIRequestContext;
  return { root, api };
}
function journals(root: string) {
  return readdirSync(root).map((name) => path.join(root, name));
}
function readRetainedJournal(directory: string | undefined) {
  if (!directory) throw new Error('Expected a retained fixture journal');
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
  doubles.configurations.length = 0;
  doubles.create.mockResolvedValue({ patientUuid, visitUuid });
  doubles.cleanup.mockResolvedValue(undefined);
  vi.mocked(getPatient).mockImplementation(async (_api, uuid) => ({ uuid }) as Patient);
  vi.mocked(getVisit).mockImplementation(async (_api, uuid) => ({ uuid }) as Visit);
});
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('laboratory adapter with real private local journals', () => {
  it('establishes the exact session location before provisioning and reuses the single patient/visit pair', async () => {
    const { api, root } = setup();
    const use = vi.fn().mockResolvedValue(undefined);
    await withLaboratoryFixture(api, attempt, use, environment, root);

    expect(api.post).toHaveBeenCalledOnce();
    expect(api.post).toHaveBeenCalledWith(`${environment.E2E_API_BASE_URL}/ws/rest/v1/session`, {
      data: { sessionLocation: environment.E2E_LOGIN_DEFAULT_LOCATION_UUID, locale: 'en' },
      maxRedirects: 0,
      maxRetries: 0,
    });
    const createCall = doubles.create.mock.invocationCallOrder[0];
    if (createCall === undefined) throw new Error('Expected fixture provisioning');
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(createCall);
    expect(doubles.create).toHaveBeenCalledExactlyOnceWith('outpatient');
    expect(use).toHaveBeenCalledExactlyOnceWith({ patient: { uuid: patientUuid }, visit: { uuid: visitUuid } });
    expect(doubles.cleanup).toHaveBeenCalledOnce();
    expect(doubles.configurations[0]).toMatchObject({
      E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: laboratoryOrderFixture.identifierSourceUuid,
      E2E_FIXTURE_IDENTIFIER_TYPE_UUID: laboratoryOrderFixture.identifierTypeUuid,
      E2E_FIXTURE_VISIT_TYPE_UUID: laboratoryOrderFixture.visitTypeUuid,
      E2E_FIXTURE_EXPECTED_SHA: environment.E2E_FIXTURE_EXPECTED_SHA,
    });
    expect(readRetainedJournal(journals(root)[0])).toEqual({ pending: false });
  });

  it('attempts recoverable cleanup after a partial setup failure and sanitizes its external error', async () => {
    const { api, root } = setup();
    doubles.create.mockRejectedValue(new Error('DO_NOT_LOG transport Authorization: private'));
    const use = vi.fn();
    const failure = withLaboratoryFixture(api, attempt, use, environment, root);
    await expect(failure).rejects.toThrow('LABORATORY_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL');
    await expect(failure).rejects.not.toThrow('DO_NOT_LOG');
    expect(use).not.toHaveBeenCalled();
    expect(doubles.cleanup).toHaveBeenCalledOnce();
    expect(readRetainedJournal(journals(root)[0])).toEqual({ pending: false });
  });

  it('retains pending state and both failures when a case and its cleanup fail', async () => {
    const { api, root } = setup();
    const assertion = new Error('synthetic case assertion');
    doubles.cleanup.mockRejectedValue(new Error('DO_NOT_LOG cleanup details'));
    const failure = await withLaboratoryFixture(
      api,
      attempt,
      async () => {
        throw assertion;
      },
      environment,
      root,
    ).catch((error: AggregateError) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    if (!(failure instanceof AggregateError)) throw new Error('Expected both fixture failures');
    expect(failure.errors).toHaveLength(2);
    expect(failure.errors[0]).toBe(assertion);
    expect(failure.errors[1].message).toBe('LABORATORY_FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(readRetainedJournal(journals(root)[0])).toEqual({ pending: true });
  });

  it('gives each retry a different patient and journal without deleting the earlier state', async () => {
    const { api, root } = setup();
    const use = vi.fn().mockRejectedValueOnce(new Error('first attempt')).mockResolvedValueOnce(undefined);
    await expect(withLaboratoryFixture(api, attempt, use, environment, root)).rejects.toThrow('first attempt');
    const first = journals(root)[0];
    doubles.create.mockResolvedValue({ patientUuid: '44444444-4444-4444-8444-444444444444', visitUuid });
    await withLaboratoryFixture(api, { ...attempt, retry: 1 }, use, environment, root);
    expect(journals(root)).toHaveLength(2);
    expect(journals(root)).toContain(first);
    expect(use).toHaveBeenNthCalledWith(1, { patient: { uuid: patientUuid }, visit: { uuid: visitUuid } });
    expect(use).toHaveBeenNthCalledWith(2, {
      patient: { uuid: '44444444-4444-4444-8444-444444444444' },
      visit: { uuid: visitUuid },
    });
    for (const directory of journals(root)) expect(readRetainedJournal(directory)).toEqual({ pending: false });
  });

  it.each([
    'session',
    'provisioning',
    'patient',
    'visit',
  ])('stops dependent writes after %s authorization is denied', async (stage) => {
    const { api, root } = setup();
    if (stage === 'session') vi.mocked(api.post).mockResolvedValue({ ok: () => false, status: () => 403 } as never);
    else if (stage === 'provisioning')
      doubles.create.mockRejectedValue(new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL'));
    else
      vi.mocked(stage === 'patient' ? getPatient : getVisit).mockRejectedValue(
        new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL'),
      );
    await expect(withLaboratoryFixture(api, attempt, vi.fn(), environment, root)).rejects.toThrow(
      'LABORATORY_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL',
    );
    expect(doubles.cleanup).not.toHaveBeenCalled();
    if (stage === 'session') expect(doubles.create).not.toHaveBeenCalled();
    expect(readRetainedJournal(journals(root)[0])).toEqual({ pending: stage !== 'session' });
  });

  it.each([
    { CI: 'true' },
    { GITHUB_ACTIONS: 'true' },
    { E2E_LABORATORY_SUPERVISED_TARGET: '' },
    { E2E_LABORATORY_SUPERVISED_TARGET: 'QLTY' },
    { E2E_FIXTURE_EXPECTED_SHA: '' },
    { E2E_FIXTURE_EXPECTED_SHA: 'main' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: '' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: '["Get Patients"]' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: JSON.stringify([...laboratoryFixtureRequiredPrivileges, null]) },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: JSON.stringify([...laboratoryFixtureRequiredPrivileges, 'invalid\nprivilege']) },
    { E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: patientUuid },
    { E2E_FIXTURE_IDENTIFIER_TYPE_UUID: patientUuid },
    { E2E_FIXTURE_VISIT_TYPE_UUID: patientUuid },
    { E2E_API_BASE_URL: 'https://production.invalid/openmrs' },
    { E2E_USER_ADMIN_PASSWORD: '' },
  ])('rejects CI or incomplete/unapproved configuration before requests or journals', async (override) => {
    const { api, root } = setup();
    await expect(withLaboratoryFixture(api, attempt, vi.fn(), { ...environment, ...override }, root)).rejects.toThrow();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(doubles.create).not.toHaveBeenCalled();
    expect(journals(root)).toEqual([]);
  });
});
