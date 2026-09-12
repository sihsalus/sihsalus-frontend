import { type APIRequestContext, request } from '@playwright/test';
import { laboratoryOrderFixture } from '../laboratory/core/fixture-config';
import { getE2ECredentials } from './e2e-api';
import {
  type E2EBaseConfig,
  type E2EGateConfig,
  type E2EPatientIdentity,
  isSyntheticE2EPatient,
} from './e2e-gate-config';
import { shouldIgnoreHTTPSErrors } from './e2e-urls';

interface PatientFixture extends E2EPatientIdentity {
  uuid?: string;
  voided?: boolean;
  person?: E2EPatientIdentity['person'] & { voided?: boolean };
}

type SearchResponse<T> = { results?: Array<T>; links?: Array<{ rel?: string }> };

interface RemotePreflightOptions {
  createApiContext?: () => Promise<APIRequestContext>;
  requirePreparedOutpatientVisit?: boolean;
}

// Only errors created here may retain their message. Transport errors can imitate safe-looking codes.
class PreflightValidationError extends Error {}

type PreflightScope = 'BASE' | 'CLINICAL' | 'LABORATORY';
type PreflightStage = 'LOCATION' | 'SESSION' | 'PATIENT' | 'VISIT' | 'PROVIDER' | 'CONCEPT' | 'ORDER_TYPE';
type ReadPreflightResource = <T>(stage: PreflightStage, path: string, httpMessage?: string) => Promise<T>;

async function createDefaultApiContext(config: E2EBaseConfig): Promise<APIRequestContext> {
  const { username, password } = getE2ECredentials();
  return request.newContext({
    baseURL: `${config.apiBaseUrl}/ws/rest/v1/`,
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: { username, password },
  });
}

async function withPreflightContext(
  config: E2EBaseConfig,
  createApiContext: RemotePreflightOptions['createApiContext'],
  scope: PreflightScope,
  validate: (read: ReadPreflightResource) => Promise<unknown>,
): Promise<void> {
  let api: APIRequestContext;
  try {
    api = await (createApiContext ?? (() => createDefaultApiContext(config)))();
  } catch {
    throw new Error(`${scope}_CONTEXT_CREATE_FAILED`);
  }

  let failure: Error | undefined;
  let stage: PreflightStage = 'LOCATION';
  let operation = 'REQUEST_FAILED';
  const read: ReadPreflightResource = async <T>(resource: PreflightStage, path: string, httpMessage?: string) => {
    stage = resource;
    operation = 'REQUEST_FAILED';
    const response = await api.get(path);
    operation = 'RESPONSE_INVALID';
    if (!response.ok()) {
      const status = response.status();
      if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error();
      throw new PreflightValidationError(
        httpMessage
          ? `Clinical E2E remote preflight failed: ${httpMessage} (${status}).`
          : `${scope}_${stage}_HTTP_${status}`,
      );
    }
    operation = 'JSON_FAILED';
    const body: unknown = await response.json();
    operation = 'RESPONSE_INVALID';
    return body as T;
  };

  try {
    await validate(read);
  } catch (error) {
    // Do not retain external errors, their causes, stacks, request details or response bodies.
    failure = new Error(error instanceof PreflightValidationError ? error.message : `${scope}_${stage}_${operation}`);
  } finally {
    try {
      await api.dispose();
    } catch {
      failure = new Error(
        failure ? `${failure.message}; ${scope}_CONTEXT_DISPOSE_FAILED` : `${scope}_CONTEXT_DISPOSE_FAILED`,
      );
    }
  }
  if (failure) throw failure;
}

async function validateBaseResources(config: E2EBaseConfig, read: ReadPreflightResource) {
  const location = await read<{ uuid?: string; retired?: boolean }>(
    'LOCATION',
    `location/${config.locationUuid}?v=custom:(uuid,retired)`,
    'the configured login location could not be loaded',
  );
  if (location.uuid !== config.locationUuid || location.retired) {
    throw new PreflightValidationError(
      'Clinical E2E remote preflight failed: the configured login location is inactive.',
    );
  }

  const session = await read<{
    authenticated?: boolean;
    currentProvider?: { uuid?: string; retired?: boolean } | null;
  }>(
    'SESSION',
    `session?v=${encodeURIComponent('custom:(authenticated,currentProvider:(uuid,retired))')}`,
    'the configured account session could not be loaded',
  );
  if (!session.authenticated || !session.currentProvider?.uuid || session.currentProvider.retired) {
    throw new PreflightValidationError(
      'Clinical E2E remote preflight failed: the configured account must have an active clinical provider.',
    );
  }

  return {
    locationRetired: location.retired,
    providerUuid: session.currentProvider.uuid,
  };
}

/** Validates credentials, provider and location without requiring patient fixtures. */
export async function validateE2EBaseRemotePreflight(
  config: E2EBaseConfig,
  { createApiContext }: Pick<RemotePreflightOptions, 'createApiContext'> = {},
): Promise<void> {
  await withPreflightContext(config, createApiContext, 'BASE', (read) => validateBaseResources(config, read));
}

/** Validates the exact laboratory metadata before global setup permits fixture creation. */
export async function validateE2ELaboratoryRemotePreflight(
  config: E2EBaseConfig,
  { createApiContext }: Pick<RemotePreflightOptions, 'createApiContext'> = {},
): Promise<void> {
  await withPreflightContext(config, createApiContext, 'LABORATORY', async (read) => {
    const { locationRetired, providerUuid } = await validateBaseResources(config, read);
    if (locationRetired !== false) {
      throw new PreflightValidationError('LABORATORY_LOCATION_INACTIVE_OR_UNKNOWN');
    }

    const provider = await read<{
      uuid?: string;
      retired?: boolean;
    }>('PROVIDER', `provider/${encodeURIComponent(providerUuid)}?v=custom:(uuid,retired)`);
    if (provider?.uuid !== providerUuid || provider.retired !== false) {
      throw new PreflightValidationError('LABORATORY_PROVIDER_INACTIVE_OR_MISMATCH');
    }

    const concept = await read<{
      uuid?: string;
      retired?: boolean;
      conceptClass?: { uuid?: string; name?: string };
      datatype?: { name?: string };
    }>(
      'CONCEPT',
      `concept/${laboratoryOrderFixture.conceptUuid}?v=${encodeURIComponent(
        'custom:(uuid,retired,conceptClass:(uuid,name),datatype:(name))',
      )}`,
    );
    if (
      concept?.uuid !== laboratoryOrderFixture.conceptUuid ||
      concept.retired !== false ||
      !concept.conceptClass?.uuid ||
      concept.conceptClass.name !== 'Test' ||
      concept.datatype?.name !== 'Numeric'
    ) {
      throw new PreflightValidationError('LABORATORY_CONCEPT_INACTIVE_OR_INCOMPATIBLE');
    }

    const orderType = await read<{
      uuid?: string;
      retired?: boolean;
      javaClassName?: string;
      conceptClasses?: Array<{ uuid?: string }>;
    }>(
      'ORDER_TYPE',
      `ordertype/${laboratoryOrderFixture.orderTypeUuid}?v=${encodeURIComponent(
        'custom:(uuid,retired,javaClassName,conceptClasses:(uuid))',
      )}`,
    );
    if (
      orderType?.uuid !== laboratoryOrderFixture.orderTypeUuid ||
      orderType.retired !== false ||
      orderType.javaClassName !== 'org.openmrs.TestOrder' ||
      !Array.isArray(orderType.conceptClasses) ||
      !orderType.conceptClasses.some((conceptClass) => conceptClass?.uuid === concept.conceptClass?.uuid)
    ) {
      throw new PreflightValidationError('LABORATORY_ORDER_TYPE_INACTIVE_OR_INCOMPATIBLE');
    }
  });
}

/**
 * Checks remote state before Playwright creates any browser workers. Error
 * messages deliberately exclude patient bodies so a CI log cannot expose PHI.
 */
export async function validateE2ERemotePreflight(
  config: E2EGateConfig,
  { createApiContext, requirePreparedOutpatientVisit = true }: RemotePreflightOptions = {},
): Promise<void> {
  await withPreflightContext(config, createApiContext, 'CLINICAL', async (read) => {
    await validateBaseResources(config, read);
    const patientUuids = new Set([config.patientUuid, config.appointmentsPatientUuid]);
    for (const uuid of patientUuids) {
      const patient = await read<PatientFixture>(
        'PATIENT',
        `patient/${uuid}?v=${encodeURIComponent(
          'custom:(uuid,display,voided,identifiers:(identifier,voided),person:(display,voided,names:(givenName,middleName,familyName,voided)))',
        )}`,
        'a configured synthetic patient could not be loaded',
      );

      if (patient.uuid !== uuid || patient.voided || patient.person?.voided) {
        throw new PreflightValidationError(
          'Clinical E2E remote preflight failed: a configured synthetic patient is inactive.',
        );
      }
      if (!isSyntheticE2EPatient(patient)) {
        throw new PreflightValidationError(
          'Clinical E2E remote preflight failed: each configured patient must carry an E2E or SYNTHETIC marker.',
        );
      }
    }

    if (requirePreparedOutpatientVisit) {
      const visits = await read<
        SearchResponse<{
          uuid?: string;
          stopDatetime?: string | null;
          voided?: boolean;
        }>
      >(
        'VISIT',
        `visit?patient=${encodeURIComponent(config.patientUuid)}&includeInactive=false&limit=20&v=${encodeURIComponent(
          'custom:(uuid,voided,stopDatetime)',
        )}`,
        'the outpatient fixture visits could not be loaded',
      );
      if (
        !Array.isArray(visits.results) ||
        visits.results.some(
          (visit) =>
            !visit ||
            typeof visit !== 'object' ||
            Array.isArray(visit) ||
            typeof visit.uuid !== 'string' ||
            !visit.uuid.trim() ||
            typeof visit.voided !== 'boolean' ||
            (visit.stopDatetime !== null &&
              (typeof visit.stopDatetime !== 'string' || !Number.isFinite(Date.parse(visit.stopDatetime)))),
        ) ||
        (visits.links !== undefined &&
          visits.links !== null &&
          (!Array.isArray(visits.links) ||
            visits.links.some(
              (link) =>
                !link ||
                typeof link !== 'object' ||
                Array.isArray(link) ||
                typeof link.rel !== 'string' ||
                !link.rel.trim() ||
                link.rel === 'next',
            )))
      ) {
        throw new PreflightValidationError(
          'Clinical E2E remote preflight failed: outpatient visit listing is incomplete.',
        );
      }
      const activeVisits = visits.results.filter((visit) => visit.voided === false && visit.stopDatetime === null);
      if (activeVisits.length !== 1) {
        throw new PreflightValidationError(
          'Clinical E2E remote preflight failed: E2E_PATIENT_UUID must have exactly one active prepared visit.',
        );
      }
    }
  });
}
