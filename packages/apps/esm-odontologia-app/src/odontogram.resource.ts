import { openmrsFetch } from '@openmrs/esm-framework';
import type { OdontogramEncounterPayload } from './odontogram/ampath-form-odontogram-mapper';

export interface EncounterResult {
  uuid: string;
  encounterDatetime: string;
  encounterType: { uuid: string };
}

const BASE_URL = '/ws/rest/v1';
const ENCOUNTER_CUSTOM_REP =
  'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid,display),value))';

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
