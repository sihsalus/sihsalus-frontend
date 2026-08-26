import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

const DESTINATION_SEPARATOR = ' | ';

export interface ReferralDestination {
  renaesCode: string;
  name: string;
}

export interface ReferralEncounterConcepts {
  referralTypeUuid: string;
  referralReasonUuid: string;
  referralDestinationUuid: string;
  referralDestinationSpecialtyUuid: string;
  referralDestinationSpecialtyOtherUuid: string;
  referralPatientConditionUuid: string;
  referralTransportModeUuid: string;
}

export interface CreateInstitutionalReferralPayload {
  patientUuid: string;
  visitUuid: string;
  locationUuid: string;
  providerUuid: string;
  encounterTypeUuid: string;
  encounterRoleUuid: string;
  destination: ReferralDestination;
  referralTypeUuid: string;
  specialtyUuid: string;
  otherSpecialty?: string;
  patientConditionUuid: string;
  transportModeUuid: string;
  reason: string;
  concepts: ReferralEncounterConcepts;
}

export interface ParsedReferralDestination {
  renaesCode: string | null;
  name: string;
}

export function encodeReferralDestination(destination: ReferralDestination): string {
  const code = destination.renaesCode.trim();
  const name = destination.name.trim();
  return code ? `${code}${DESTINATION_SEPARATOR}${name}` : name;
}

export function parseReferralDestination(value: string | null | undefined): ParsedReferralDestination {
  const normalized = value?.trim() ?? '';
  const separatorIndex = normalized.indexOf(DESTINATION_SEPARATOR);
  if (separatorIndex < 0) {
    return { renaesCode: null, name: normalized };
  }

  const renaesCode = normalized.slice(0, separatorIndex).trim();
  const name = normalized.slice(separatorIndex + DESTINATION_SEPARATOR.length).trim();
  return { renaesCode: renaesCode || null, name: name || normalized };
}

export function buildInstitutionalReferralEncounter(payload: CreateInstitutionalReferralPayload) {
  const otherSpecialty = payload.otherSpecialty?.trim();
  const obs: Array<{ concept: string; value: string }> = [
    { concept: payload.concepts.referralTypeUuid, value: payload.referralTypeUuid },
    { concept: payload.concepts.referralDestinationUuid, value: encodeReferralDestination(payload.destination) },
    { concept: payload.concepts.referralDestinationSpecialtyUuid, value: payload.specialtyUuid },
    { concept: payload.concepts.referralPatientConditionUuid, value: payload.patientConditionUuid },
    { concept: payload.concepts.referralTransportModeUuid, value: payload.transportModeUuid },
    { concept: payload.concepts.referralReasonUuid, value: payload.reason.trim() },
  ];

  if (otherSpecialty) {
    obs.push({ concept: payload.concepts.referralDestinationSpecialtyOtherUuid, value: otherSpecialty });
  }

  return {
    patient: payload.patientUuid,
    visit: payload.visitUuid,
    encounterType: payload.encounterTypeUuid,
    location: payload.locationUuid,
    encounterProviders: [
      {
        provider: payload.providerUuid,
        encounterRole: payload.encounterRoleUuid,
      },
    ],
    obs,
  };
}

export async function createInstitutionalReferral(
  payload: CreateInstitutionalReferralPayload,
  abortController?: AbortController,
) {
  const response = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: buildInstitutionalReferralEncounter(payload),
  });

  if (!response.ok || !response.data?.uuid) {
    throw new Error(`No se pudo crear la referencia institucional (${response.status})`);
  }

  return response.data;
}
