import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { type APIRequestContext, type TestInfo } from '@playwright/test';
import { PrivateFixtureJournal } from '../../utils/e2e-fixture-journal';
import { type E2EBaseConfig, loadE2EBaseConfig } from '../../utils/e2e-gate-config';
import { FixtureAuthorizationError, SyntheticFixtures } from '../../utils/e2e-synthetic-fixtures';
import { getPatient, getVisit } from '../commands';
import { type Patient, type Visit } from '../commands/types';
import { laboratoryFixtureRequiredPrivileges, laboratoryOrderFixture } from './fixture-config';

export interface LaboratoryFixture {
  patient: Patient;
  visit: Visit;
}

export function loadLaboratoryFixtureEnvironment(environment: NodeJS.ProcessEnv): {
  config: E2EBaseConfig;
  environment: NodeJS.ProcessEnv;
} {
  if (environment.CI || environment.GITHUB_ACTIONS === 'true') {
    throw new Error('LABORATORY_CI_RECOVERY_RETENTION_UNAVAILABLE');
  }
  const config = loadE2EBaseConfig(environment);
  if (environment.E2E_LABORATORY_SUPERVISED_TARGET !== config.target) {
    throw new Error('LABORATORY_SUPERVISION_REQUIRED');
  }
  if (!/^[a-f0-9]{40}$/i.test(environment.E2E_FIXTURE_EXPECTED_SHA ?? '')) {
    throw new Error('LABORATORY_EXPECTED_SHA_REQUIRED');
  }
  let privileges: unknown;
  try {
    privileges = JSON.parse(environment.E2E_FIXTURE_REQUIRED_PRIVILEGES ?? '');
  } catch {
    throw new Error('LABORATORY_REQUIRED_PRIVILEGES_INCOMPLETE');
  }
  if (
    !Array.isArray(privileges) ||
    !privileges.every((name) => typeof name === 'string' && /^[A-Za-z][A-Za-z0-9 .:_-]{1,100}$/.test(name)) ||
    !laboratoryFixtureRequiredPrivileges.every((name) => privileges.includes(name))
  ) {
    throw new Error('LABORATORY_REQUIRED_PRIVILEGES_INCOMPLETE');
  }
  const pins = {
    E2E_FIXTURE_IDENTIFIER_SOURCE_UUID: laboratoryOrderFixture.identifierSourceUuid,
    E2E_FIXTURE_IDENTIFIER_TYPE_UUID: laboratoryOrderFixture.identifierTypeUuid,
    E2E_FIXTURE_VISIT_TYPE_UUID: laboratoryOrderFixture.visitTypeUuid,
  };
  for (const [key, expected] of Object.entries(pins)) {
    if (environment[key] !== undefined && environment[key] !== expected) {
      throw new Error('LABORATORY_FIXTURE_METADATA_OVERRIDE_REJECTED');
    }
  }
  return { config, environment: { ...environment, ...pins } };
}

/** One private journal per test attempt; reuse the existing ownership and recovery implementation. */
export async function withLaboratoryFixture(
  api: APIRequestContext,
  attempt: Pick<TestInfo, 'workerIndex' | 'retry'>,
  use: (fixture: LaboratoryFixture) => Promise<void>,
  environment: NodeJS.ProcessEnv = process.env,
  journalRoot = path.resolve(__dirname, '../../.synthetic-fixtures'),
) {
  const loaded = loadLaboratoryFixtureEnvironment(environment);
  mkdirSync(journalRoot, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(
    path.join(realpathSync(journalRoot), `laboratory-${attempt.workerIndex}-${attempt.retry}-`),
  );
  const journal = new PrivateFixtureJournal(directory);
  let fixtures: SyntheticFixtures | undefined;
  let authorizationFailed = false;
  const failures: unknown[] = [];
  let prepared: LaboratoryFixture | undefined;
  try {
    try {
      fixtures = new SyntheticFixtures(api, journal, loaded.environment);
      const session = await api.post(`${loaded.config.apiBaseUrl}/ws/rest/v1/session`, {
        data: { sessionLocation: loaded.config.locationUuid, locale: 'en' },
        maxRedirects: 0,
        maxRetries: 0,
      });
      if ([401, 403].includes(session.status())) {
        throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
      }
      if (!session.ok()) throw new Error();
      const { patientUuid, visitUuid } = await fixtures.create('outpatient');
      const patient = await getPatient(api, patientUuid);
      const visit = await getVisit(api, visitUuid);
      if (patient.uuid !== patientUuid || visit.uuid !== visitUuid) throw new Error();
      prepared = { patient, visit };
    } catch (error) {
      authorizationFailed = error instanceof FixtureAuthorizationError;
      throw new Error('LABORATORY_FIXTURE_SETUP_FAILED_RETAIN_JOURNAL');
    }
    await use(prepared);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (fixtures && !authorizationFailed) await fixtures.cleanup();
    } catch {
      failures.push(new Error('LABORATORY_FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL'));
    } finally {
      try {
        journal.close();
      } catch {
        failures.push(new Error('LABORATORY_JOURNAL_CLOSE_FAILED_RETAIN_STATE'));
      }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'LABORATORY_FIXTURE_FAILED_RETAIN_JOURNAL');
}
