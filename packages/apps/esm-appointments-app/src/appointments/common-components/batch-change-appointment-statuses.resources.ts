import { type FetchResponse, openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

export function getActiveVisitsForPatient(
  patientUuid: string,
  abortController?: AbortController,
  v?: string,
  limit = '2',
): Promise<FetchResponse<{ results: Array<Visit> }>> {
  const custom = v ?? `default`;

  const searchParams = new URLSearchParams({
    patient: patientUuid,
    v: custom,
    includeInactive: 'false',
    limit,
  });

  return openmrsFetch(`${restBaseUrl}/visit?${searchParams.toString()}`, {
    signal: abortController?.signal,
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
  });
}
