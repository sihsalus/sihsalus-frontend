import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

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

interface AttentionEncounterResponse {
  uuid?: string;
}

interface AttentionEncounterIdentity {
  uuid?: string;
  voided?: boolean;
  patient?: { uuid?: string };
  visit?: { uuid?: string };
  encounterType?: { uuid?: string };
  location?: { uuid?: string };
}

export interface ExpectedAttentionEncounterIdentity {
  patientUuid: string;
  visitUuid: string;
  encounterTypeUuid: string;
  locationUuid: string;
}

export class AttentionEncounterVerificationError extends Error {
  constructor() {
    super('The emergency attention encounter identity could not be verified.');
    this.name = 'AttentionEncounterVerificationError';
  }
}

/**
 * Creates an "Atención en Emergencia" encounter with diagnosis, treatment,
 * and auxiliary exam observations. Empty observations are filtered out before submission.
 *
 * @returns Promise with the created encounter (POST /ws/rest/v1/encounter)
 */
export function createAttentionEncounter({
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

  return openmrsFetch<AttentionEncounterResponse>(`${restBaseUrl}/encounter`, {
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

/**
 * Re-reads a newly created encounter and verifies that it belongs to the expected
 * patient, visit, encounter type and location before any queue state is changed.
 */
export async function verifyAttentionEncounter(encounterUuid: string, expected: ExpectedAttentionEncounterIdentity) {
  const representation = encodeURIComponent(
    'custom:(uuid,voided,patient:(uuid),visit:(uuid),encounterType:(uuid),location:(uuid))',
  );
  const response = await openmrsFetch<AttentionEncounterIdentity>(
    `${restBaseUrl}/encounter/${encounterUuid}?v=${representation}`,
  );
  const encounter = response.data;

  if (
    encounter?.uuid !== encounterUuid ||
    encounter.voided === true ||
    encounter.patient?.uuid !== expected.patientUuid ||
    encounter.visit?.uuid !== expected.visitUuid ||
    encounter.encounterType?.uuid !== expected.encounterTypeUuid ||
    encounter.location?.uuid !== expected.locationUuid
  ) {
    throw new AttentionEncounterVerificationError();
  }

  return response;
}

/**
 * A response in this set means the server explicitly rejected the request. Timeouts,
 * throttling, conflicts and 5xx/network failures remain ambiguous and must be reconciled.
 */
export function isDefinitiveAttentionCreateRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const responseStatus =
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof error.response.status === 'number'
      ? error.response.status
      : undefined;
  const directStatus = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  const status = responseStatus ?? directStatus;

  return status !== undefined && [400, 401, 403, 404, 405, 415, 422].includes(status);
}
