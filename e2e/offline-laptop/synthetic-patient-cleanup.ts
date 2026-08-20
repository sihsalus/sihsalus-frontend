import type { APIRequestContext } from '@playwright/test';

interface PatientSearchResult {
  identifiers?: Array<{
    identifier?: string;
    identifierType?: { uuid?: string };
  }>;
  person?: {
    names?: Array<{
      familyName?: string;
      givenName?: string;
    }>;
  };
  uuid?: string;
  voided?: boolean;
}

interface PatientSearchResponse {
  results?: Array<PatientSearchResult>;
}

export interface SyntheticPatientMarker {
  familyName: string;
  identifier: string;
  identifierTypeUuid: string;
}

/**
 * Recovers a gate-created patient after an ambiguous create response. The
 * identifier and synthetic name must both match before cleanup is allowed.
 */
export async function recoverSyntheticPatientUuid(
  api: APIRequestContext,
  marker: SyntheticPatientMarker,
): Promise<string | undefined> {
  const representation =
    'custom:(uuid,voided,identifiers:(identifier,identifierType:(uuid)),person:(names:(givenName,familyName)))';
  const response = await api.get(
    `patient?identifier=${encodeURIComponent(marker.identifier)}&v=${encodeURIComponent(representation)}`,
  );

  if (!response.ok()) {
    throw new Error(`Could not recover the synthetic patient for cleanup (${response.status()}).`);
  }

  const payload = (await response.json()) as PatientSearchResponse;
  const matches = (payload.results ?? []).filter(
    (patient) =>
      !patient.voided &&
      patient.identifiers?.some(
        (candidate) =>
          candidate.identifier === marker.identifier && candidate.identifierType?.uuid === marker.identifierTypeUuid,
      ) &&
      patient.person?.names?.some((name) => name.givenName === 'SYNTHETIC' && name.familyName === marker.familyName),
  );

  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length !== 1 || !matches[0]?.uuid) {
    throw new Error('Synthetic patient cleanup recovery was ambiguous; no record was modified.');
  }

  return matches[0].uuid;
}
