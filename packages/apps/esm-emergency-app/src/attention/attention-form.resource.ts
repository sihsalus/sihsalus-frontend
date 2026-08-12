import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

/**
 * Payload for creating an emergency attention encounter.
 * Contains diagnosis, treatment, and auxiliary exams as text observations.
 */
interface AttentionEncounterPayload {
  patientUuid: string;
  visitUuid: string;
  encounterTypeUuid: string;
  locationUuid: string;
  observations: Array<{
    conceptUuid: string;
    value: string;
  }>;
}

/**
 * Creates an "Atención en Emergencia" encounter with diagnosis, treatment,
 * and auxiliary exam observations. Empty observations are filtered out before submission.
 *
 * @returns Promise with the created encounter (POST /ws/rest/v1/encounter)
 */
export async function createAttentionEncounter({
  patientUuid,
  visitUuid,
  encounterTypeUuid,
  locationUuid,
  observations,
}: AttentionEncounterPayload) {
  const obs = observations
    .filter((o) => o.value?.trim())
    .map((o) => ({
      concept: o.conceptUuid,
      value: o.value.trim(),
    }));

  await assertFreshPatientIsAlive(patientUuid);
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      patient: patientUuid,
      encounterType: encounterTypeUuid,
      visit: visitUuid,
      location: locationUuid,
      obs,
    },
  });
}
