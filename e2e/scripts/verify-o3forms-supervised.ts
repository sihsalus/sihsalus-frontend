import path from 'node:path';
import { type APIRequestContext, type Browser, chromium, expect, request } from '@playwright/test';
import { PrivateFixtureJournal } from '../utils/e2e-fixture-journal';
import { loadE2EBaseConfig } from '../utils/e2e-gate-config';
import { SyntheticFixtures } from '../utils/e2e-synthetic-fixtures';

type Mode = 'preflight' | 'run' | 'cleanup';
type Reference = { uuid?: string; retired?: boolean };
type Form = Reference & { name?: string; published?: boolean; encounterType?: Reference };
type Question = {
  id?: string;
  type?: string;
  required?: boolean | string;
  questionOptions?: { concept?: string; rendering?: string; answers?: Array<{ concept?: string }> };
  questions?: Question[];
};
type Schema = {
  name?: string;
  encounterType?: string | Reference;
  pages?: Array<{ sections?: Array<{ questions?: Question[] }> }>;
};
export type Encounter = Reference & {
  voided?: boolean;
  patient?: Reference;
  visit?: Reference;
  form?: Reference;
  encounterType?: Reference;
  encounterProviders?: Array<{ provider?: Reference }>;
  obs?: Array<{ voided?: boolean; concept?: Reference; value?: unknown }>;
};
type StoredObservation = Reference & { person?: Reference; encounter?: Reference; concept?: Reference };
type ObservationPolicy = { allowedConcepts: Set<string>; ownedObservationConcepts: Map<string, string> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isConceptIdentifier(value: string): boolean {
  return uuid.test(value) || (value.length === 36 && /^[0-9]+A+$/.test(value));
}
const forms = ['CE-ANAM-001-ANAMNESIS', 'CE-SOAP-001-NOTA SOAP'] as const;
const expectedO3FormsVersion = '2.3.1-sihsalus.1';
export const physicalExamActionName =
  /^(?:Registrar (?:registros de )?examen físico|Record physical examination(?: records)?)$/i;
const requiredPrivileges = [
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
] as const;

export class O3SmokeError extends Error {}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new O3SmokeError(code);
}
function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  check(value, `O3_CONFIG_${name}_REQUIRED`);
  return value;
}

export function loadO3SmokeConfig(environment: NodeJS.ProcessEnv, mode: string) {
  check(['preflight', 'run', 'cleanup'].includes(mode), 'O3_MODE_REQUIRED');
  const base = loadE2EBaseConfig(environment);
  check(environment.E2E_O3FORMS_SUPERVISED_TARGET === base.target, 'O3_SUPERVISION_REQUIRED');
  check(new URL(base.spaBaseUrl).origin === new URL(base.apiBaseUrl).origin, 'O3_DEPLOYED_SPA_REQUIRED');
  check(environment.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'O3_GLOBAL_TLS_BYPASS_FORBIDDEN');
  check([undefined, 'true', 'false'].includes(environment.SIHSALUS_ALLOW_SELF_SIGNED_TLS), 'O3_TLS_OPTION_INVALID');
  check(environment.E2E_O3FORMS_EXPECTED_VERSION === expectedO3FormsVersion, 'O3_PATCH_VERSION_REQUIRED');
  const expectedSha = required(environment, 'E2E_FIXTURE_EXPECTED_SHA');
  check(/^[a-f0-9]{40}$/i.test(expectedSha), 'O3_BUILD_SHA_INVALID');
  for (const key of [
    'E2E_FIXTURE_IDENTIFIER_SOURCE_UUID',
    'E2E_FIXTURE_IDENTIFIER_TYPE_UUID',
    'E2E_FIXTURE_VISIT_TYPE_UUID',
    'E2E_O3FORMS_ENCOUNTER_TYPE_UUID',
  ]) {
    check(uuid.test(required(environment, key)), `O3_CONFIG_${key}_INVALID`);
  }
  const journalDirectory = required(environment, 'E2E_O3FORMS_JOURNAL_DIRECTORY');
  check(path.isAbsolute(journalDirectory), 'O3_JOURNAL_ABSOLUTE_DIRECTORY_REQUIRED');
  let privileges: unknown;
  try {
    privileges = JSON.parse(required(environment, 'E2E_FIXTURE_REQUIRED_PRIVILEGES'));
  } catch {
    throw new O3SmokeError('O3_PRIVILEGE_CONFIGURATION_INVALID');
  }
  check(
    Array.isArray(privileges) && requiredPrivileges.every((name) => privileges.includes(name)),
    'O3_REQUIRED_PRIVILEGES_INCOMPLETE',
  );
  return {
    ...base,
    mode: mode as Mode,
    expectedSha,
    journalDirectory,
    ignoreHTTPSErrors: environment.SIHSALUS_ALLOW_SELF_SIGNED_TLS === 'true',
    encounterTypeUuid: environment.E2E_O3FORMS_ENCOUNTER_TYPE_UUID as string,
  };
}
type Config = ReturnType<typeof loadO3SmokeConfig>;
type Metadata = {
  formUuids: [string, string];
  chiefComplaintConcept: string;
  providerUuid: string;
  observationConcepts: string[];
};
type Owned = { patientUuid: string; visitUuid: string };

async function json<T>(api: APIRequestContext, config: Config, resource: string): Promise<T> {
  const response = await api.get(`${config.apiBaseUrl}/ws/rest/v1/${resource}`, { maxRedirects: 0, maxRetries: 0 });
  check(![401, 403].includes(response.status()), 'O3_AUTHORIZATION_FAILED');
  check(response.ok(), 'O3_METADATA_REQUEST_FAILED');
  return response.json() as Promise<T>;
}

export { json as readO3Resource };

export async function preflightO3Forms(api: APIRequestContext, config: Config): Promise<Metadata> {
  const build = await api.get(`${config.spaBaseUrl}/build-info.json`, { maxRedirects: 0, maxRetries: 0 });
  check(build.ok() && (await build.json()).gitSha === config.expectedSha, 'O3_DEPLOYED_SHA_MISMATCH');
  const modules = await json<{
    results?: Array<{ uuid?: string; version?: string; started?: boolean }>;
    links?: Array<{ rel?: string }>;
  }>(api, config, 'module?v=custom:(uuid,version,started)&limit=100');
  check(
    Array.isArray(modules.results) && !modules.links?.some((link) => link.rel === 'next'),
    'O3_MODULE_LIST_INCOMPLETE',
  );
  const installed = modules.results.filter((module) => module.uuid === 'o3forms');
  check(installed.length === 1 && installed[0]?.version === expectedO3FormsVersion, 'O3_DEPLOYED_MODULE_MISMATCH');
  check(installed[0]?.started === true, 'O3_MODULE_NOT_STARTED_OR_UNVERIFIED');
  // O3 can start while a required consumer fails its minimum-version dependency.
  // General backend health and the O3 start flag alone are not acceptance evidence.
  for (const moduleId of ['webservices.rest', 'patientdocuments']) {
    const matches = modules.results.filter((module) => module.uuid === moduleId);
    check(matches.length === 1 && matches[0]?.started === true, 'O3_DEPENDENT_MODULE_NOT_STARTED_OR_UNVERIFIED');
  }
  const session = await json<{
    authenticated?: boolean;
    currentProvider?: Reference;
    sessionLocation?: Reference;
    user?: { uuid?: string; privileges?: Array<{ name?: string; retired?: boolean }> };
  }>(
    api,
    config,
    'session?v=custom:(authenticated,currentProvider:(uuid),sessionLocation:(uuid),user:(uuid,privileges:(name)))',
  );
  check(
    session.authenticated === true &&
      uuid.test(session.currentProvider?.uuid ?? '') &&
      uuid.test(session.user?.uuid ?? '') &&
      session.sessionLocation?.uuid === config.locationUuid,
    'O3_TEST_SESSION_UNVERIFIED',
  );
  // SessionController uses its own representation and does not expose retired states.
  // Read only the exact authenticated identities, never a provider/user collection.
  const user = await json<Reference>(api, config, `user/${session.user?.uuid}?v=custom:(uuid,retired)`);
  check(user.uuid === session.user?.uuid && user.retired === false, 'O3_TEST_USER_ACTIVE_STATE_UNVERIFIED');
  const provider = await json<Reference>(
    api,
    config,
    `provider/${session.currentProvider?.uuid}?v=custom:(uuid,retired)`,
  );
  check(
    provider.uuid === session.currentProvider?.uuid && provider.retired === false,
    'O3_TEST_PROVIDER_ACTIVE_STATE_UNVERIFIED',
  );
  const assigned = new Set(
    session.user?.privileges?.filter((privilege) => !privilege.retired).map((privilege) => privilege.name),
  );
  check(
    requiredPrivileges.every((privilege) => assigned.has(privilege)),
    'O3_TEST_PRIVILEGES_MISSING',
  );
  const type = await json<Reference>(api, config, `encountertype/${config.encounterTypeUuid}?v=custom:(uuid,retired)`);
  check(type.uuid === config.encounterTypeUuid && type.retired === false, 'O3_ENCOUNTER_TYPE_UNVERIFIED');
  const resolved: string[] = [];
  let chiefComplaintConcept = '';
  let observationConcepts: string[] = [];
  for (const name of forms) {
    const result = await json<{ results?: Form[]; links?: Array<{ rel?: string }> }>(
      api,
      config,
      `form?${new URLSearchParams({ q: name, limit: '100', v: 'custom:(uuid,name,published,retired,encounterType:(uuid))' })}`,
    );
    check(
      Array.isArray(result.results) && !result.links?.some((link) => link.rel === 'next'),
      'O3_FORM_LIST_INCOMPLETE',
    );
    const matches = result.results.filter(
      (form) =>
        form.name === name &&
        form.published === true &&
        form.retired === false &&
        form.encounterType?.uuid === config.encounterTypeUuid,
    );
    check(matches.length === 1 && uuid.test(matches[0]?.uuid ?? ''), 'O3_FORM_UNAVAILABLE_OR_AMBIGUOUS');
    const formUuid = matches[0]?.uuid as string;
    resolved.push(formUuid);
    // This is the real endpoint used by the renderer, with translations enabled.
    const schema = await json<Schema>(api, config, `o3/forms/${formUuid}`);
    const encounterType = typeof schema.encounterType === 'string' ? schema.encounterType : schema.encounterType?.uuid;
    check(
      schema.name === name &&
        encounterType === config.encounterTypeUuid &&
        Array.isArray(schema.pages) &&
        schema.pages.length > 0,
      'O3_SCHEMA_INVALID',
    );
    const questions: Question[] = [];
    const collect = (items: Question[]) => {
      for (const item of items) {
        questions.push(item);
        collect(item.questions ?? []);
      }
    };
    for (const page of schema.pages) {
      check(Array.isArray(page.sections), 'O3_SCHEMA_SECTIONS_INVALID');
      for (const section of page.sections) {
        check(Array.isArray(section.questions), 'O3_SCHEMA_QUESTIONS_INVALID');
        collect(section.questions);
      }
    }
    check(
      questions.every((question) =>
        ['obs', 'encounterDatetime', 'encounterProvider', 'encounterLocation'].includes(question.type ?? ''),
      ),
      'O3_SCHEMA_WRITE_TYPE_UNSUPPORTED',
    );
    const concepts = new Set(
      questions
        .flatMap((question) => [
          question.questionOptions?.concept,
          ...(question.questionOptions?.answers?.map((answer) => answer.concept) ?? []),
        ])
        .filter((value): value is string => Boolean(value)),
    );
    for (const concept of concepts) {
      check(isConceptIdentifier(concept), 'O3_SCHEMA_CONCEPT_IDENTIFIER_UNSUPPORTED');
      const resource = await json<Reference>(api, config, `concept/${concept}?v=custom:(uuid,retired)`);
      check(resource.uuid === concept && resource.retired === false, 'O3_SCHEMA_CONCEPT_UNAVAILABLE');
    }
    if (name === forms[0]) {
      observationConcepts = [
        ...new Set(
          questions
            .filter((question) => question.type === 'obs')
            .map((question) => question.questionOptions?.concept)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const chief = questions.filter((question) => question.id === 'motivoConsulta');
      check(
        chief.length === 1 &&
          chief[0]?.type === 'obs' &&
          chief[0]?.questionOptions?.rendering === 'textarea' &&
          chief[0]?.required === true,
        'O3_ANAMNESIS_CONTRACT_MISMATCH',
      );
      chiefComplaintConcept = chief[0]?.questionOptions?.concept ?? '';
      check(isConceptIdentifier(chiefComplaintConcept), 'O3_ANAMNESIS_CONCEPT_MISSING');
    }
  }
  return {
    formUuids: resolved as [string, string],
    chiefComplaintConcept,
    providerUuid: session.currentProvider?.uuid as string,
    observationConcepts,
  };
}

/** Only observations read back from this freshly created fixture can authorize an edit UUID. */
export function collectOwnedObservationConcepts(
  observations: StoredObservation[],
  owned: Owned,
  encounterUuid: string,
  allowedConcepts: Set<string>,
): Map<string, string> {
  const identities = new Map<string, string>();
  for (const observation of observations) {
    check(
      uuid.test(observation.uuid ?? '') &&
        observation.person?.uuid === owned.patientUuid &&
        observation.encounter?.uuid === encounterUuid &&
        allowedConcepts.has(observation.concept?.uuid ?? ''),
      'O3_OBSERVATION_OWNERSHIP_UNVERIFIED',
    );
    check(!identities.has(observation.uuid as string), 'O3_OBSERVATION_IDENTITY_DUPLICATED');
    identities.set(observation.uuid as string, observation.concept?.uuid as string);
  }
  return identities;
}

function allowedObservations(
  values: unknown[],
  policy: ObservationPolicy,
  owned: Owned,
  encounterUuid?: string,
): boolean {
  let count = 0;
  const seenUuids = new Set<string>();
  function allowed(value: unknown, depth: number): boolean {
    if (++count > 500 || depth > 10 || !value || typeof value !== 'object') return false;
    const observation = value as Record<string, unknown>;
    const reference = (value: unknown) => (typeof value === 'string' ? value : (value as Reference | null)?.uuid);
    const observationUuid = observation.uuid;
    if (
      observationUuid != null &&
      (!encounterUuid ||
        typeof observationUuid !== 'string' ||
        !policy.ownedObservationConcepts.has(observationUuid) ||
        seenUuids.has(observationUuid))
    )
      return false;
    if (typeof observationUuid === 'string') seenUuids.add(observationUuid);
    const ownedConcept =
      typeof observationUuid === 'string' ? policy.ownedObservationConcepts.get(observationUuid) : undefined;
    const concept = reference(observation.concept) ?? ownedConcept;
    if (!concept || !policy.allowedConcepts.has(concept) || (ownedConcept && ownedConcept !== concept)) return false;
    if (observation.voided === true && !observationUuid) return false;
    if (observation.person != null && reference(observation.person) !== owned.patientUuid) return false;
    if (observation.encounter != null && (!encounterUuid || reference(observation.encounter) !== encounterUuid))
      return false;
    if (observation.order != null || observation.obsGroup != null) return false;
    if (
      observation.groupMembers != null &&
      (!Array.isArray(observation.groupMembers) ||
        !observation.groupMembers.every((child) => allowed(child, depth + 1)))
    )
      return false;
    return true;
  }
  return values.every((value) => allowed(value, 0));
}

export function verifyEncounter(
  encounters: Encounter[],
  owned: Owned,
  config: Pick<Config, 'encounterTypeUuid'>,
  metadata: Metadata,
  marker: string,
  previousUuid?: string,
): string {
  check(
    encounters.every((item) => item.patient?.uuid === owned.patientUuid && item.visit?.uuid === owned.visitUuid),
    'O3_ENCOUNTER_OWNERSHIP_MISMATCH',
  );
  const matches = encounters.filter((item) => item.voided === false && item.form?.uuid === metadata.formUuids[0]);
  check(matches.length === 1 && uuid.test(matches[0]?.uuid ?? ''), 'O3_ENCOUNTER_NOT_UNIQUE');
  const encounter = matches[0];
  check(encounter, 'O3_ENCOUNTER_NOT_UNIQUE');
  check(!previousUuid || encounter.uuid === previousUuid, 'O3_EDIT_CREATED_DUPLICATE');
  check(
    encounter.encounterType?.uuid === config.encounterTypeUuid &&
      encounter.encounterProviders?.some((item) => item.provider?.uuid === metadata.providerUuid),
    'O3_ENCOUNTER_CLINICAL_CONTEXT_MISMATCH',
  );
  const observations =
    encounter.obs?.filter((item) => item.voided === false && item.concept?.uuid === metadata.chiefComplaintConcept) ??
    [];
  check(observations.length === 1 && observations[0]?.value === marker, 'O3_OBSERVATION_NOT_PERSISTED_OR_DUPLICATED');
  return encounter.uuid as string;
}

export function allowEncounterWrite(
  url: string,
  method: string,
  payload: unknown,
  config: Config,
  owned: Owned,
  formUuid: string,
  observationPolicy: ObservationPolicy,
  encounterUuid?: string,
): boolean {
  const destination = new URL(url);
  const base = `${new URL(config.apiBaseUrl).pathname}/ws/rest/v1/encounter`;
  if (
    destination.origin !== new URL(config.apiBaseUrl).origin ||
    method !== 'POST' ||
    (destination.pathname !== base && (!encounterUuid || destination.pathname !== `${base}/${encounterUuid}`))
  )
    return false;
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Record<string, unknown>;
  const reference = (item: unknown) => (typeof item === 'string' ? item : (item as Reference | null)?.uuid);
  const absentOrEmpty = (value: unknown) => value == null || (Array.isArray(value) && value.length === 0);
  if (!absentOrEmpty(value.orders) || !absentOrEmpty(value.diagnoses)) return false;
  if (value.uuid != null && (!encounterUuid || value.uuid !== encounterUuid)) return false;
  if (!Array.isArray(value.obs) || value.obs.length === 0) return false;
  if (!allowedObservations(value.obs, observationPolicy, owned, encounterUuid)) return false;
  return (
    reference(value.patient) === owned.patientUuid &&
    reference(value.visit) === owned.visitUuid &&
    reference(value.form) === formUuid &&
    reference(value.encounterType) === config.encounterTypeUuid &&
    (!encounterUuid || destination.pathname.endsWith(`/${encounterUuid}`))
  );
}

async function browserAcceptance(
  api: APIRequestContext,
  config: Config,
  metadata: Metadata,
  owned: Owned,
): Promise<void> {
  let browser: Browser | undefined;
  let failedRequest = false;
  let encounteredError = false;
  let allowedSave = false;
  let encounterUuid: string | undefined;
  let schemaResponses = 0;
  let authorizationFailed = false;
  let acceptanceFailed = false;
  let acceptanceError: unknown;
  const observationPolicy = {
    allowedConcepts: new Set(metadata.observationConcepts),
    ownedObservationConcepts: new Map<string, string>(),
  };
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      storageState: await api.storageState(),
      locale: 'es-PE',
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
      ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const destination = new URL(request.url());
      if (destination.origin !== new URL(config.apiBaseUrl).origin) {
        await route.abort();
        return;
      }
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        await route.continue();
        return;
      }
      let payload: unknown;
      try {
        payload = request.postDataJSON();
      } catch {
        payload = undefined;
      }
      if (
        !authorizationFailed &&
        allowedSave &&
        allowEncounterWrite(
          request.url(),
          request.method(),
          payload,
          config,
          owned,
          metadata.formUuids[0],
          observationPolicy,
          encounterUuid,
        )
      ) {
        allowedSave = false; // A single allowed clinical POST per explicit Save click; no replay.
        await route.continue();
      } else {
        failedRequest = true;
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', () => {
      encounteredError = true;
    });
    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      if ([401, 403].includes(response.status())) authorizationFailed = true;
      if (pathname.includes('/ws/rest/v1/o3/forms/')) {
        schemaResponses += 1;
        if (!response.ok()) failedRequest = true;
      }
    });
    const tabs = page.getByRole('tablist', { name: /Pestañas de Consulta Externa|Consulta Externa tabs/i });
    const chiefComplaint = page.locator('textarea#motivoConsulta');
    const openAnamnesis = async () => {
      await tabs.getByRole('tab', { name: /^Anamnesis$/i }).click();
      await page.getByRole('button', { name: /Registrar Anamnesis|Record anamnesis/i }).click();
      await expect(chiefComplaint).toBeVisible();
      await expect(page.getByText(/Hubo un error con este formulario|There was an error with this form/i)).toHaveCount(
        0,
      );
    };
    const close = async () => {
      await page
        .getByRole('banner', { name: /Workspace Header|Encabezado del espacio de trabajo/i })
        .getByRole('button', { name: /^Cerrar$|^Close$/i })
        .click();
      await expect(chiefComplaint).toHaveCount(0);
    };
    await page.goto(`${config.spaBaseUrl}/patient/${owned.patientUuid}/chart/consulta-externa`);
    await expect(tabs).toBeVisible();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await openAnamnesis();
      await close();
    }
    await openAnamnesis();
    await tabs.getByRole('tab', { name: /^Examen físico$/i }).click();
    await page.getByRole('button', { name: physicalExamActionName }).click();
    await expect(
      page
        .getByRole('banner', { name: /Workspace Header|Encabezado del espacio de trabajo/i })
        .filter({ hasText: forms[1] }),
    ).toBeVisible();
    await expect(page.locator('textarea#estadoGeneral')).toBeVisible();
    await expect(page.getByText(/Hubo un error con este formulario|There was an error with this form/i)).toHaveCount(0);
    await openAnamnesis();
    const marker = `SYNTHETIC O3 FORMS ${owned.patientUuid}`;
    const persisted = async (expected: string) => {
      const response = await json<{ results?: Encounter[]; links?: Array<{ rel?: string }> }>(
        api,
        config,
        `encounter?${new URLSearchParams({ patient: owned.patientUuid, visit: owned.visitUuid, limit: '100', v: 'custom:(uuid,voided,patient:(uuid),visit:(uuid),form:(uuid),encounterType:(uuid),encounterProviders:(provider:(uuid)),obs:(voided,concept:(uuid),value))' })}`,
      );
      check(
        Array.isArray(response.results) && !response.links?.some((link) => link.rel === 'next'),
        'O3_ENCOUNTER_LIST_INCOMPLETE',
      );
      encounterUuid = verifyEncounter(response.results, owned, config, metadata, expected, encounterUuid);
      const observations = await json<{ results?: StoredObservation[]; links?: Array<{ rel?: string }> }>(
        api,
        config,
        `obs?${new URLSearchParams({ patient: owned.patientUuid, includeAll: 'true', limit: '100', v: 'custom:(uuid,concept:(uuid),person:(uuid),encounter:(uuid))' })}`,
      );
      check(
        Array.isArray(observations.results) && !observations.links?.some((link) => link.rel === 'next'),
        'O3_OBSERVATION_LIST_INCOMPLETE',
      );
      const verified = collectOwnedObservationConcepts(
        observations.results,
        owned,
        encounterUuid,
        observationPolicy.allowedConcepts,
      );
      check(verified.size > 0, 'O3_OBSERVATION_IDENTITIES_MISSING');
      observationPolicy.ownedObservationConcepts = verified;
    };
    for (const value of [marker, `${marker} EDITED`]) {
      await chiefComplaint.fill(value);
      allowedSave = true;
      const [saved] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.startsWith('/openmrs/ws/rest/v1/encounter') &&
            response.request().method() === 'POST',
        ),
        page.getByRole('button', { name: /^Guardar$|^Save$/i }).click(),
      ]);
      check(saved.ok(), 'O3_FORM_SAVE_FAILED');
      await persisted(value);
      await page.reload();
      await expect(tabs).toBeVisible();
      await openAnamnesis();
      await expect(chiefComplaint).toHaveValue(value);
      await persisted(value);
    }
    check(schemaResponses >= 2 && !failedRequest && !encounteredError, 'O3_BROWSER_ACCEPTANCE_FAILED');
  } catch (error) {
    acceptanceFailed = true;
    acceptanceError = error;
  }
  await finishO3BrowserAcceptance(browser, acceptanceFailed, authorizationFailed, acceptanceError);
}

/** Close the browser before propagating either browser or direct-API authorization failures. */
export async function finishO3BrowserAcceptance(
  browser: Pick<Browser, 'close'> | undefined,
  acceptanceFailed: boolean,
  authorizationFailed: boolean,
  acceptanceError?: unknown,
): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      throw new O3SmokeError('O3_BROWSER_SHUTDOWN_UNVERIFIED_RETAIN_JOURNAL');
    }
  }
  const directApiAuthorizationFailed =
    acceptanceError instanceof O3SmokeError && acceptanceError.message === 'O3_AUTHORIZATION_FAILED';
  check(!authorizationFailed && !directApiAuthorizationFailed, 'O3_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
  check(!acceptanceFailed, 'O3_BROWSER_ACCEPTANCE_FAILED');
}

/** The acceptance callback must close its browser before returning; all resources belong to the foundation. */
export async function runOwnedO3Acceptance(
  fixtures: Pick<SyntheticFixtures, 'create' | 'cleanup'>,
  acceptance: (owned: Owned) => Promise<void>,
): Promise<void> {
  let acceptancePassed = false;
  let cleanupAllowed = true;
  try {
    const owned = await fixtures.create('outpatient');
    await acceptance(owned);
    acceptancePassed = true;
  } catch (error) {
    if (
      error instanceof O3SmokeError &&
      ['O3_BROWSER_SHUTDOWN_UNVERIFIED_RETAIN_JOURNAL', 'O3_AUTHORIZATION_FAILED_RETAIN_JOURNAL'].includes(
        error.message,
      )
    )
      cleanupAllowed = false;
    // The foundation uses fixed authorization codes; never inspect or print response bodies.
    if (error instanceof Error && error.message === 'FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL')
      cleanupAllowed = false;
  }
  check(cleanupAllowed, 'O3_WRITES_STOPPED_RETAIN_JOURNAL');
  try {
    await fixtures.cleanup();
  } catch {
    throw new O3SmokeError('O3_CLEANUP_UNVERIFIED_RETAIN_JOURNAL');
  }
  check(acceptancePassed, 'O3_ACCEPTANCE_FAILED_CLEANUP_VERIFIED');
}

/** No dotenv, automatic auth-state files, retries, screenshots, traces, or raw diagnostics. */
export async function runO3Smoke(environment: NodeJS.ProcessEnv, mode: string): Promise<void> {
  const config = loadO3SmokeConfig(environment, mode);
  const api = await request.newContext({
    ignoreHTTPSErrors: config.ignoreHTTPSErrors,
    extraHTTPHeaders: {
      Authorization: `Basic ${Buffer.from(`${environment.E2E_USER_ADMIN_USERNAME}:${environment.E2E_USER_ADMIN_PASSWORD}`).toString('base64')}`,
    },
  });
  let journal: PrivateFixtureJournal | undefined;
  try {
    const session = await api.post(`${config.apiBaseUrl}/ws/rest/v1/session`, {
      maxRedirects: 0,
      maxRetries: 0,
      data: { locale: 'es', sessionLocation: config.locationUuid },
    });
    check(session.ok(), 'O3_LOGIN_FAILED');
    if (config.mode === 'cleanup') {
      journal = new PrivateFixtureJournal(config.journalDirectory);
      check(journal.read() !== undefined, 'O3_CLEANUP_JOURNAL_REQUIRED');
      await new SyntheticFixtures(api, journal, environment).cleanup();
      return;
    }
    const metadata = await preflightO3Forms(api, config);
    if (config.mode === 'preflight') return;
    journal = new PrivateFixtureJournal(config.journalDirectory);
    check(journal.read() === undefined, 'O3_EXISTING_JOURNAL_REQUIRES_CLEANUP_ONLY');
    const fixtures = new SyntheticFixtures(api, journal, environment);
    await runOwnedO3Acceptance(fixtures, (owned) => browserAcceptance(api, config, metadata, owned));
  } finally {
    try {
      journal?.close();
    } finally {
      await api.dispose();
    }
  }
}

if (require.main === module) {
  void runO3Smoke(process.env, process.argv[2] ?? '').then(
    () => {
      process.stdout.write(
        `PASSED: supervised O3 Forms ${process.argv[2]} stage only. Journal retained when applicable.\n`,
      );
    },
    (error: unknown) => {
      const code = error instanceof O3SmokeError ? error.message : 'O3_STAGE_FAILED_RETAIN_JOURNAL';
      process.stderr.write(`FAILED: ${code}. No raw diagnostics were recorded.\n`);
      process.exitCode = 1;
    },
  );
}
