import { type APIRequestContext, type APIResponse, request } from '@playwright/test';
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

async function requireOk(response: APIResponse, message: string) {
  if (!response.ok()) {
    throw new Error(`Clinical E2E remote preflight failed: ${message} (${response.status()}).`);
  }
}

async function createDefaultApiContext(config: E2EBaseConfig): Promise<APIRequestContext> {
  const { username, password } = getE2ECredentials();
  return request.newContext({
    baseURL: `${config.apiBaseUrl}/ws/rest/v1/`,
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: { username, password },
  });
}

async function validateBaseResources(config: E2EBaseConfig, api: APIRequestContext) {
  const locationResponse = await api.get(`location/${config.locationUuid}?v=custom:(uuid,retired)`);
  await requireOk(locationResponse, 'the configured login location could not be loaded');
  const location = (await locationResponse.json()) as { uuid?: string; retired?: boolean };
  if (location.uuid !== config.locationUuid || location.retired) {
    throw new Error('Clinical E2E remote preflight failed: the configured login location is inactive.');
  }

  const sessionResponse = await api.get(
    `session?v=${encodeURIComponent('custom:(authenticated,currentProvider:(uuid,retired))')}`,
  );
  await requireOk(sessionResponse, 'the configured account session could not be loaded');
  const session = (await sessionResponse.json()) as {
    authenticated?: boolean;
    currentProvider?: { uuid?: string; retired?: boolean } | null;
  };
  if (!session.authenticated || !session.currentProvider?.uuid || session.currentProvider.retired) {
    throw new Error(
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
  const api = await (createApiContext ?? (() => createDefaultApiContext(config)))();
  try {
    await validateBaseResources(config, api);
  } finally {
    await api.dispose();
  }
}

/** Validates the exact laboratory metadata before global setup permits fixture creation. */
export async function validateE2ELaboratoryRemotePreflight(
  config: E2EBaseConfig,
  { createApiContext }: Pick<RemotePreflightOptions, 'createApiContext'> = {},
): Promise<void> {
  let api: APIRequestContext;
  try {
    api = await (createApiContext ?? (() => createDefaultApiContext(config)))();
  } catch {
    throw new Error('LABORATORY_CONTEXT_CREATE_FAILED');
  }
  let failure: Error | undefined;
  try {
    const { locationRetired, providerUuid } = await validateBaseResources(config, api);
    if (locationRetired !== false) {
      throw new Error('LABORATORY_LOCATION_INACTIVE_OR_UNKNOWN');
    }

    const providerResponse = await api.get(`provider/${encodeURIComponent(providerUuid)}?v=custom:(uuid,retired)`);
    if (!providerResponse.ok()) {
      throw new Error(`LABORATORY_PROVIDER_HTTP_${providerResponse.status()}`);
    }
    const provider = (await providerResponse.json()) as {
      uuid?: string;
      retired?: boolean;
    } | null;
    if (provider?.uuid !== providerUuid || provider.retired !== false) {
      throw new Error('LABORATORY_PROVIDER_INACTIVE_OR_MISMATCH');
    }

    const conceptResponse = await api.get(
      `concept/${laboratoryOrderFixture.conceptUuid}?v=${encodeURIComponent(
        'custom:(uuid,retired,conceptClass:(uuid,name),datatype:(name))',
      )}`,
    );
    if (!conceptResponse.ok()) {
      throw new Error(`LABORATORY_CONCEPT_HTTP_${conceptResponse.status()}`);
    }
    const concept = (await conceptResponse.json()) as {
      uuid?: string;
      retired?: boolean;
      conceptClass?: { uuid?: string; name?: string };
      datatype?: { name?: string };
    } | null;
    if (
      concept?.uuid !== laboratoryOrderFixture.conceptUuid ||
      concept.retired !== false ||
      !concept.conceptClass?.uuid ||
      concept.conceptClass.name !== 'Test' ||
      concept.datatype?.name !== 'Numeric'
    ) {
      throw new Error('LABORATORY_CONCEPT_INACTIVE_OR_INCOMPATIBLE');
    }

    const orderTypeResponse = await api.get(
      `ordertype/${laboratoryOrderFixture.orderTypeUuid}?v=${encodeURIComponent(
        'custom:(uuid,retired,javaClassName,conceptClasses:(uuid))',
      )}`,
    );
    if (!orderTypeResponse.ok()) {
      throw new Error(`LABORATORY_ORDER_TYPE_HTTP_${orderTypeResponse.status()}`);
    }
    const orderType = (await orderTypeResponse.json()) as {
      uuid?: string;
      retired?: boolean;
      javaClassName?: string;
      conceptClasses?: Array<{ uuid?: string }>;
    } | null;
    if (
      orderType?.uuid !== laboratoryOrderFixture.orderTypeUuid ||
      orderType.retired !== false ||
      orderType.javaClassName !== 'org.openmrs.TestOrder' ||
      !Array.isArray(orderType.conceptClasses) ||
      !orderType.conceptClasses.some((conceptClass) => conceptClass?.uuid === concept.conceptClass?.uuid)
    ) {
      throw new Error('LABORATORY_ORDER_TYPE_INACTIVE_OR_INCOMPATIBLE');
    }
  } catch (error) {
    // Do not expose response bodies or request details from transport/JSON errors.
    failure =
      error instanceof Error && /^LABORATORY_[A-Z_]+(?:_\d{3})?$/.test(error.message)
        ? new Error(error.message)
        : new Error('LABORATORY_METADATA_REQUEST_FAILED');
  } finally {
    try {
      await api.dispose();
    } catch {
      failure = new Error(
        failure ? `${failure.message}; LABORATORY_CONTEXT_DISPOSE_FAILED` : 'LABORATORY_CONTEXT_DISPOSE_FAILED',
      );
    }
  }
  if (failure) throw failure;
}

/**
 * Checks remote state before Playwright creates any browser workers. Error
 * messages deliberately exclude patient bodies so a CI log cannot expose PHI.
 */
export async function validateE2ERemotePreflight(
  config: E2EGateConfig,
  { createApiContext, requirePreparedOutpatientVisit = true }: RemotePreflightOptions = {},
): Promise<void> {
  const api = await (createApiContext ?? (() => createDefaultApiContext(config)))();

  try {
    await validateBaseResources(config, api);
    const patientUuids = new Set([config.patientUuid, config.appointmentsPatientUuid]);
    for (const uuid of patientUuids) {
      const response = await api.get(
        `patient/${uuid}?v=${encodeURIComponent(
          'custom:(uuid,display,voided,identifiers:(identifier,voided),person:(display,voided,names:(givenName,middleName,familyName,voided)))',
        )}`,
      );
      await requireOk(response, 'a configured synthetic patient could not be loaded');
      const patient = (await response.json()) as PatientFixture;

      if (patient.uuid !== uuid || patient.voided || patient.person?.voided) {
        throw new Error('Clinical E2E remote preflight failed: a configured synthetic patient is inactive.');
      }
      if (!isSyntheticE2EPatient(patient)) {
        throw new Error(
          'Clinical E2E remote preflight failed: each configured patient must carry an E2E or SYNTHETIC marker.',
        );
      }
    }

    if (requirePreparedOutpatientVisit) {
      const visitResponse = await api.get(
        `visit?patient=${encodeURIComponent(config.patientUuid)}&includeInactive=false&limit=20&v=${encodeURIComponent(
          'custom:(uuid,voided,stopDatetime)',
        )}`,
      );
      await requireOk(visitResponse, 'the outpatient fixture visits could not be loaded');
      const visits = (await visitResponse.json()) as SearchResponse<{
        stopDatetime?: string | null;
        voided?: boolean;
      }>;
      if (!Array.isArray(visits.results) || visits.links?.some(({ rel }) => rel === 'next')) {
        throw new Error('Clinical E2E remote preflight failed: outpatient visit listing is incomplete.');
      }
      const activeVisits = visits.results.filter((visit) => !visit.voided && !visit.stopDatetime);
      if (activeVisits.length !== 1) {
        throw new Error(
          'Clinical E2E remote preflight failed: E2E_PATIENT_UUID must have exactly one active prepared visit.',
        );
      }
    }
  } finally {
    await api.dispose();
  }
}
