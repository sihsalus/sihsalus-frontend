import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { type FixtureJournal } from './e2e-fixture-journal';
import { SyntheticFixtures } from './e2e-synthetic-fixtures';

const location = '11111111-1111-4111-8111-111111111111';
const source = '22222222-2222-4222-8222-222222222222';
const identifierType = '33333333-3333-4333-8333-333333333333';
const visitType = '44444444-4444-4444-8444-444444444444';
const provider = '55555555-5555-4555-8555-555555555555';
const sha = '0123456789abcdef0123456789abcdef01234567';
const environment: NodeJS.ProcessEnv = {
  E2E_GATE_TARGET: 'DEV',
  E2E_API_BASE_URL: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
  E2E_BASE_URL: 'http://127.0.0.1:8080/openmrs/spa',
  E2E_LOGIN_DEFAULT_LOCATION_UUID: location,
  E2E_USER_ADMIN_USERNAME: 'unit-test-only',
  E2E_USER_ADMIN_PASSWORD: 'unit-test-only',
  E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: source,
  E2E_FIXTURE_IDENTIFIER_TYPE_UUID: identifierType,
  E2E_FIXTURE_VISIT_TYPE_UUID: visitType,
  E2E_FIXTURE_EXPECTED_SHA: sha,
  E2E_FIXTURE_REQUIRED_PRIVILEGES: JSON.stringify(['Fixture Test Permission']),
};

interface TestState {
  patients: Array<{
    label: string;
    identifier?: string;
    patientAttempted?: boolean;
    uuid?: string;
    personUuid?: string;
    visitAttempted?: boolean;
    visitUuid?: string;
    cleaned?: boolean;
  }>;
}
class MemoryJournal implements FixtureJournal {
  value: unknown;
  snapshots: unknown[] = [];
  failWhen?: (state: TestState) => boolean;
  read() {
    return structuredClone(this.value);
  }
  save(value: unknown) {
    if (this.failWhen?.(value as TestState)) throw new Error('SIMULATED_JOURNAL_WRITE_FAILURE');
    this.value = structuredClone(value);
    this.snapshots.push(structuredClone(value));
  }
  records() {
    return (this.value as TestState).patients;
  }
}
interface Entity {
  uuid: string;
  voided: boolean;
  names?: Array<{ givenName: string; familyName: string }>;
  identifiers?: Array<{ identifier: string; identifierType: { uuid: string } }>;
  person?: { uuid: string; voided?: boolean; names?: Array<{ givenName: string; familyName: string }> };
  patient?: { uuid: string };
  location?: { uuid: string };
  visitType?: { uuid: string };
}
function response(status: number, value: unknown = {}) {
  return {
    status: () => status,
    ok: () => status >= 200 && status < 300,
    json: async () => structuredClone(value),
  } as APIResponse;
}
type Call = { method: string; url: URL; data?: unknown };
class Backend {
  entities = new Map<string, Entity>();
  calls: Call[] = [];
  override?: (call: Call) => APIResponse | undefined;
  loseResponse?: 'patient' | 'visit';
  sequence = 0;
  constructor(readonly journal: MemoryJournal) {}
  uuid() {
    return `00000000-0000-4000-8000-${String(++this.sequence).padStart(12, '0')}`;
  }
  api = {
    get: vi.fn(async (url: string) => this.handle({ method: 'get', url: new URL(url) })),
    post: vi.fn(async (url: string, options: { data: unknown }) =>
      this.handle({ method: 'post', url: new URL(url), data: options.data }),
    ),
    delete: vi.fn(async (url: string, options: { data: unknown }) =>
      this.handle({ method: 'delete', url: new URL(url), data: options.data }),
    ),
  } as unknown as APIRequestContext;
  handle(call: Call): APIResponse {
    this.calls.push(call);
    const overridden = this.override?.(call);
    if (overridden) return overridden;
    if (call.url.pathname.endsWith('/build-info.json')) return response(200, { gitSha: sha });
    const resource = call.url.pathname.split('/ws/rest/v1/')[1] ?? '';
    if (resource === 'session')
      return response(200, {
        authenticated: true,
        currentProvider: { uuid: provider, retired: false },
        sessionLocation: { uuid: location },
        user: { retired: false, privileges: [{ name: 'Fixture Test Permission' }] },
      });
    if (resource === `location/${location}`) return response(200, { uuid: location, retired: false });
    if (resource === `idgen/identifiersource/${source}`)
      return response(200, { uuid: source, retired: false, identifierType: { uuid: identifierType } });
    if (resource === `patientidentifiertype/${identifierType}`)
      return response(200, { uuid: identifierType, retired: false, locationBehavior: 'REQUIRED' });
    if (resource === 'patientidentifiertype')
      return response(200, { results: [{ uuid: identifierType, retired: false, required: true }] });
    if (resource === `visittype/${visitType}`) return response(200, { uuid: visitType, retired: false });
    if (resource === `idgen/identifiersource/${source}/identifier`)
      return response(200, { identifier: `E2E-${++this.sequence}` });
    if (call.method === 'post' && resource === 'patient') {
      expect(this.journal.records().some((record) => record.patientAttempted && !record.uuid)).toBe(true);
      const data = call.data as {
        person: { names: NonNullable<Entity['person']>['names'] };
        identifiers: Array<{ identifier: string; identifierType: string }>;
      };
      const patient: Entity = {
        uuid: this.uuid(),
        voided: false,
        person: { uuid: this.uuid(), voided: false, names: data.person.names },
        identifiers: data.identifiers.map((identifier) => ({
          identifier: identifier.identifier,
          identifierType: { uuid: identifier.identifierType },
        })),
      };
      this.entities.set(`patient/${patient.uuid}`, patient);
      if (patient.person)
        this.entities.set(`person/${patient.person.uuid}`, {
          uuid: patient.person.uuid,
          voided: false,
          names: patient.person.names,
        });
      if (this.loseResponse === 'patient') {
        this.loseResponse = undefined;
        throw new Error('private backend body must not be logged');
      }
      return response(201, patient);
    }
    if (call.method === 'post' && resource === 'visit') {
      expect(this.journal.records().some((record) => record.visitAttempted && !record.visitUuid)).toBe(true);
      const data = call.data as { patient: string; location: string; visitType: string };
      const visit: Entity = {
        uuid: this.uuid(),
        voided: false,
        patient: { uuid: data.patient },
        location: { uuid: data.location },
        visitType: { uuid: data.visitType },
      };
      this.entities.set(`visit/${visit.uuid}`, visit);
      if (this.loseResponse === 'visit') {
        this.loseResponse = undefined;
        throw new Error('private backend body must not be logged');
      }
      return response(201, visit);
    }
    if (call.method === 'delete') {
      const entity = this.entities.get(resource);
      if (!entity) return response(404);
      entity.voided = true;
      if (resource.startsWith('patient/') && entity.person) {
        entity.person.voided = true;
        const person = this.entities.get(`person/${entity.person.uuid}`);
        if (person) person.voided = true;
      }
      return response(204);
    }
    const entity = this.entities.get(resource);
    if (entity) return response(200, entity);
    if (['patient', 'visit', 'order', 'encounter', 'obs'].includes(resource)) {
      const matches = [...this.entities.entries()]
        .filter(
          ([key, candidate]) =>
            key.startsWith(`${resource}/`) &&
            (!call.url.searchParams.has('identifier') ||
              candidate.identifiers?.some(
                ({ identifier }) => identifier === call.url.searchParams.get('identifier'),
              )) &&
            (!call.url.searchParams.has('patient') ||
              candidate.patient?.uuid === call.url.searchParams.get('patient') ||
              candidate.person?.uuid ===
                this.entities.get(`patient/${call.url.searchParams.get('patient')}`)?.person?.uuid),
        )
        .map(([, candidate]) => candidate);
      const start = Number(call.url.searchParams.get('startIndex') ?? 0);
      return response(200, {
        results: matches.slice(start, start + 100),
        links: matches.length > start + 100 ? [{ rel: 'next', uri: 'https://unapproved.invalid/never-follow' }] : [],
      });
    }
    return response(404);
  }
  posts(resource: string) {
    return this.calls.filter((call) => call.method === 'post' && call.url.pathname.endsWith(`/${resource}`));
  }
  deletes() {
    return this.calls.filter((call) => call.method === 'delete');
  }
}
function harness() {
  const journal = new MemoryJournal();
  const backend = new Backend(journal);
  return { journal, backend, fixtures: new SyntheticFixtures(backend.api, journal, environment) };
}

describe('recoverable synthetic fixture foundation (mock backend only)', () => {
  it('journals two distinct patients and visits, cleans them, and does not delete twice', async () => {
    const { fixtures, backend, journal } = harness();
    const first = await fixtures.create('outpatient');
    const second = await fixtures.create('appointments');
    expect(first.patientUuid).not.toBe(second.patientUuid);
    expect(backend.posts('patient')).toHaveLength(2);
    expect(backend.posts('person')).toHaveLength(0);
    for (const [resource, patient] of backend.entities) {
      if (resource.startsWith('patient/'))
        expect(patient.person?.names?.[0]?.familyName.length).toBeLessThanOrEqual(50);
    }
    await fixtures.cleanup();
    expect(journal.records().every(({ cleaned }) => cleaned)).toBe(true);
    expect(backend.deletes()).toHaveLength(4);
    await fixtures.cleanup();
    expect(backend.deletes()).toHaveLength(4);
    expect(JSON.stringify(journal.value)).not.toContain('unit-test-only');
  });

  it.each([
    'patient',
    'visit',
  ] as const)('recovers a lost %s response without duplicating a create', async (resource) => {
    const { fixtures, backend, journal } = harness();
    backend.loseResponse = resource;
    const failed = fixtures.create('outpatient');
    await expect(failed).rejects.toThrow('FIXTURE_NETWORK_FAILURE_RETAIN_JOURNAL');
    await expect(failed).rejects.not.toThrow(/private backend/);
    const resumed = new SyntheticFixtures(backend.api, journal, environment);
    await resumed.create('outpatient');
    expect(backend.posts(resource)).toHaveLength(1);
    await resumed.cleanup();
    expect(journal.records()[0]?.cleaned).toBe(true);
  });

  it('does not repeat a rejected or unresolved patient POST', async () => {
    const { fixtures, backend, journal } = harness();
    backend.override = ({ method, url }) =>
      method === 'post' && url.pathname.endsWith('/patient') ? response(400) : undefined;
    await expect(fixtures.create('outpatient')).rejects.toThrow('FIXTURE_HTTP_400_RETAIN_JOURNAL');
    backend.override = undefined;
    const resumed = new SyntheticFixtures(backend.api, journal, environment);
    await expect(resumed.create('outpatient')).rejects.toThrow('FIXTURE_PATIENT_CREATE_UNRESOLVED');
    await expect(resumed.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.posts('patient')).toHaveLength(1);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
  });

  it('never issues a patient POST if its write-ahead journal fails', async () => {
    const { fixtures, backend, journal } = harness();
    journal.failWhen = (state) => state.patients.some((record) => record.patientAttempted);
    await expect(fixtures.create('outpatient')).rejects.toThrow('SIMULATED_JOURNAL_WRITE_FAILURE');
    expect(backend.posts('patient')).toHaveLength(0);
  });

  it('recovers if persistence fails after a successful patient response', async () => {
    const { fixtures, backend, journal } = harness();
    journal.failWhen = (state) => state.patients.some((record) => Boolean(record.uuid));
    await expect(fixtures.create('outpatient')).rejects.toThrow('SIMULATED_JOURNAL_WRITE_FAILURE');
    journal.failWhen = undefined;
    expect(journal.records()[0]?.uuid).toBeUndefined();
    const resumed = new SyntheticFixtures(backend.api, journal, environment);
    await resumed.create('outpatient');
    expect(backend.posts('patient')).toHaveLength(1);
    await resumed.cleanup();
  });

  it('refuses a journal for a different target or schema before making API calls', () => {
    const { backend, journal } = harness();
    expect(
      () =>
        new SyntheticFixtures(backend.api, journal, {
          ...environment,
          E2E_GATE_TARGET: 'QLTY',
          E2E_API_BASE_URL: 'https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs',
        }),
    ).toThrow(/TARGET_OR_SCHEMA_MISMATCH/);
    journal.value = { schemaVersion: 1 };
    expect(() => new SyntheticFixtures(backend.api, journal, environment)).toThrow(/TARGET_OR_SCHEMA_MISMATCH/);
    expect(backend.calls).toEqual([]);
  });

  it.each([
    { E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: undefined },
    { E2E_FIXTURE_VISIT_TYPE_UUID: 'not-a-uuid' },
    { E2E_FIXTURE_EXPECTED_SHA: 'short' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: '[]' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: 'invalid-json' },
  ])('requires explicit metadata, SHA and reviewed privilege configuration', (overrides) => {
    const { backend } = harness();
    expect(() => new SyntheticFixtures(backend.api, new MemoryJournal(), { ...environment, ...overrides })).toThrow();
    expect(backend.calls).toEqual([]);
  });

  it.each([401, 403])('does not create anything after HTTP %s authentication failure', async (status) => {
    const { fixtures, backend } = harness();
    backend.override = ({ url }) => (url.pathname.endsWith('/session') ? response(status) : undefined);
    await expect(fixtures.create('outpatient')).rejects.toThrow('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
    expect(backend.calls.some(({ method }) => method === 'post')).toBe(false);
  });

  it.each([
    ['/build-info.json', { gitSha: 'f'.repeat(40) }],
    ['/session', { authenticated: false }],
    [
      '/session',
      {
        authenticated: true,
        currentProvider: { uuid: provider, retired: false },
        sessionLocation: { uuid: location },
        user: { retired: false, privileges: [] },
      },
    ],
    [`/visittype/${visitType}`, { uuid: visitType, retired: true }],
    [`/idgen/identifiersource/${source}`, { uuid: source, retired: false, identifierType: { uuid: provider } }],
    ['/patientidentifiertype', { results: [{ uuid: provider, retired: false, required: true }] }],
  ] as const)('rejects incompatible preflight state at %s without fallback metadata', async (suffix, body) => {
    const { fixtures, backend } = harness();
    backend.override = ({ url }) => (url.pathname.endsWith(suffix) ? response(200, body) : undefined);
    await expect(fixtures.create('outpatient')).rejects.toThrow();
    expect(backend.calls.some(({ method }) => method === 'post')).toBe(false);
  });

  it('does not touch a patient whose ownership marker changed', async () => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    const person = backend.entities.get(`patient/${created.patientUuid}`)?.person;
    if (!person) throw new Error('Missing mocked person');
    person.names = [{ givenName: 'SYNTHETIC', familyName: 'different marker' }];
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes()).toEqual([]);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
  });

  it('collects all dependency pages before voiding children, never following a next URL', async () => {
    const { fixtures, backend } = harness();
    const created = await fixtures.create('outpatient');
    for (let index = 0; index < 101; index++) {
      const uuid = backend.uuid();
      backend.entities.set(`order/${uuid}`, { uuid, voided: false, patient: { uuid: created.patientUuid } });
    }
    await fixtures.cleanup();
    expect(backend.deletes().filter(({ url }) => url.pathname.includes('/order/'))).toHaveLength(101);
    expect(backend.deletes().at(-1)?.url.pathname).toBe(`/openmrs/ws/rest/v1/patient/${created.patientUuid}`);
    expect(
      backend.calls.every(({ url }) => ['gidis-hsc-dev.inf.pucp.edu.pe', '127.0.0.1'].includes(url.hostname)),
    ).toBe(true);
    expect(
      backend.calls.some(({ url }) => url.pathname.endsWith('/order') && url.searchParams.get('startIndex') === '100'),
    ).toBe(true);
  });

  it.each([
    'malformed',
    'repeated',
    'unowned',
  ])('retains state without deletion on a %s dependency page', async (kind) => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    backend.override = ({ url }) =>
      url.pathname.endsWith('/order')
        ? response(
            200,
            kind === 'malformed'
              ? {}
              : {
                  results: [
                    {
                      uuid: backend.entities.get(`visit/${created.visitUuid}`)?.uuid,
                      voided: false,
                      patient: { uuid: kind === 'unowned' ? provider : created.patientUuid },
                    },
                  ],
                  links: kind === 'repeated' ? [{ rel: 'next' }] : [],
                },
          )
        : undefined;
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes()).toEqual([]);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
  });

  it.each([
    500, 204,
  ])('does not void parents when a child DELETE returns %s without confirmed cleanup', async (status) => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    const order = backend.uuid();
    backend.entities.set(`order/${order}`, { uuid: order, voided: false, patient: { uuid: created.patientUuid } });
    backend.override = ({ method, url }) =>
      method === 'delete' && url.pathname.endsWith(`/order/${order}`) ? response(status) : undefined;
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes()).toHaveLength(1);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
    backend.override = undefined;
    await new SyntheticFixtures(backend.api, journal, environment).cleanup();
    expect(journal.records()[0]?.cleaned).toBe(true);
  });

  it('does not accept the void state of a different resource UUID', async () => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    backend.override = ({ method, url }) =>
      method === 'get' && url.pathname.endsWith(`/visit/${created.visitUuid}`)
        ? response(200, { uuid: provider, voided: true })
        : undefined;
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes().some(({ url }) => url.pathname.includes('/patient/'))).toBe(false);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
  });

  it.each([401, 403])('stops all subsequent cleanup writes after HTTP %s', async (status) => {
    const { fixtures, backend } = harness();
    await fixtures.create('outpatient');
    await fixtures.create('appointments');
    backend.override = ({ method }) => (method === 'delete' ? response(status) : undefined);
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes()).toHaveLength(1);
  });

  it('rejects concurrent creation and cleanup on the same journal owner', async () => {
    const { fixtures } = harness();
    const creation = fixtures.create('outpatient');
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_OPERATION_ALREADY_RUNNING');
    await creation;
    await fixtures.cleanup();
  });

  it('does not report cleanup complete in memory when its final journal write fails', async () => {
    const { fixtures, journal } = harness();
    await fixtures.create('outpatient');
    journal.failWhen = (state) => state.patients.some((record) => record.cleaned);
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(journal.records()[0]?.cleaned).not.toBe(true);
    journal.failWhen = undefined;
    await fixtures.cleanup();
    expect(journal.records()[0]?.cleaned).toBe(true);
  });

  it('retains an unresolved visit attempt instead of declaring its patient clean', async () => {
    const { fixtures, backend, journal } = harness();
    backend.override = ({ method, url }) =>
      method === 'post' && url.pathname.endsWith('/visit') ? response(400) : undefined;
    await expect(fixtures.create('outpatient')).rejects.toThrow('FIXTURE_HTTP_400_RETAIN_JOURNAL');
    backend.override = undefined;
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(backend.deletes()).toEqual([]);
    expect(journal.records()[0]?.cleaned).not.toBe(true);
  });

  it('can recover a lost visit response directly during cleanup', async () => {
    const { fixtures, backend, journal } = harness();
    backend.loseResponse = 'visit';
    await expect(fixtures.create('outpatient')).rejects.toThrow('FIXTURE_NETWORK_FAILURE_RETAIN_JOURNAL');
    await new SyntheticFixtures(backend.api, journal, environment).cleanup();
    expect(journal.records()[0]?.cleaned).toBe(true);
    expect(backend.posts('visit')).toHaveLength(1);
  });

  it('does not assume missing patients prove that all dependent resources were cleaned', async () => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    backend.entities.delete(`patient/${created.patientUuid}`);
    await expect(fixtures.cleanup()).rejects.toThrow('FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
    expect(journal.records()[0]?.cleaned).not.toBe(true);
    expect(backend.deletes()).toEqual([]);
  });

  it('voids an independently active owned person only after the patient and children', async () => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    const personUuid = journal.records()[0]?.personUuid;
    backend.override = ({ method, url }) => {
      if (method === 'delete' && url.pathname.endsWith(`/patient/${created.patientUuid}`)) {
        const patient = backend.entities.get(`patient/${created.patientUuid}`);
        if (patient) patient.voided = true;
        return response(204);
      }
      return undefined;
    };
    await fixtures.cleanup();
    expect(backend.deletes().at(-1)?.url.pathname).toBe(`/openmrs/ws/rest/v1/person/${personUuid}`);
    expect(journal.records()[0]?.cleaned).toBe(true);
  });

  it('recovers ownership from includeAll names and identifiers when voided patient representations hide them', async () => {
    const { fixtures, backend, journal } = harness();
    const created = await fixtures.create('outpatient');
    const patient = backend.entities.get(`patient/${created.patientUuid}`);
    if (!patient?.person) throw new Error('Missing mocked patient');
    backend.override = ({ method, url }) => {
      if (method !== 'get' || !patient.voided) return undefined;
      if (url.pathname.endsWith(`/patient/${patient.uuid}/identifier`)) {
        expect(url.searchParams.get('includeAll')).toBe('true');
        return response(200, { results: patient.identifiers });
      }
      if (url.pathname.endsWith(`/person/${patient.person?.uuid}/name`)) {
        expect(url.searchParams.get('includeAll')).toBe('true');
        return response(200, { results: patient.person?.names });
      }
      if (url.pathname.endsWith(`/patient/${patient.uuid}`)) {
        if (url.searchParams.get('v')?.includes('identifiers')) return response(400);
        return response(200, {
          uuid: patient.uuid,
          voided: true,
          person: { uuid: patient.person?.uuid, voided: true },
        });
      }
      return undefined;
    };
    await fixtures.cleanup();
    expect(journal.records()[0]?.cleaned).toBe(true);
    expect(
      backend.calls.some(
        ({ url }) => url.pathname.endsWith('/identifier') && url.searchParams.get('includeAll') === 'true',
      ),
    ).toBe(true);
  });
});
