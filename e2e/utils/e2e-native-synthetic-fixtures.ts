import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { type APIRequestContext, type APIResponse, test as base, type TestInfo } from '@playwright/test';
import { openmrsRestApi } from './e2e-api';
import { PrivateFixtureJournal } from './e2e-fixture-journal';
import { loadE2EBaseConfig } from './e2e-gate-config';
import { FixtureAuthorizationError, SyntheticFixtures } from './e2e-synthetic-fixtures';

// SIHSALUS content 64fdf166: OCL sihsalus 2157 contains Consulta Ambulatoria (2152).
export const nativeInterconsultationMetadata = {
  destinationConceptSetUuid: '4bf3f465-ac91-44fa-9b1f-173daf0c89a0',
  destinationConceptUuid: '0f819fa7-864f-4f60-a50a-03d0b82daa73',
  requestEncounterTypeUuid: 'e4834799-7f43-4552-a6f3-2656880ca52f',
} as const;

export interface NativeSyntheticFixture {
  patientUuid: string;
  visitUuid: string;
  familyName: string;
  locationUuid: string;
  providerUuid: string;
  serviceConcept: { uuid: string; display: string };
  encounterTypeUuid: string;
}

async function read<T>(response: APIResponse): Promise<T> {
  if ([401, 403].includes(response.status())) {
    throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
  }
  if (!response.ok()) throw new Error('NATIVE_FIXTURE_READ_FAILED');
  return response.json();
}

/** Only the two mutating native interconsultation specs opt into this lifecycle. */
export async function withNativeSyntheticFixture(
  api: APIRequestContext,
  attempt: Pick<TestInfo, 'project' | 'workerIndex' | 'retry' | 'skip'> & Partial<Pick<TestInfo, 'errors'>>,
  use: (fixture: NativeSyntheticFixture) => Promise<void>,
  environment: NodeJS.ProcessEnv = process.env,
  journalRoot = path.resolve(__dirname, '../.synthetic-fixtures'),
): Promise<void> {
  // Body-level skips run after fixture setup. Skip here, before any requests or journal creation.
  if (attempt.project.name !== 'desktop') {
    attempt.skip(true, 'Mutating interconsultation flows run only on desktop');
    return;
  }
  if (environment.CI || environment.GITHUB_ACTIONS === 'true') {
    throw new Error('NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE');
  }
  const config = loadE2EBaseConfig(environment);
  if (environment.E2E_NATIVE_SUPERVISED_TARGET !== config.target) {
    throw new Error('NATIVE_FIXTURE_SUPERVISION_REQUIRED');
  }
  mkdirSync(journalRoot, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(
    path.join(realpathSync(journalRoot), `native-${attempt.workerIndex}-${attempt.retry}-`),
  );
  const journal = new PrivateFixtureJournal(directory);
  let fixtures: SyntheticFixtures | undefined;
  let authorizationFailed = false;
  const failures: unknown[] = [];
  try {
    let prepared: NativeSyntheticFixture;
    try {
      // The foundation owns configuration validation, write intent, identity and dependency recovery.
      fixtures = new SyntheticFixtures(api, journal, environment);
      const sessionResponse = await api.post(`${config.apiBaseUrl}/ws/rest/v1/session`, {
        data: { sessionLocation: config.locationUuid, locale: 'es' },
        maxRedirects: 0,
        maxRetries: 0,
      });
      if ([401, 403].includes(sessionResponse.status())) {
        throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
      }
      if (!sessionResponse.ok()) throw new Error('NATIVE_FIXTURE_SESSION_FAILED');
      const encounterType = await read<{ uuid?: string; retired?: boolean }>(
        await api.get(
          `${config.apiBaseUrl}/ws/rest/v1/encountertype/${nativeInterconsultationMetadata.requestEncounterTypeUuid}?v=custom:(uuid,retired)`,
          { maxRedirects: 0, maxRetries: 0 },
        ),
      );
      const serviceConcept = await read<{ uuid?: string; display?: string; retired?: boolean }>(
        await api.get(
          `${config.apiBaseUrl}/ws/rest/v1/concept/${nativeInterconsultationMetadata.destinationConceptUuid}?v=custom:(uuid,display,retired)`,
          { maxRedirects: 0, maxRetries: 0 },
        ),
      );
      const conceptSet = await read<{ uuid?: string; retired?: boolean; setMembers?: Array<{ uuid?: string }> }>(
        await api.get(
          `${config.apiBaseUrl}/ws/rest/v1/concept/${nativeInterconsultationMetadata.destinationConceptSetUuid}?v=custom:(uuid,retired,setMembers:(uuid))`,
          { maxRedirects: 0, maxRetries: 0 },
        ),
      );
      if (
        encounterType.uuid !== nativeInterconsultationMetadata.requestEncounterTypeUuid ||
        encounterType.retired !== false ||
        serviceConcept.uuid !== nativeInterconsultationMetadata.destinationConceptUuid ||
        serviceConcept.retired !== false ||
        !serviceConcept.display?.trim() ||
        conceptSet.uuid !== nativeInterconsultationMetadata.destinationConceptSetUuid ||
        conceptSet.retired !== false ||
        !conceptSet.setMembers?.some(({ uuid }) => uuid === serviceConcept.uuid)
      ) {
        throw new Error('NATIVE_INTERCONSULTATION_METADATA_UNVERIFIED');
      }
      const created = await fixtures.create('outpatient');
      const patient = await read<{
        uuid?: string;
        person?: { names?: Array<{ givenName?: string; familyName?: string }> };
      }>(
        await api.get(
          `${config.apiBaseUrl}/ws/rest/v1/patient/${created.patientUuid}?v=custom:(uuid,person:(names:(givenName,familyName)))`,
          { maxRedirects: 0, maxRetries: 0 },
        ),
      );
      const session = await read<{ currentProvider?: { uuid?: string } }>(
        await api.get(`${config.apiBaseUrl}/ws/rest/v1/session`, { maxRedirects: 0, maxRetries: 0 }),
      );
      const familyName = patient.person?.names?.find((name) => name.givenName === 'SYNTHETIC')?.familyName;
      if (patient.uuid !== created.patientUuid || !familyName || !session.currentProvider?.uuid) {
        throw new Error('NATIVE_FIXTURE_CONTEXT_UNVERIFIED');
      }
      prepared = {
        ...created,
        familyName,
        locationUuid: config.locationUuid,
        providerUuid: session.currentProvider.uuid,
        serviceConcept: { uuid: serviceConcept.uuid, display: serviceConcept.display },
        encounterTypeUuid: encounterType.uuid,
      };
    } catch (error) {
      authorizationFailed = error instanceof FixtureAuthorizationError;
      throw new Error('NATIVE_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL');
    }
    await use(prepared);
  } catch (error) {
    authorizationFailed ||= error instanceof FixtureAuthorizationError;
    failures.push(error);
  } finally {
    // Playwright records body/poll failures on TestInfo instead of rejecting fixture use().
    authorizationFailed ||= Boolean(
      attempt.errors?.some(({ message }) => message?.includes('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL')),
    );
    try {
      if (fixtures && !authorizationFailed) await fixtures.cleanup();
    } catch {
      failures.push(new Error('NATIVE_FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL'));
    } finally {
      try {
        journal.close();
      } catch {
        failures.push(new Error('NATIVE_FIXTURE_JOURNAL_CLOSE_FAILED_RETAIN_STATE'));
      }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'NATIVE_FIXTURE_FAILED_RETAIN_JOURNAL');
}

export const test = base.extend<{ nativeSyntheticFixture: NativeSyntheticFixture }, { api: APIRequestContext }>({
  api: [openmrsRestApi, { scope: 'worker' }],
  nativeSyntheticFixture: async ({ api }, use, testInfo) => withNativeSyntheticFixture(api, testInfo, use),
});
