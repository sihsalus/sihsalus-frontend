import { openmrsFetch } from '@openmrs/esm-framework';
import type { OdontogramEncounterPayload, OdontogramObs } from './odontogram/ampath-form-odontogram-mapper';

export interface EncounterResult {
  uuid: string;
  encounterDatetime: string;
  encounterType: { uuid: string };
}

const BASE_URL = '/ws/rest/v1';
const ENCOUNTER_CUSTOM_REP =
  'custom:(uuid,encounterDatetime,encounterType:(uuid),encounterProviders:(uuid,provider:(uuid,person:(uuid,display))),obs:(uuid,concept:(uuid,display),value))';
const ENCOUNTER_OBS_REP = 'custom:(obs:(uuid,concept:(uuid)))';

export function getEncountersByTypeUrl(
  patientUuid: string,
  encounterTypeUuid: string,
  limit = 100,
  formUuid?: string,
): string {
  const formFilter = formUuid ? `&form=${formUuid}` : '';
  return `${BASE_URL}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}${formFilter}&v=${ENCOUNTER_CUSTOM_REP}&limit=${limit}`;
}

export function saveEncounter(payload: OdontogramEncounterPayload): Promise<{ data: unknown }> {
  return openmrsFetch(`${BASE_URL}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}

/**
 * Fetches the current obs of an encounter so an update can reuse their uuids.
 * Reusing the obs uuid makes OpenMRS edit the value in place (void + recreate)
 * instead of appending a second obs for the same concept.
 */
export async function fetchEncounterObs(encounterUuid: string): Promise<OdontogramObs[]> {
  const { data } = await openmrsFetch<{ obs?: OdontogramObs[] }>(
    `${BASE_URL}/encounter/${encounterUuid}?v=${ENCOUNTER_OBS_REP}`,
  );

  return data?.obs ?? [];
}

export function updateEncounter(
  encounterUuid: string,
  payload: OdontogramEncounterPayload,
): Promise<{ data: unknown }> {
  return openmrsFetch(`${BASE_URL}/encounter/${encounterUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
}

export function deleteEncounter(encounterUuid: string, abortController?: AbortController): Promise<{ data: unknown }> {
  return openmrsFetch(`${BASE_URL}/encounter/${encounterUuid}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
  });
}
