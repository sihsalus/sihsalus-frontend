import { makeUrl, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { getPreferredIdentifier } from '@openmrs/esm-utils';
import useSWR from 'swr';

import { ModuleFuaRestURL } from '../constant';
import { revalidateFuaRequestCaches } from './useFuaRequests';

export interface VisitSummary {
  uuid?: string;
  patient?: {
    person?: {
      names?: Array<{
        display?: string;
      }>;
    };
  };
  location?: {
    display?: string;
  };
  startDatetime?: string;
}

export interface VisitPatientInfo {
  display: string;
  identifiers: Array<{
    identifier: string;
    identifierType: { display: string };
  }>;
}

export class FuaGenerationError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly responseBody: unknown = null,
  ) {
    super(status ? `FUA generation failed with HTTP ${status}` : 'FUA generation request failed');
    this.name = 'FuaGenerationError';
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    const responseText = await response.text();
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  } catch {
    return null;
  }
}

async function requestFuaGeneration(visitUuid: string): Promise<Response> {
  let response: Response;

  try {
    // The FUA endpoint can return 401 for domain/configuration failures. openmrsFetch
    // treats every 401 as an expired session and redirects, so handle this request locally.
    response = await window.fetch(makeUrl(`${ModuleFuaRestURL}/generateFromVisit/${encodeURIComponent(visitUuid)}`), {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        'Disable-WWW-Authenticate': 'true',
      },
    });
  } catch (error) {
    throw new FuaGenerationError(null, error);
  }

  if (!response.ok) {
    throw new FuaGenerationError(response.status, await readResponseBody(response));
  }

  return response;
}

export function useVisit(visitUuid: string | null | undefined) {
  const url = visitUuid
    ? `${restBaseUrl}/visit/${visitUuid}?v=custom:(patient:(display,identifiers:(identifier,identifierType:(display))))`
    : null;

  const { data, error, isLoading } = useSWR<{ data: { patient: VisitPatientInfo } }>(url, openmrsFetch);

  const patient = data?.data?.patient ?? null;
  const patientIdentifier = getPreferredIdentifier(patient?.identifiers ?? [])?.identifier ?? null;

  return { patient, patientIdentifier, dni: patientIdentifier, isLoading, error };
}

export function useVisits() {
  const url = `${restBaseUrl}/visit?v=custom:(uuid,patient:(person:(names:(display))),location:(display),startDatetime)`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Array<VisitSummary> } }>(
    url,
    openmrsFetch,
  );

  return {
    visits: data?.data?.results ?? [],
    isLoading,
    isError: error,
    isValidating,
    mutate,
  };
}

export async function generateFuaFromVisit(visitUuid: string) {
  const response = await requestFuaGeneration(visitUuid);

  await revalidateFuaRequestCaches();
  return response;
}

export async function generateFuasFromVisits(visitUuids: Array<string>) {
  const results = await Promise.allSettled(visitUuids.map(requestFuaGeneration));

  await revalidateFuaRequestCaches();

  return {
    successful: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  };
}
