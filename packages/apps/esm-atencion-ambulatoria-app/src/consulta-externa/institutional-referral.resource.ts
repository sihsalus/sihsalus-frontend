import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { VisitSummarySource } from './outpatient-visit-summary.resource';

const DESTINATION_SEPARATOR = ' | ';

export class ReferralServicesError extends Error {}

export function getRecordedDestinationService(
  observations: Array<{ voided?: boolean; concept?: { uuid: string }; value?: unknown }> | undefined,
  conceptUuid: string | undefined,
): string | null {
  if (!conceptUuid) return null;
  const matches = observations?.filter((obs) => !obs.voided && obs.concept?.uuid === conceptUuid);
  if (matches?.length !== 1) return null;
  const value = matches[0].value;
  return value && typeof value === 'object' && 'display' in value && typeof value.display === 'string'
    ? value.display.trim() || null
    : null;
}

export function getRecordedReferralServices(
  source: VisitSummarySource,
  referralUuid: string,
  encounterTypeUuid: string,
  destinationServiceConceptUuid: string,
): { originService: string; destinationService: string } {
  const matches = source.encounters?.filter(
    (encounter) =>
      encounter.uuid === referralUuid && !encounter.voided && encounter.encounterType?.uuid === encounterTypeUuid,
  );
  if (matches?.length !== 1) throw new ReferralServicesError('The selected referral could not be verified.');
  const encounter = matches[0];
  const originService = encounter.location?.display?.trim();
  const destinationService = getRecordedDestinationService(encounter.obs, destinationServiceConceptUuid);
  if (!originService || !destinationService)
    throw new ReferralServicesError('The referral services are incomplete or ambiguous.');
  return { originService, destinationService };
}

export interface ReferralDestination {
  renaesCode: string;
  name: string;
}

export interface ReferralEncounterConcepts {
  referralTypeUuid: string;
  referralReasonUuid: string;
  referralDestinationUuid: string;
  referralDestinationServiceUuid: string;
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
  destinationServiceUuid: string;
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
  if (!payload.destinationServiceUuid?.trim() || !payload.concepts.referralDestinationServiceUuid?.trim()) {
    throw new Error('The referral destination service is required.');
  }
  const otherSpecialty = payload.otherSpecialty?.trim();
  const obs: Array<{ concept: string; value: string }> = [
    { concept: payload.concepts.referralTypeUuid, value: payload.referralTypeUuid },
    { concept: payload.concepts.referralDestinationUuid, value: encodeReferralDestination(payload.destination) },
    { concept: payload.concepts.referralDestinationServiceUuid, value: payload.destinationServiceUuid },
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
