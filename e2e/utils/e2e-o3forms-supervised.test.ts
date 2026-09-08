import { type APIRequestContext } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import outpatientEnglish from '../../packages/apps/esm-atencion-ambulatoria-app/translations/en.json';
import outpatientSpanish from '../../packages/apps/esm-atencion-ambulatoria-app/translations/es.json';
import chartEnglish from '../../packages/apps/esm-patient-chart-app/translations/en.json';
import chartSpanish from '../../packages/apps/esm-patient-chart-app/translations/es.json';
import {
  allowEncounterWrite,
  collectOwnedObservationConcepts,
  type Encounter,
  finishO3BrowserAcceptance,
  loadO3SmokeConfig,
  O3SmokeError,
  physicalExamActionName,
  preflightO3Forms,
  readO3Resource,
  runOwnedO3Acceptance,
  verifyEncounter,
} from '../scripts/verify-o3forms-supervised';

const id = (digit: number) => `00000000-0000-4000-8000-${String(digit).padStart(12, '0')}`;
const privileges = [
  'app:hoja.clinica',
  'app:hoja.clinica.consultaExterna',
  'app:hoja.clinica.consultaExterna.editar',
  'app:hoja.clinica.formulariosClinicos',
  'Get Users',
  'Get Providers',
  'Add Patients',
  'Delete Patients',
  'Delete People',
  'Add Visits',
  'Delete Visits',
  'Add Encounters',
  'Edit Encounters',
  'Delete Encounters',
  'Add Observations',
  'Edit Observations',
  'Delete Observations',
];
const environment = {
  E2E_GATE_TARGET: 'DEV',
  E2E_BASE_URL: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa',
  E2E_API_BASE_URL: 'https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs',
  E2E_USER_ADMIN_USERNAME: 'SYNTHETIC_TEST_ACCOUNT',
  E2E_USER_ADMIN_PASSWORD: 'local-double-only',
  E2E_LOGIN_DEFAULT_LOCATION_UUID: id(1),
  E2E_O3FORMS_SUPERVISED_TARGET: 'DEV',
  E2E_O3FORMS_EXPECTED_VERSION: '2.3.1-sihsalus.1',
  E2E_FIXTURE_EXPECTED_SHA: 'a'.repeat(40),
  E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: id(2),
  E2E_FIXTURE_IDENTIFIER_TYPE_UUID: id(3),
  E2E_FIXTURE_VISIT_TYPE_UUID: id(4),
  E2E_O3FORMS_ENCOUNTER_TYPE_UUID: id(5),
  E2E_O3FORMS_JOURNAL_DIRECTORY: '/private/tmp/o3-smoke-test-only',
  E2E_FIXTURE_REQUIRED_PRIVILEGES: JSON.stringify(privileges),
};
const config = loadO3SmokeConfig(environment, 'preflight');
const metadata = {
  formUuids: [id(6), id(7)] as [string, string],
  chiefComplaintConcept: id(8),
  providerUuid: id(9),
  observationConcepts: [id(8)],
};
const owned = { patientUuid: id(10), visitUuid: id(11) };
const startedModules = [
  { uuid: 'o3forms', version: '2.3.1-sihsalus.1', started: true },
  { uuid: 'webservices.rest', version: '3.5.0-sihsalus.1', started: true },
  { uuid: 'patientdocuments', version: '2.3.0', started: true },
];
const encounter: Encounter = {
  uuid: id(12),
  voided: false,
  patient: { uuid: owned.patientUuid },
  visit: { uuid: owned.visitUuid },
  form: { uuid: id(6) },
  encounterType: { uuid: id(5) },
  encounterProviders: [{ provider: { uuid: id(9) } }],
  obs: [{ voided: false, concept: { uuid: id(8) }, value: 'SYNTHETIC' }],
};

function fakeApi(
  override: (url: URL, value: unknown) => unknown = (_url, value) => value,
  statusFor: (url: URL) => number = () => 200,
) {
  const get = vi.fn(async (input: string, options: unknown) => {
    expect(options).toMatchObject({ maxRedirects: 0, maxRetries: 0 });
    const url = new URL(input);
    expect(url.origin).toBe('https://gidis-hsc-dev.inf.pucp.edu.pe');
    let value: unknown;
    if (url.pathname.endsWith('/build-info.json')) value = { gitSha: 'a'.repeat(40) };
    else if (url.pathname.endsWith('/module')) value = { results: startedModules };
    else if (url.pathname.endsWith('/session'))
      value = {
        authenticated: true,
        currentProvider: { uuid: id(9) },
        sessionLocation: { uuid: id(1) },
        user: { uuid: id(15), privileges: privileges.map((name) => ({ name })) },
      };
    else if (url.pathname.endsWith(`/user/${id(15)}`)) value = { uuid: id(15), retired: false };
    else if (url.pathname.endsWith(`/provider/${id(9)}`)) value = { uuid: id(9), retired: false };
    else if (url.pathname.includes('/encountertype/')) value = { uuid: id(5), retired: false };
    else if (url.pathname.endsWith('/form'))
      value = {
        results: [
          {
            uuid: url.searchParams.get('q')?.includes('ANAM') ? id(6) : id(7),
            name: url.searchParams.get('q'),
            published: true,
            retired: false,
            encounterType: { uuid: id(5) },
          },
        ],
      };
    else if (url.pathname.includes('/o3/forms/'))
      value = {
        name: url.pathname.endsWith(id(6)) ? 'CE-ANAM-001-ANAMNESIS' : 'CE-SOAP-001-NOTA SOAP',
        encounterType: { uuid: id(5) },
        pages: [
          {
            sections: [
              {
                questions: [
                  {
                    id: 'motivoConsulta',
                    type: 'obs',
                    required: true,
                    questionOptions: { concept: id(8), rendering: 'textarea' },
                  },
                ],
              },
            ],
          },
        ],
      };
    else if (url.pathname.includes('/concept/')) value = { uuid: id(8), retired: false };
    else throw new Error('unexpected mock request');
    return { ok: () => statusFor(url) === 200, status: () => statusFor(url), json: async () => override(url, value) };
  });
  const post = vi.fn();
  const remove = vi.fn();
  return { api: { get, post, delete: remove } as unknown as APIRequestContext, get, post, remove };
}

describe('supervised O3 Forms adapter (local doubles only)', () => {
  it('matches the actual translated empty-state and populated physical-exam actions without broad alternatives', () => {
    for (const [chart, outpatient] of [
      [chartEnglish, outpatientEnglish],
      [chartSpanish, outpatientSpanish],
    ] as const) {
      // EmptyState composes the chart namespace's record prefix with lowercase displayText.
      expect(physicalExamActionName.test(`${chart.record} ${outpatient.physicalExamRecords.toLowerCase()}`)).toBe(true);
      expect(physicalExamActionName.test(outpatient.recordPhysicalExam)).toBe(true);
      expect(physicalExamActionName.test(`prefix ${outpatient.recordPhysicalExam}`)).toBe(false);
      expect(physicalExamActionName.test(`${outpatient.recordPhysicalExam} suffix`)).toBe(false);
    }
    expect(physicalExamActionName.test('Registrar signos vitales')).toBe(false);
  });
  it('uses exact user/provider reads when realistic session references omit active states', async () => {
    const mock = fakeApi();
    await expect(preflightO3Forms(mock.api, config)).resolves.toEqual(metadata);
    const paths = mock.get.mock.calls.map(([url]) => new URL(url).pathname);
    expect(paths).toContain(`/openmrs/ws/rest/v1/user/${id(15)}`);
    expect(paths).toContain(`/openmrs/ws/rest/v1/provider/${id(9)}`);
    expect(paths).not.toContain('/openmrs/ws/rest/v1/user');
    expect(paths).not.toContain('/openmrs/ws/rest/v1/provider');
  });
  it.each([
    [`/user/${id(15)}`, { uuid: id(15), retired: true }],
    [`/user/${id(15)}`, { uuid: id(15) }],
    [`/user/${id(15)}`, { uuid: id(99), retired: false }],
    [`/provider/${id(9)}`, { uuid: id(9), retired: true }],
    [`/provider/${id(9)}`, { uuid: id(9) }],
    [`/provider/${id(9)}`, { uuid: id(99), retired: false }],
  ])('rejects inactive, missing or mismatched state for %s before dependent metadata', async (suffix, value) => {
    const mock = fakeApi((url, normal) => (url.pathname.endsWith(suffix) ? value : normal));
    await expect(preflightO3Forms(mock.api, config)).rejects.toThrow(/O3_TEST_(USER|PROVIDER)_ACTIVE_STATE_UNVERIFIED/);
    expect(mock.get.mock.calls.some(([url]) => url.includes('/encountertype/') || url.includes('/o3/forms/'))).toBe(
      false,
    );
  });
  it.each([401, 403])('stops further metadata reads after HTTP %i from the exact user lookup', async (status) => {
    const mock = fakeApi(undefined, (url) => (url.pathname.endsWith(`/user/${id(15)}`) ? status : 200));
    await expect(preflightO3Forms(mock.api, config)).rejects.toThrow('O3_AUTHORIZATION_FAILED');
    expect(mock.get.mock.calls.some(([url]) => url.includes('/provider/') || url.includes('/o3/forms/'))).toBe(false);
  });
  it.each([401, 403])('closes the browser and forbids cleanup after direct persistence API HTTP %i', async (status) => {
    const calls: string[] = [];
    const responseJson = vi.fn();
    const api = {
      get: vi.fn(async () => {
        calls.push('persistence-read');
        return { status: () => status, ok: () => false, json: responseJson };
      }),
    } as unknown as APIRequestContext;
    const browser = {
      close: vi.fn(async () => {
        calls.push('browser-closed');
      }),
    };
    const fixtures = {
      create: vi.fn(async () => owned),
      cleanup: vi.fn(async () => {
        calls.push('cleanup');
      }),
    };
    await expect(
      runOwnedO3Acceptance(fixtures, async () => {
        try {
          await readO3Resource(api, config, `encounter/${id(12)}`);
        } catch (error) {
          await finishO3BrowserAcceptance(browser, true, false, error);
        }
      }),
    ).rejects.toThrow('O3_WRITES_STOPPED_RETAIN_JOURNAL');
    expect(calls).toEqual(['persistence-read', 'browser-closed']);
    expect(fixtures.cleanup).not.toHaveBeenCalled();
    expect(responseJson).not.toHaveBeenCalled();
  });
  it('verifies TLS unless explicitly waived for the exact approved non-production target', () => {
    expect(loadO3SmokeConfig(environment, 'preflight').ignoreHTTPSErrors).toBe(false);
    expect(
      loadO3SmokeConfig({ ...environment, SIHSALUS_ALLOW_SELF_SIGNED_TLS: 'true' }, 'preflight').ignoreHTTPSErrors,
    ).toBe(true);
    expect(
      loadO3SmokeConfig(
        { ...environment, SIHSALUS_ALLOW_SELF_SIGNED_TLS: 'false', E2E_IGNORE_HTTPS_ERRORS: 'true' },
        'preflight',
      ).ignoreHTTPSErrors,
    ).toBe(false);
    expect(() =>
      loadO3SmokeConfig(
        {
          ...environment,
          SIHSALUS_ALLOW_SELF_SIGNED_TLS: 'true',
          E2E_API_BASE_URL: 'https://production.example.test/openmrs',
        },
        'preflight',
      ),
    ).toThrow();
    expect(() => loadO3SmokeConfig({ ...environment, NODE_TLS_REJECT_UNAUTHORIZED: '0' }, 'preflight')).toThrow(
      'O3_GLOBAL_TLS_BYPASS_FORBIDDEN',
    );
    expect(() => loadO3SmokeConfig({ ...environment, SIHSALUS_ALLOW_SELF_SIGNED_TLS: 'yes' }, 'preflight')).toThrow(
      'O3_TLS_OPTION_INVALID',
    );
  });
  it('closes acceptance before verified cleanup and creates only its owned outpatient fixture', async () => {
    const calls: string[] = [];
    const fixtures = {
      create: vi.fn(async () => {
        calls.push('create');
        return owned;
      }),
      cleanup: vi.fn(async () => {
        calls.push('cleanup');
      }),
    };
    await runOwnedO3Acceptance(fixtures, async (value) => {
      expect(value).toEqual(owned);
      calls.push('acceptance-closed');
    });
    expect(fixtures.create).toHaveBeenCalledExactlyOnceWith('outpatient');
    expect(calls).toEqual(['create', 'acceptance-closed', 'cleanup']);
  });
  it.each(['setup', 'browser'])('cleans partial %s failures but never reports them as passed', async (phase) => {
    const fixtures = {
      create: vi.fn(async () => {
        if (phase === 'setup') throw new Error('opaque source failure');
        return owned;
      }),
      cleanup: vi.fn(async () => undefined),
    };
    const acceptance = vi.fn(async () => {
      throw new Error('opaque source failure');
    });
    await expect(runOwnedO3Acceptance(fixtures, acceptance)).rejects.toThrow('O3_ACCEPTANCE_FAILED_CLEANUP_VERIFIED');
    expect(fixtures.cleanup).toHaveBeenCalledOnce();
    if (phase === 'setup') expect(acceptance).not.toHaveBeenCalled();
  });
  it.each([
    'O3_BROWSER_SHUTDOWN_UNVERIFIED_RETAIN_JOURNAL',
    'O3_AUTHORIZATION_FAILED_RETAIN_JOURNAL',
    'FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL',
  ])('stops dependent cleanup writes after %s', async (code) => {
    const fixtures = { create: vi.fn(async () => owned), cleanup: vi.fn(async () => undefined) };
    await expect(
      runOwnedO3Acceptance(fixtures, async () => {
        throw new O3SmokeError(code);
      }),
    ).rejects.toThrow('O3_WRITES_STOPPED_RETAIN_JOURNAL');
    expect(fixtures.cleanup).not.toHaveBeenCalled();
  });
  it('retains an unresolved cleanup failure even after successful acceptance', async () => {
    const fixtures = {
      create: vi.fn(async () => owned),
      cleanup: vi.fn(async () => {
        throw new Error('opaque backend failure');
      }),
    };
    await expect(runOwnedO3Acceptance(fixtures, async () => undefined)).rejects.toThrow(
      'O3_CLEANUP_UNVERIFIED_RETAIN_JOURNAL',
    );
  });
  it('requires explicit mode and supervised target before a runtime can be constructed', () => {
    expect(() => loadO3SmokeConfig(environment, '')).toThrow('O3_MODE_REQUIRED');
    expect(() => loadO3SmokeConfig({ ...environment, E2E_O3FORMS_SUPERVISED_TARGET: '' }, 'run')).toThrow(
      'O3_SUPERVISION_REQUIRED',
    );
  });
  it.each([
    { E2E_API_BASE_URL: 'https://production.example.test/openmrs' },
    { E2E_BASE_URL: 'http://127.0.0.1:8080/openmrs/spa' },
    { E2E_O3FORMS_EXPECTED_VERSION: '2.3.0' },
    { E2E_O3FORMS_EXPECTED_VERSION: '2.3.0-sihsalus.1' },
    { E2E_FIXTURE_EXPECTED_SHA: 'latest' },
    { E2E_O3FORMS_ENCOUNTER_TYPE_UUID: '' },
    { E2E_FIXTURE_REQUIRED_PRIVILEGES: '["Get Patients"]' },
    { E2E_O3FORMS_JOURNAL_DIRECTORY: 'relative-path' },
  ])('rejects unsupported or incomplete configuration', (overrides) => {
    expect(() => loadO3SmokeConfig({ ...environment, ...overrides }, 'run')).toThrow();
  });
  it('preflights real schema contracts using reads only and single-attempt transport', async () => {
    const mock = fakeApi();
    await expect(preflightO3Forms(mock.api, config)).resolves.toEqual(metadata);
    expect(mock.post).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.get.mock.calls.filter(([url]) => url.includes('/o3/forms/'))).toHaveLength(2);
    expect(mock.get.mock.calls.filter(([url]) => new URL(url).pathname.endsWith('/module'))).toHaveLength(1);
  });
  it.each([
    'webservices.rest',
    'patientdocuments',
  ])('rejects stopped, missing, unknown or duplicated %s before dependent reads and writes', async (moduleId) => {
    const otherModules = startedModules.filter((module) => module.uuid !== moduleId);
    for (const results of [
      otherModules,
      [...otherModules, { uuid: moduleId, started: false }],
      [...otherModules, { uuid: moduleId }],
      [...otherModules, { uuid: moduleId, started: 'true' }],
      [...startedModules, { uuid: moduleId, started: true }],
    ]) {
      const mock = fakeApi((url, normal) => (url.pathname.endsWith('/module') ? { results } : normal));
      await expect(preflightO3Forms(mock.api, config)).rejects.toThrow('O3_DEPENDENT_MODULE_NOT_STARTED_OR_UNVERIFIED');
      expect(mock.get.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
        '/openmrs/spa/build-info.json',
        '/openmrs/ws/rest/v1/module',
      ]);
      expect(mock.post).not.toHaveBeenCalled();
      expect(mock.remove).not.toHaveBeenCalled();
    }
  });
  it('rejects the withdrawn patch even when all reported modules are started', async () => {
    const mock = fakeApi((url, normal) =>
      url.pathname.endsWith('/module')
        ? {
            results: startedModules.map((module) =>
              module.uuid === 'o3forms' ? { ...module, version: '2.3.0-sihsalus.1' } : module,
            ),
          }
        : normal,
    );
    await expect(preflightO3Forms(mock.api, config)).rejects.toThrow('O3_DEPLOYED_MODULE_MISMATCH');
    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(mock.post).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });
  it("supports the deployed catalog's CIEL identifiers without treating them as patient UUIDs", async () => {
    const concept = '160532AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const mock = fakeApi((url, value) => {
      if (url.pathname.includes('/o3/forms/')) return JSON.parse(JSON.stringify(value).replaceAll(id(8), concept));
      if (url.pathname.includes('/concept/')) return { uuid: concept, retired: false };
      return value;
    });
    await expect(preflightO3Forms(mock.api, config)).resolves.toMatchObject({ chiefComplaintConcept: concept });
  });
  it('rejects a newly added order question before a fixture or browser can write', async () => {
    const mock = fakeApi((url, value) =>
      url.pathname.includes('/o3/forms/')
        ? JSON.parse(JSON.stringify(value).replace('"type":"obs"', '"type":"testOrder"'))
        : value,
    );
    await expect(preflightO3Forms(mock.api, config)).rejects.toThrow('O3_SCHEMA_WRITE_TYPE_UNSUPPORTED');
  });
  it.each([
    ['/build-info.json', { gitSha: 'b'.repeat(40) }],
    ['/module', { results: [{ uuid: 'o3forms', version: '2.3.0' }] }],
    ['/module', { results: [{ uuid: 'o3forms', version: '2.3.1-sihsalus.1', started: false }] }],
    ['/module', { results: [{ uuid: 'o3forms', version: '2.3.1-sihsalus.1' }] }],
    ['/session', { authenticated: false }],
    ['/form', { results: [] }],
    ['/form', { results: [], links: [{ rel: 'next' }] }],
    [`/concept/${id(8)}`, { uuid: id(8), retired: true }],
  ])('fails closed for bad remote metadata: %s', async (suffix, value) => {
    const mock = fakeApi((url, normal) => (url.pathname.endsWith(suffix) ? value : normal));
    await expect(preflightO3Forms(mock.api, config)).rejects.toThrow();
    expect(mock.post).not.toHaveBeenCalled();
  });
  it('requires one encounter, the original UUID after edit, exact context and one active stored value', () => {
    expect(verifyEncounter([encounter], owned, config, metadata, 'SYNTHETIC')).toBe(id(12));
    expect(verifyEncounter([encounter], owned, config, metadata, 'SYNTHETIC', id(12))).toBe(id(12));
    for (const bad of [
      [],
      [encounter, encounter],
      [{ ...encounter, patient: { uuid: id(90) } }],
      [{ ...encounter, encounterProviders: [] }],
      [{ ...encounter, obs: [...(encounter.obs ?? []), ...(encounter.obs ?? [])] }],
    ]) {
      expect(() => verifyEncounter(bad, owned, config, metadata, 'SYNTHETIC')).toThrow();
    }
    expect(() => verifyEncounter([encounter], owned, config, metadata, 'SYNTHETIC', id(99))).toThrow(
      'O3_EDIT_CREATED_DUPLICATE',
    );
    expect(() => verifyEncounter([encounter], owned, config, metadata, 'different')).toThrow();
  });
  it('allows only the exact owned encounter create or edit, never another form/patient/target or second create', () => {
    const url = `${config.apiBaseUrl}/ws/rest/v1/encounter`;
    const payload = {
      patient: owned.patientUuid,
      visit: owned.visitUuid,
      form: { uuid: id(6) },
      encounterType: id(5),
      obs: [{ concept: id(8), value: 'SYNTHETIC' }],
    };
    const policy = { allowedConcepts: new Set([id(8)]), ownedObservationConcepts: new Map<string, string>() };
    expect(allowEncounterWrite(url, 'POST', payload, config, owned, id(6), policy)).toBe(true);
    expect(allowEncounterWrite(`${url}/${id(12)}`, 'POST', payload, config, owned, id(6), policy, id(12))).toBe(true);
    expect(allowEncounterWrite(url, 'POST', payload, config, owned, id(6), policy, id(12))).toBe(false);
    expect(allowEncounterWrite(url, 'DELETE', payload, config, owned, id(6), policy)).toBe(false);
    expect(allowEncounterWrite(url, 'POST', { ...payload, patient: id(99) }, config, owned, id(6), policy)).toBe(false);
    expect(allowEncounterWrite(url, 'POST', payload, config, owned, id(7), policy)).toBe(false);
    expect(
      allowEncounterWrite(url, 'POST', { ...payload, orders: [{ concept: id(80) }] }, config, owned, id(6), policy),
    ).toBe(false);
    expect(
      allowEncounterWrite(
        url,
        'POST',
        { ...payload, diagnoses: [{ diagnosis: id(81) }] },
        config,
        owned,
        id(6),
        policy,
      ),
    ).toBe(false);
    expect(
      allowEncounterWrite(url, 'POST', { ...payload, obs: [{ person: id(90) }] }, config, owned, id(6), policy),
    ).toBe(false);
    expect(
      allowEncounterWrite(
        url.replace('gidis-hsc-dev', 'gidis-hsc-qlty'),
        'POST',
        payload,
        config,
        owned,
        id(6),
        policy,
      ),
    ).toBe(false);
  });
  it('derives the editable observation UUID/concept map only from the owned fixture encounter', () => {
    const observation = {
      uuid: id(13),
      person: { uuid: owned.patientUuid },
      encounter: { uuid: id(12) },
      concept: { uuid: id(8) },
    };
    const concepts = new Set([id(8)]);
    expect(collectOwnedObservationConcepts([observation], owned, id(12), concepts)).toEqual(new Map([[id(13), id(8)]]));
    for (const changed of [
      { ...observation, person: { uuid: id(99) } },
      { ...observation, encounter: { uuid: id(99) } },
      { ...observation, concept: { uuid: id(99) } },
      { ...observation, uuid: 'invalid' },
    ]) {
      expect(() => collectOwnedObservationConcepts([changed], owned, id(12), concepts)).toThrow(
        'O3_OBSERVATION_OWNERSHIP_UNVERIFIED',
      );
    }
    expect(() => collectOwnedObservationConcepts([observation, observation], owned, id(12), concepts)).toThrow(
      'O3_OBSERVATION_IDENTITY_DUPLICATED',
    );
  });
  it('checks UUID and concept ownership recursively, including partial edits and voids', () => {
    const url = `${config.apiBaseUrl}/ws/rest/v1/encounter/${id(12)}`;
    const policy = { allowedConcepts: new Set([id(8), id(14)]), ownedObservationConcepts: new Map([[id(13), id(8)]]) };
    const allowed = (obs: unknown[]) =>
      allowEncounterWrite(
        url,
        'POST',
        { patient: owned.patientUuid, visit: owned.visitUuid, form: id(6), encounterType: id(5), obs },
        config,
        owned,
        id(6),
        policy,
        id(12),
      );
    expect(allowed([{ uuid: id(13), value: 'SYNTHETIC EDITED' }])).toBe(true);
    expect(allowed([{ uuid: id(13), voided: true }])).toBe(true);
    expect(allowed([{ concept: id(14), groupMembers: [{ uuid: id(13), value: 'SYNTHETIC' }] }])).toBe(true);
    for (const obs of [
      [{ uuid: id(99), value: 'SYNTHETIC' }],
      [{ uuid: id(13), concept: id(14), value: 'SYNTHETIC' }],
      [{ concept: id(99), value: 'SYNTHETIC' }],
      [{ concept: id(14), groupMembers: [{ uuid: id(99), value: 'SYNTHETIC' }] }],
      [{ concept: id(14), groupMembers: [{ concept: id(8), groupMembers: [{ uuid: id(99) }] }] }],
      [{ concept: id(14), groupMembers: [{ uuid: id(13), person: id(99) }] }],
      [{ concept: id(14), groupMembers: 'invalid' }],
      [
        { uuid: id(13), value: 'SYNTHETIC' },
        { uuid: id(13), value: 'DUPLICATED' },
      ],
      [{ concept: id(8), obsGroup: { uuid: id(99) } }],
    ])
      expect(allowed(obs)).toBe(false);
    expect(
      allowEncounterWrite(
        `${config.apiBaseUrl}/ws/rest/v1/encounter`,
        'POST',
        {
          patient: owned.patientUuid,
          visit: owned.visitUuid,
          form: id(6),
          encounterType: id(5),
          obs: [{ uuid: id(13), value: 'SYNTHETIC' }],
        },
        config,
        owned,
        id(6),
        policy,
      ),
    ).toBe(false);
  });
});
