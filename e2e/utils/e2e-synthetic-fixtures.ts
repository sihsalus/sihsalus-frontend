import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { type FixtureJournal } from './e2e-fixture-journal';
import { loadE2EBaseConfig } from './e2e-gate-config';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identityRepresentation =
  'custom:(uuid,voided,identifiers:(identifier,identifierType:(uuid)),person:(uuid,voided,names:(givenName,familyName)))';
type Label = 'outpatient' | 'appointments';
type Resource = 'obs' | 'order' | 'encounter' | 'visit' | 'patient' | 'person';
interface Identity {
  uuid?: string;
  voided?: boolean;
  identifiers?: Array<{ identifier?: string; identifierType?: { uuid?: string } }>;
  person?: { uuid?: string; voided?: boolean; names?: Array<{ givenName?: string; familyName?: string }> };
}
interface Dependency extends Identity {
  patient?: { uuid?: string };
  location?: { uuid?: string };
  visitType?: { uuid?: string };
}
interface RecordState {
  label: Label;
  familyName: string;
  identifier?: string;
  identifierAttempted?: boolean;
  patientAttempted?: boolean;
  uuid?: string;
  personUuid?: string;
  verified?: boolean;
  visitAttempted?: boolean;
  visitUuid?: string;
  visitStart?: string;
  cleaned?: boolean;
}
interface State {
  schemaVersion: 2;
  binding: string;
  run: string;
  patients: RecordState[];
}

class FixtureError extends Error {}
class FixtureAuthorizationError extends FixtureError {}
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new FixtureError(code);
}
function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  check(value, `${name}_REQUIRED`);
  return value;
}
function requiredUuid(environment: NodeJS.ProcessEnv, name: string): string {
  const value = required(environment, name);
  check(uuidPattern.test(value), `${name}_INVALID_UUID`);
  return value;
}
function familyName(run: string, label: Label): string {
  const token = run
    .replace(/-/g, '')
    .slice(0, 16)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number.parseInt(digit, 16)))
    .join('');
  return `SALUS ${token} ${label === 'outpatient' ? 'Chart' : 'Appointments'}`;
}

/**
 * Draft fixture foundation, deliberately not wired to global setup or CI.
 * Callers supply an authorized API context and retain the journal after closing it.
 * All REST requests use absolute URLs from the existing exact DEV/QLTY gate.
 */
export class SyntheticFixtures {
  private readonly config;
  private readonly sourceUuid: string;
  private readonly typeUuid: string;
  private readonly visitTypeUuid: string;
  private readonly expectedSha: string;
  private readonly privileges: string[];
  private readonly state: State;
  private busy = false;

  constructor(
    private readonly api: APIRequestContext,
    private readonly journal: FixtureJournal,
    environment: NodeJS.ProcessEnv,
  ) {
    this.config = loadE2EBaseConfig(environment);
    this.sourceUuid = requiredUuid(environment, 'E2E_FIXTURE_IDENTIFIER_SOURCE_UUID');
    this.typeUuid = requiredUuid(environment, 'E2E_FIXTURE_IDENTIFIER_TYPE_UUID');
    this.visitTypeUuid = requiredUuid(environment, 'E2E_FIXTURE_VISIT_TYPE_UUID');
    this.expectedSha = required(environment, 'E2E_FIXTURE_EXPECTED_SHA');
    check(/^[a-f0-9]{40}$/i.test(this.expectedSha), 'FIXTURE_EXPECTED_SHA_INVALID');
    let privileges: unknown;
    try {
      privileges = JSON.parse(required(environment, 'E2E_FIXTURE_REQUIRED_PRIVILEGES'));
    } catch {
      throw new FixtureError('FIXTURE_REQUIRED_PRIVILEGES_INVALID');
    }
    check(
      Array.isArray(privileges) &&
        privileges.length > 0 &&
        privileges.every((value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9 .:_-]{1,100}$/.test(value)),
      'FIXTURE_REQUIRED_PRIVILEGES_INVALID',
    );
    this.privileges = [...new Set(privileges as string[])].sort();
    const binding = JSON.stringify({
      ...this.config,
      sourceUuid: this.sourceUuid,
      typeUuid: this.typeUuid,
      visitTypeUuid: this.visitTypeUuid,
      expectedSha: this.expectedSha,
      privileges: this.privileges,
    });
    const existing = this.journal.read();
    if (existing === undefined) {
      this.state = { schemaVersion: 2, binding, run: randomUUID(), patients: [] };
      this.save();
    } else {
      check(existing !== null && typeof existing === 'object', 'FIXTURE_JOURNAL_INVALID');
      const candidate = existing as State;
      check(
        candidate.schemaVersion === 2 &&
          candidate.binding === binding &&
          uuidPattern.test(candidate.run) &&
          Array.isArray(candidate.patients) &&
          candidate.patients.length <= 2,
        'FIXTURE_JOURNAL_TARGET_OR_SCHEMA_MISMATCH',
      );
      check(
        new Set(candidate.patients.map((record) => record?.label)).size === candidate.patients.length,
        'FIXTURE_JOURNAL_DUPLICATE_LABEL',
      );
      for (const record of candidate.patients) {
        check(
          record &&
            ['outpatient', 'appointments'].includes(record.label) &&
            record.familyName === familyName(candidate.run, record.label),
          'FIXTURE_JOURNAL_MARKER_MISMATCH',
        );
        for (const key of ['uuid', 'personUuid', 'visitUuid'] as const)
          check(record[key] === undefined || uuidPattern.test(record[key]), 'FIXTURE_JOURNAL_UUID_INVALID');
        check(
          record.identifier === undefined || /^[A-Za-z0-9-]{1,100}$/.test(record.identifier),
          'FIXTURE_JOURNAL_IDENTIFIER_INVALID',
        );
        for (const key of ['identifierAttempted', 'patientAttempted', 'verified', 'visitAttempted', 'cleaned'] as const)
          check(record[key] === undefined || typeof record[key] === 'boolean', 'FIXTURE_JOURNAL_FLAG_INVALID');
      }
      this.state = candidate;
    }
  }

  private save(): void {
    this.journal.save(this.state);
  }

  private markCleaned(record: RecordState): void {
    record.cleaned = true;
    try {
      this.save();
    } catch (error) {
      delete record.cleaned;
      throw error;
    }
  }
  private url(resource: string): string {
    return `${this.config.apiBaseUrl}/ws/rest/v1/${resource}`;
  }
  private async request(method: 'get' | 'post' | 'delete', resource: string, data?: unknown): Promise<APIResponse> {
    try {
      const response = await this.api[method](this.url(resource), {
        maxRedirects: 0,
        maxRetries: 0,
        ...(method === 'get' ? {} : { data }),
      });
      if ([401, 403].includes(response.status()))
        throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
      return response;
    } catch (error) {
      if (error instanceof FixtureError) throw error;
      throw new FixtureError('FIXTURE_NETWORK_FAILURE_RETAIN_JOURNAL');
    }
  }
  private async json<T>(response: APIResponse): Promise<T> {
    check(response.ok(), `FIXTURE_HTTP_${response.status()}_RETAIN_JOURNAL`);
    try {
      return (await response.json()) as T;
    } catch {
      throw new FixtureError('FIXTURE_INVALID_JSON_RETAIN_JOURNAL');
    }
  }
  private async get<T>(resource: string): Promise<T> {
    return this.json<T>(await this.request('get', resource));
  }

  /** Never follows a server-provided next URL; retains state on truncation or repeated pages. */
  private async all<T>(resource: string, parameters: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    const seen = new Set<string>();
    for (let page = 0, start = 0; page < 100; page += 1) {
      const query = new URLSearchParams({ ...parameters, limit: '100', startIndex: String(start) });
      const body = await this.get<{ results?: T[]; links?: Array<{ rel?: string }> }>(`${resource}?${query}`);
      check(body && Array.isArray(body.results), 'FIXTURE_INVALID_LIST_RETAIN_JOURNAL');
      const signature = JSON.stringify(body.results);
      if (body.results.length > 0) {
        check(!seen.has(signature), 'FIXTURE_REPEATED_PAGE_RETAIN_JOURNAL');
        seen.add(signature);
        results.push(...body.results);
      }
      if (!body.links?.some(({ rel }) => rel === 'next') && body.results.length < 100) return results;
      check(body.results.length > 0, 'FIXTURE_EMPTY_NEXT_PAGE_RETAIN_JOURNAL');
      start += body.results.length;
    }
    throw new FixtureError('FIXTURE_PAGINATION_LIMIT_RETAIN_JOURNAL');
  }

  private owns(patient: Identity, record: RecordState): boolean {
    return Boolean(
      patient &&
        uuidPattern.test(patient.uuid ?? '') &&
        (!record.uuid || patient.uuid === record.uuid) &&
        patient.identifiers?.some(
          (identifier) =>
            identifier.identifier === record.identifier && identifier.identifierType?.uuid === this.typeUuid,
        ) &&
        patient.person?.names?.some((name) => name.givenName === 'SYNTHETIC' && name.familyName === record.familyName),
    );
  }

  private async recover(record: RecordState): Promise<Identity | undefined> {
    if (!record.identifier) return undefined;
    const matches = (
      await this.all<Identity>('patient', {
        identifier: record.identifier,
        includeAll: 'true',
        v: identityRepresentation,
      })
    ).filter((patient) => this.owns(patient, record));
    check(matches.length <= 1, 'FIXTURE_AMBIGUOUS_PATIENT_RETAIN_JOURNAL');
    const patient = matches[0];
    if (patient) {
      check(uuidPattern.test(patient.person?.uuid ?? ''), 'FIXTURE_PERSON_UUID_MISSING');
      record.uuid = patient.uuid;
      record.personUuid = patient.person?.uuid;
      record.verified = true;
      this.save();
    }
    return patient;
  }

  private async read(record: RecordState): Promise<Identity | undefined> {
    if (!record.uuid) return this.recover(record);
    const response = await this.request(
      'get',
      `patient/${record.uuid}?v=${encodeURIComponent(identityRepresentation)}`,
    );
    if (response.status() === 404) {
      throw new FixtureError('FIXTURE_PATIENT_MISSING_RETAIN_JOURNAL');
    }
    let patient: Identity;
    if (response.status() === 400) {
      patient = await this.get<Identity>(`patient/${record.uuid}?v=custom:(uuid,voided,person:(uuid,voided))`);
      check(patient.uuid === record.uuid && patient.voided === true, 'FIXTURE_VOID_STATE_UNVERIFIED');
    } else patient = await this.json<Identity>(response);
    if (patient.voided === true && !this.owns(patient, record)) {
      check(
        patient.uuid === record.uuid && patient.person?.uuid === record.personUuid,
        'FIXTURE_VOID_IDENTITY_MISMATCH',
      );
      const identifiers = await this.all<NonNullable<Identity['identifiers']>[number]>(
        `patient/${record.uuid}/identifier`,
        { includeAll: 'true', v: 'custom:(identifier,identifierType:(uuid))' },
      );
      const names = await this.all<{ givenName?: string; familyName?: string }>(`person/${record.personUuid}/name`, {
        includeAll: 'true',
        v: 'custom:(givenName,familyName)',
      });
      patient = { ...patient, identifiers, person: { ...patient.person, names } };
    }
    check(
      this.owns(patient, record) && uuidPattern.test(patient.person?.uuid ?? ''),
      'FIXTURE_PATIENT_OWNERSHIP_MISMATCH',
    );
    record.personUuid = patient.person?.uuid;
    record.verified = true;
    this.save();
    return patient;
  }

  private async preflight(): Promise<'REQUIRED' | 'NOT_USED'> {
    const session = await this.get<{
      authenticated?: boolean;
      currentProvider?: { uuid?: string; retired?: boolean };
      sessionLocation?: { uuid?: string };
      user?: { retired?: boolean; privileges?: Array<{ name?: string; retired?: boolean }> };
    }>(
      'session?v=custom:(authenticated,currentProvider:(uuid,retired),sessionLocation:(uuid),user:(retired,privileges:(name,retired)))',
    );
    check(
      session.authenticated === true &&
        uuidPattern.test(session.currentProvider?.uuid ?? '') &&
        session.currentProvider?.retired === false &&
        session.user?.retired === false &&
        session.sessionLocation?.uuid === this.config.locationUuid,
      'FIXTURE_SESSION_OR_LOCATION_UNVERIFIED',
    );
    const assigned = new Set(session.user?.privileges?.filter(({ retired }) => !retired).map(({ name }) => name));
    check(
      this.privileges.every((privilege) => assigned.has(privilege)),
      'FIXTURE_REQUIRED_PRIVILEGES_MISSING',
    );
    const location = await this.get<{ uuid?: string; retired?: boolean }>(
      `location/${this.config.locationUuid}?v=custom:(uuid,retired)`,
    );
    check(location.uuid === this.config.locationUuid && location.retired === false, 'FIXTURE_LOCATION_INACTIVE');
    const source = await this.get<{ uuid?: string; retired?: boolean; identifierType?: { uuid?: string } }>(
      `idgen/identifiersource/${this.sourceUuid}?v=custom:(uuid,retired,identifierType:(uuid))`,
    );
    check(
      source.uuid === this.sourceUuid && source.retired === false && source.identifierType?.uuid === this.typeUuid,
      'FIXTURE_IDENTIFIER_SOURCE_MISMATCH',
    );
    const type = await this.get<{ uuid?: string; retired?: boolean; locationBehavior?: string }>(
      `patientidentifiertype/${this.typeUuid}?v=custom:(uuid,retired,locationBehavior)`,
    );
    check(
      type.uuid === this.typeUuid &&
        type.retired === false &&
        (type.locationBehavior === 'REQUIRED' || type.locationBehavior === 'NOT_USED'),
      'FIXTURE_IDENTIFIER_TYPE_UNSUPPORTED',
    );
    const types = await this.all<{ uuid?: string; retired?: boolean; required?: boolean }>('patientidentifiertype', {
      v: 'custom:(uuid,retired,required)',
    });
    check(
      types.filter((candidate) => candidate.required && !candidate.retired).every(({ uuid }) => uuid === this.typeUuid),
      'FIXTURE_ADDITIONAL_REQUIRED_IDENTIFIER',
    );
    const visitType = await this.get<{ uuid?: string; retired?: boolean }>(
      `visittype/${this.visitTypeUuid}?v=custom:(uuid,retired)`,
    );
    check(visitType.uuid === this.visitTypeUuid && visitType.retired === false, 'FIXTURE_VISIT_TYPE_INACTIVE');
    return type.locationBehavior;
  }

  private async exclusively<T>(operation: () => Promise<T>): Promise<T> {
    check(!this.busy, 'FIXTURE_OPERATION_ALREADY_RUNNING');
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }

  create(label: Label): Promise<{ patientUuid: string; visitUuid: string }> {
    return this.exclusively(() => this.createFixture(label));
  }

  private async createFixture(label: Label): Promise<{ patientUuid: string; visitUuid: string }> {
    check(['outpatient', 'appointments'].includes(label), 'FIXTURE_LABEL_INVALID');
    let build: APIResponse;
    try {
      build = await this.api.get(`${this.config.spaBaseUrl}/build-info.json`, { maxRedirects: 0, maxRetries: 0 });
    } catch {
      throw new FixtureError('FIXTURE_BUILD_UNAVAILABLE');
    }
    const info = await this.json<{ gitSha?: string }>(build);
    check(info.gitSha === this.expectedSha, 'FIXTURE_BUILD_SHA_MISMATCH');
    const locationBehavior = await this.preflight();
    let record = this.state.patients.find((candidate) => candidate.label === label);
    if (!record) {
      record = { label, familyName: familyName(this.state.run, label) };
      this.state.patients.push(record);
      this.save();
    }
    check(!record.cleaned, 'FIXTURE_ALREADY_CLEANED');
    if (!record.identifier) {
      check(!record.identifierAttempted, 'FIXTURE_IDENTIFIER_RESPONSE_UNRESOLVED');
      record.identifierAttempted = true;
      this.save();
      const generated = await this.json<{ identifier?: string }>(
        await this.request('post', `idgen/identifiersource/${this.sourceUuid}/identifier`, {}),
      );
      check(
        typeof generated.identifier === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(generated.identifier),
        'FIXTURE_IDENTIFIER_INVALID',
      );
      record.identifier = generated.identifier;
      this.save();
    }
    if (!record.patientAttempted) {
      const existing = await this.all<Identity>('patient', {
        identifier: record.identifier,
        includeAll: 'true',
        v: identityRepresentation,
      });
      check(existing.length === 0, 'FIXTURE_IDENTIFIER_ALREADY_USED');
      record.patientAttempted = true;
      this.save();
      const created = await this.json<Identity>(
        await this.request('post', 'patient', {
          identifiers: [
            {
              identifier: record.identifier,
              identifierType: this.typeUuid,
              preferred: true,
              ...(locationBehavior === 'REQUIRED' ? { location: this.config.locationUuid } : {}),
            },
          ],
          person: {
            gender: 'F',
            birthdate: '2000-01-01',
            birthdateEstimated: false,
            names: [{ givenName: 'SYNTHETIC', familyName: record.familyName, preferred: true }],
          },
        }),
      );
      check(uuidPattern.test(created.uuid ?? ''), 'FIXTURE_CREATED_UUID_MISSING');
      record.uuid = created.uuid;
      this.save();
    }
    const patient = await this.read(record);
    check(
      patient && record.uuid && patient.voided === false && patient.person?.voided === false,
      'FIXTURE_PATIENT_CREATE_UNRESOLVED',
    );
    await this.recoverVisit(record);
    if (!record.visitAttempted) {
      record.visitAttempted = true;
      record.visitStart = new Date(Date.now() - 1000).toISOString();
      this.save();
      const visit = await this.json<Dependency>(
        await this.request('post', 'visit', {
          patient: record.uuid,
          location: this.config.locationUuid,
          visitType: this.visitTypeUuid,
          startDatetime: record.visitStart,
        }),
      );
      check(uuidPattern.test(visit.uuid ?? ''), 'FIXTURE_CREATED_VISIT_UUID_MISSING');
      record.visitUuid = visit.uuid;
      this.save();
    }
    const visit = await this.get<Dependency>(
      `visit/${record.visitUuid}?v=custom:(uuid,voided,patient:(uuid),location:(uuid),visitType:(uuid))`,
    );
    check(
      visit.uuid === record.visitUuid &&
        visit.voided === false &&
        visit.patient?.uuid === record.uuid &&
        visit.location?.uuid === this.config.locationUuid &&
        visit.visitType?.uuid === this.visitTypeUuid,
      'FIXTURE_CREATED_VISIT_MISMATCH',
    );
    return { patientUuid: record.uuid, visitUuid: record.visitUuid as string };
  }

  private async recoverVisit(record: RecordState): Promise<void> {
    if (!record.visitAttempted || record.visitUuid) return;
    check(record.uuid, 'FIXTURE_PATIENT_UUID_REQUIRED');
    const visits = await this.all<Dependency>('visit', {
      patient: record.uuid,
      includeInactive: 'true',
      includeAll: 'true',
      v: 'custom:(uuid,voided,patient:(uuid),location:(uuid),visitType:(uuid))',
    });
    const matches = visits.filter(
      (visit) =>
        visit.patient?.uuid === record.uuid &&
        visit.location?.uuid === this.config.locationUuid &&
        visit.visitType?.uuid === this.visitTypeUuid,
    );
    const recovered = matches[0];
    check(
      matches.length === 1 && recovered && uuidPattern.test(recovered.uuid ?? ''),
      'FIXTURE_VISIT_CREATE_UNRESOLVED',
    );
    record.visitUuid = recovered.uuid;
    this.save();
  }

  private async cleanupPerson(record: RecordState): Promise<void> {
    check(record.personUuid, 'FIXTURE_PERSON_UUID_REQUIRED');
    const person = await this.get<{
      uuid?: string;
      voided?: boolean;
      names?: Array<{ givenName?: string; familyName?: string }>;
    }>(`person/${record.personUuid}?v=custom:(uuid,voided,names:(givenName,familyName))`);
    check(person.uuid === record.personUuid, 'FIXTURE_PERSON_UUID_MISMATCH');
    if (person.voided === true) return;
    check(
      person.names?.some((name) => name.givenName === 'SYNTHETIC' && name.familyName === record.familyName),
      'FIXTURE_PERSON_OWNERSHIP_MISMATCH',
    );
    await this.void('person', record.personUuid);
  }

  private async void(resource: Resource, uuid: string): Promise<void> {
    const deleted = await this.request(
      'delete',
      `${resource}/${uuid}?reason=Automated%20SYNTHETIC%20fixture%20cleanup`,
      {},
    );
    check(deleted.ok() || deleted.status() === 404, `FIXTURE_VOID_HTTP_${deleted.status()}_RETAIN_JOURNAL`);
    const verification = await this.request('get', `${resource}/${uuid}?v=custom:(uuid,voided)`);
    if (verification.status() === 404) return;
    const body = await this.json<Identity>(verification);
    check(body.uuid === uuid && body.voided === true, 'FIXTURE_VOID_UNVERIFIED_RETAIN_JOURNAL');
  }

  /** Complete each dependency level before voiding its parents; keep all unresolved state. */
  cleanup(): Promise<void> {
    return this.exclusively(() => this.cleanupFixtures());
  }

  private async cleanupFixtures(): Promise<void> {
    // Cleanup deliberately does not require the old frontend SHA, which may have moved.
    await this.preflight();
    const failures: string[] = [];
    for (const record of this.state.patients) {
      if (record.cleaned) continue;
      try {
        const patient = await this.read(record);
        if (!patient) {
          check(!record.patientAttempted || record.verified, 'FIXTURE_UNRESOLVED_PATIENT_RETAIN_JOURNAL');
          this.markCleaned(record);
          continue;
        }
        check(record.uuid && record.personUuid && this.owns(patient, record), 'FIXTURE_PATIENT_OWNERSHIP_MISMATCH');
        await this.recoverVisit(record);
        for (const resource of ['obs', 'order', 'encounter', 'visit'] as const) {
          const dependencies = await this.all<Dependency>(resource, {
            patient: record.uuid,
            includeAll: 'true',
            ...(resource === 'visit' ? { includeInactive: 'true' } : {}),
            v: resource === 'obs' ? 'custom:(uuid,voided,person:(uuid))' : 'custom:(uuid,voided,patient:(uuid))',
          });
          check(
            dependencies.every(
              (dependency) =>
                uuidPattern.test(dependency.uuid ?? '') &&
                (resource === 'obs'
                  ? dependency.person?.uuid === record.personUuid
                  : dependency.patient?.uuid === record.uuid),
            ),
            'FIXTURE_DEPENDENCY_OWNERSHIP_MISMATCH',
          );
          for (const dependency of dependencies) {
            if (dependency.voided !== true) await this.void(resource, dependency.uuid as string);
          }
        }
        if (!patient.voided) await this.void('patient', record.uuid);
        const after = await this.read(record);
        check(!after || after.voided === true, 'FIXTURE_PATIENT_CLEANUP_UNVERIFIED');
        await this.cleanupPerson(record);
        this.markCleaned(record);
      } catch (error) {
        if (error instanceof FixtureAuthorizationError) throw error;
        failures.push(record.label);
      }
    }
    check(failures.length === 0, 'FIXTURE_CLEANUP_FAILED_RETAIN_JOURNAL');
  }
}
