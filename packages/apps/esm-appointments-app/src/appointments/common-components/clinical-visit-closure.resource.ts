import { type FetchResponse, openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

interface ClinicalVisitClosurePayload {
  stopDatetime: Date | string;
}

export function closeClinicalVisit(
  visitUuid: string,
  payload: ClinicalVisitClosurePayload,
  abortController: AbortController,
): Promise<FetchResponse<Visit>> {
  return openmrsFetch(`${restBaseUrl}/clinicalvisitclosure`, {
    signal: abortController.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      visitUuid,
      stopDatetime: payload.stopDatetime,
    },
  });
}
