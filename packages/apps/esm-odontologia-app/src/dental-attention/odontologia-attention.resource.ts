import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import type { Encounter } from '@openmrs/esm-patient-common-lib';

export interface EncountersResponse {
  results: Encounter[];
}

export function getDentalAttentionUrl(patientUuid: string, encounterTypeUuid: string, formUuid: string) {
  return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&form=${formUuid}&v=full`;
}

export function deleteEncounter(encounterUuid: string, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}
