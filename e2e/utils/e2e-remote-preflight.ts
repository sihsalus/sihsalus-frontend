import { type APIRequestContext, type APIResponse, request } from '@playwright/test';
import { getE2ECredentials } from './e2e-api';
import { type E2EGateConfig, type E2EPatientIdentity, isSyntheticE2EPatient } from './e2e-gate-config';
import { shouldIgnoreHTTPSErrors } from './e2e-urls';

interface PatientFixture extends E2EPatientIdentity {
  uuid?: string;
  voided?: boolean;
  person?: E2EPatientIdentity['person'] & { voided?: boolean };
}

type SearchResponse<T> = { results?: Array<T> };

interface RemotePreflightOptions {
  createApiContext?: () => Promise<APIRequestContext>;
  requirePreparedOutpatientVisit?: boolean;
}

async function requireOk(response: APIResponse, message: string) {
  if (!response.ok()) {
    throw new Error(`Clinical E2E remote preflight failed: ${message} (${response.status()}).`);
  }
}

/**
 * Checks remote state before Playwright creates any browser workers. Error
 * messages deliberately exclude patient bodies so a CI log cannot expose PHI.
 */
export async function validateE2ERemotePreflight(
  config: E2EGateConfig,
  { createApiContext, requirePreparedOutpatientVisit = true }: RemotePreflightOptions = {},
): Promise<void> {
  const api = await (
    createApiContext ??
    (async () => {
      const { username, password } = getE2ECredentials();
      return request.newContext({
        baseURL: `${config.apiBaseUrl}/ws/rest/v1/`,
        ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
        httpCredentials: { username, password },
      });
    })
  )();

  try {
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
      const activeVisits = visits.results?.filter((visit) => !visit.voided && !visit.stopDatetime) ?? [];
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
