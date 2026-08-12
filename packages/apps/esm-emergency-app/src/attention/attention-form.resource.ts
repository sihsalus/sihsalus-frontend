import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';
import { v5 as uuidv5 } from 'uuid';
import { assertEmergencyQueueEntryIsActiveForSubject } from '../resources/emergency.resource';

export const EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT = 'EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT';
export const EMERGENCY_ATTENTION_ENCOUNTER_CREATION_UNVERIFIED =
  'EMERGENCY_ATTENTION_ENCOUNTER_CREATION_UNVERIFIED';
export const EMERGENCY_ATTENTION_ENCOUNTER_UUID_UNAVAILABLE = 'EMERGENCY_ATTENTION_ENCOUNTER_UUID_UNAVAILABLE';
export const EMERGENCY_ATTENTION_ENCOUNTER_AMBIGUOUS = 'EMERGENCY_ATTENTION_ENCOUNTER_AMBIGUOUS';
export const EMERGENCY_ATTENTION_ENCOUNTER_SEARCH_STALLED = 'EMERGENCY_ATTENTION_ENCOUNTER_SEARCH_STALLED';
export const EMERGENCY_ATTENTION_ENCOUNTER_TIME_UNAVAILABLE = 'EMERGENCY_ATTENTION_ENCOUNTER_TIME_UNAVAILABLE';

interface AttentionObservationRequest {
  conceptUuid: string;
  value: string;
}

interface AttentionEncounterPayload {
  queueEntryUuid: string;
  patientUuid: string;
  visitUuid: string;
  encounterTypeUuid: string;
  locationUuid: string;
  observations: Array<AttentionObservationRequest>;
}

interface AttentionEncounterState {
  uuid?: string;
  encounterDatetime?: string | null;
  voided?: boolean;
  patient?: { uuid?: string } | null;
  visit?: { uuid?: string } | null;
  encounterType?: { uuid?: string } | null;
  location?: { uuid?: string } | null;
  obs?: Array<{
    concept?: { uuid?: string } | null;
    value?: unknown;
    voided?: boolean;
  }>;
}

interface AttentionEncounterSearchResponse {
  results?: Array<AttentionEncounterState>;
}

const attentionEncounterRepresentation =
  'custom:(uuid,encounterDatetime,voided,patient:(uuid),visit:(uuid),encounterType:(uuid),location:(uuid),obs:(concept:(uuid),value,voided))';

function attentionEncounterError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

function isNotFoundError(error: unknown) {
  const status =
    typeof error === 'object' && error !== null
      ? ((error as { response?: { status?: number }; status?: number }).response?.status ??
        (error as { status?: number }).status)
      : undefined;
  return status === 404;
}

function normalizeRequestedObservations(observations: Array<AttentionObservationRequest>) {
  return observations
    .filter((observation) => observation.value?.trim())
    .map((observation) => ({
      concept: observation.conceptUuid,
      value: observation.value.trim(),
    }));
}

function normalizedObservationSignature(conceptUuid: string, value: unknown) {
  const normalizedValue =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim()
      : '';
  return `${conceptUuid}\u0000${normalizedValue}`;
}

function encounterIsInRequestScope(encounter: AttentionEncounterState, request: AttentionEncounterPayload) {
  return (
    encounter.voided === false &&
    encounter.patient?.uuid === request.patientUuid &&
    encounter.visit?.uuid === request.visitUuid &&
    encounter.encounterType?.uuid === request.encounterTypeUuid &&
    encounter.location?.uuid === request.locationUuid
  );
}

function encounterPayloadMatchesRequest(
  encounter: AttentionEncounterState,
  request: AttentionEncounterPayload,
  observations: ReturnType<typeof normalizeRequestedObservations>,
) {
  const expectedObservations = observations
    .map((observation) => normalizedObservationSignature(observation.concept, observation.value))
    .sort();
  const actualObservations = (encounter.obs ?? [])
    .filter((observation) => !observation.voided && observation.concept?.uuid)
    .map((observation) => normalizedObservationSignature(observation.concept?.uuid ?? '', observation.value))
    .sort();
  return (
    encounterIsInRequestScope(encounter, request) &&
    expectedObservations.length === actualObservations.length &&
    expectedObservations.every((observation, index) => observation === actualObservations[index])
  );
}

function getParsedEncounterTime(encounter: AttentionEncounterState) {
  const encounterTime = encounter.encounterDatetime ? new Date(encounter.encounterDatetime).valueOf() : Number.NaN;
  return Number.isFinite(encounterTime) ? encounterTime : null;
}

export function getAttentionEncounterUuid(queueEntryUuid: string) {
  return uuidv5(`urn:sihsalus:emergency-attention:${queueEntryUuid.trim().toLowerCase()}`, uuidv5.URL);
}

async function fetchAttentionEncounter(encounterUuid: string): Promise<FetchResponse<AttentionEncounterState> | null> {
  const params = new URLSearchParams({ v: attentionEncounterRepresentation });
  try {
    return await openmrsFetch<AttentionEncounterState>(
      `${restBaseUrl}/encounter/${encounterUuid}?${params.toString()}`,
    );
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function verifyAttentionEncounter(
  response: FetchResponse<AttentionEncounterState>,
  encounterUuid: string,
  request: AttentionEncounterPayload,
  observations: ReturnType<typeof normalizeRequestedObservations>,
  timeBounds?: { queueStartedAt: string; authoritativeNow: number },
) {
  if (!response.data?.uuid) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_UUID_UNAVAILABLE,
      'The emergency attention encounter did not include a UUID.',
    );
  }
  const encounterTime = getParsedEncounterTime(response.data);
  const timeIsValid = timeBounds
    ? encounterTime !== null &&
      encounterTime >= new Date(timeBounds.queueStartedAt).valueOf() &&
      encounterTime <= timeBounds.authoritativeNow
    : encounterTime !== null;
  if (
    response.data.uuid !== encounterUuid ||
    !encounterPayloadMatchesRequest(response.data, request, observations) ||
    !timeIsValid
  ) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
      'The deterministic emergency attention encounter contains different clinical data.',
    );
  }
  return response as FetchResponse<Required<Pick<AttentionEncounterState, 'uuid'>> & AttentionEncounterState>;
}

async function findLegacyAttentionEncounter(
  request: AttentionEncounterPayload,
  observations: ReturnType<typeof normalizeRequestedObservations>,
  queueStartedAt: string,
  deterministicEncounterUuid: string,
) {
  const pageSize = 100;
  const queueStart = new Date(queueStartedAt);
  queueStart.setMilliseconds(0);
  const scopeCandidatesByUuid = new Map<
    string,
    { response: FetchResponse<AttentionEncounterSearchResponse>; encounter: AttentionEncounterState }
  >();
  const seenUuids = new Set<string>();
  let authoritativeNow: number | null = null;

  for (let startIndex = 0; ; startIndex += pageSize) {
    const params = new URLSearchParams({
      patient: request.patientUuid,
      visit: request.visitUuid,
      encounterType: request.encounterTypeUuid,
      fromdate: queueStart.toISOString(),
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: attentionEncounterRepresentation,
    });
    const response = await openmrsFetch<AttentionEncounterSearchResponse>(
      `${restBaseUrl}/encounter?${params.toString()}`,
    );
    const responseDate = response.headers?.get?.('Date');
    const parsedResponseDate = responseDate ? new Date(responseDate).valueOf() : Number.NaN;
    if (Number.isFinite(parsedResponseDate)) {
      authoritativeNow = Math.max(authoritativeNow ?? parsedResponseDate, parsedResponseDate);
    }
    const page = response.data?.results ?? [];
    let newUuidCount = 0;
    page.forEach((encounter) => {
      if (!encounter.uuid) {
        throw attentionEncounterError(
          EMERGENCY_ATTENTION_ENCOUNTER_UUID_UNAVAILABLE,
          'An emergency attention encounter did not include a UUID.',
        );
      }
      if (!seenUuids.has(encounter.uuid)) {
        seenUuids.add(encounter.uuid);
        newUuidCount += 1;
      }
      if (encounterIsInRequestScope(encounter, request)) {
        scopeCandidatesByUuid.set(encounter.uuid, { response, encounter });
      }
    });
    if (page.length < pageSize) {
      break;
    }
    if (newUuidCount === 0) {
      throw attentionEncounterError(
        EMERGENCY_ATTENTION_ENCOUNTER_SEARCH_STALLED,
        'Emergency attention encounter pagination did not advance.',
      );
    }
  }

  if (scopeCandidatesByUuid.size && authoritativeNow === null) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_TIME_UNAVAILABLE,
      'The server time needed to reconcile emergency attention encounters was unavailable.',
    );
  }
  const windowCandidates = [...scopeCandidatesByUuid.values()].filter(({ encounter }) => {
    const encounterTime = getParsedEncounterTime(encounter);
    return (
      encounterTime !== null &&
      encounterTime >= queueStart.valueOf() &&
      encounterTime <= (authoritativeNow as number)
    );
  });
  const deterministicCandidate = windowCandidates.find(
    ({ encounter }) => encounter.uuid === deterministicEncounterUuid,
  );
  if (deterministicCandidate) {
    return verifyAttentionEncounter(
      {
        ...deterministicCandidate.response,
        data: deterministicCandidate.encounter,
      } as FetchResponse<AttentionEncounterState>,
      deterministicEncounterUuid,
      request,
      observations,
      { queueStartedAt: queueStartedAt, authoritativeNow: authoritativeNow as number },
    );
  }
  if (windowCandidates.some(({ encounter }) => !encounterPayloadMatchesRequest(encounter, request, observations))) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT,
      'A different emergency attention encounter already exists for this queue entry window.',
    );
  }
  if (windowCandidates.length > 1) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_AMBIGUOUS,
      'Multiple identical emergency attention encounters could match this queue entry.',
    );
  }
  const resolved = windowCandidates[0];
  return resolved
    ? ({ ...resolved.response, data: resolved.encounter } as FetchResponse<AttentionEncounterState>)
    : null;
}

/**
 * Creates one idempotent emergency-attention encounter per queue entry.
 * OpenMRS supplies the encounter time and enforces uniqueness of the
 * deterministic client UUID, including across tabs and response loss.
 */
export async function createAttentionEncounter(request: AttentionEncounterPayload) {
  const observations = normalizeRequestedObservations(request.observations);
  const encounterUuid = getAttentionEncounterUuid(request.queueEntryUuid);
  const existingResponse = await fetchAttentionEncounter(encounterUuid);
  if (existingResponse) {
    // A prior tab/session used the same deterministic identity. Its server time
    // is not expected to equal any new browser retry timestamp.
    return verifyAttentionEncounter(existingResponse, encounterUuid, request, observations);
  }

  const queueEntryResponse = await assertEmergencyQueueEntryIsActiveForSubject(
    request.queueEntryUuid,
    request.patientUuid,
    request.visitUuid,
    false,
  );
  const legacyResponse = await findLegacyAttentionEncounter(
    request,
    observations,
    queueEntryResponse.data.startedAt as string,
    encounterUuid,
  );
  if (legacyResponse) {
    return legacyResponse;
  }

  await assertEmergencyQueueEntryIsActiveForSubject(request.queueEntryUuid, request.patientUuid, request.visitUuid);
  await assertFreshPatientIsAlive(request.patientUuid);

  let writeResponse: FetchResponse<AttentionEncounterState>;
  try {
    writeResponse = await openmrsFetch<AttentionEncounterState>(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        uuid: encounterUuid,
        patient: request.patientUuid,
        encounterType: request.encounterTypeUuid,
        visit: request.visitUuid,
        location: request.locationUuid,
        obs: observations,
      },
    });
  } catch (error) {
    try {
      const reconciledResponse = await fetchAttentionEncounter(encounterUuid);
      if (reconciledResponse) {
        return verifyAttentionEncounter(reconciledResponse, encounterUuid, request, observations);
      }
    } catch (reconciliationError) {
      const reconciliationCode = (reconciliationError as { code?: string })?.code;
      if (
        reconciliationCode === EMERGENCY_ATTENTION_ENCOUNTER_CONFLICT ||
        reconciliationCode === EMERGENCY_ATTENTION_ENCOUNTER_UUID_UNAVAILABLE
      ) {
        throw reconciliationError;
      }
      // Preserve the write error if authoritative reconciliation is unavailable.
    }
    throw error;
  }

  let persistedResponse: FetchResponse<AttentionEncounterState> | null;
  try {
    persistedResponse = await fetchAttentionEncounter(encounterUuid);
  } catch {
    persistedResponse = null;
  }
  if (!persistedResponse || (writeResponse.data?.uuid && writeResponse.data.uuid !== encounterUuid)) {
    throw attentionEncounterError(
      EMERGENCY_ATTENTION_ENCOUNTER_CREATION_UNVERIFIED,
      'The emergency attention encounter creation could not be verified.',
    );
  }

  const verifiedResponse = verifyAttentionEncounter(persistedResponse, encounterUuid, request, observations);
  return { ...writeResponse, data: verifiedResponse.data } as typeof verifiedResponse;
}
