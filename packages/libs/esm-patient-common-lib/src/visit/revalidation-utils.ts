import { fhirBaseUrl, restBaseUrl } from '@openmrs/esm-framework';
import type { Arguments, Cache, ScopedMutator } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { isPatientObservationsKey } from '../observations/useMappedPatientObservations';

function invalidateMatchingKeys(mutate: ScopedMutator, matches: (key: unknown) => boolean, cache?: Cache): void {
  if (!cache) {
    void mutate(matches);
    return;
  }
  const infiniteKeys = new Set<string>();
  // SWR's key filter excludes infinite aggregates. Clear their matching page
  // data first so the public infinite-key revalidation fetches every loaded page.
  void mutate(
    (key) => {
      if (!matches(key)) return false;
      const infiniteKey = unstable_serialize(() => key as Arguments);
      if (cache.get(infiniteKey)) infiniteKeys.add(infiniteKey);
      return true;
    },
    undefined,
    { revalidate: false },
  ).then(() => {
    void mutate(matches);
    infiniteKeys.forEach((key) => {
      void mutate(key);
    });
  });
}

function keyContainsPatientVisitHistory(key: unknown, patientUuid: string): boolean {
  if (typeof key !== 'string') return false;
  const [path, query = ''] = key.split('?', 2);
  const params = new URLSearchParams(query);
  if (!path.endsWith(`${restBaseUrl}/visit`) || params.get('patient') !== patientUuid) return false;
  const isCurrentVisitKey = params.get('includeInactive') === 'false';
  const hasHistoryParams = ['limit', 'startIndex', 'totalCount'].some((param) => params.has(param));
  return !isCurrentVisitKey && (hasHistoryParams || !params.has('includeInactive'));
}

export function invalidateVisitHistory(mutate: ScopedMutator, patientUuid: string, cache?: Cache): void {
  if (!patientUuid) return;
  invalidateMatchingKeys(mutate, (key) => keyContainsPatientVisitHistory(key, patientUuid), cache);
}

function keyContainsPatientResource(key: unknown, patientUuid: string, resource: 'encounter' | 'observation'): boolean {
  if (typeof key === 'string') {
    const [path, query = ''] = key.split('?', 2);
    const params = new URLSearchParams(query);
    return resource === 'encounter'
      ? path.endsWith(`${restBaseUrl}/encounter`) && params.get('patient') === patientUuid
      : (path.endsWith(`${restBaseUrl}/obs`) && params.get('patient') === patientUuid) ||
          (path.endsWith(`${fhirBaseUrl}/Observation`) && params.get('subject:Patient') === patientUuid);
  }

  if (Array.isArray(key)) {
    return key.some((entry) => keyContainsPatientResource(entry, patientUuid, resource));
  }

  if (key && typeof key === 'object') {
    if (resource === 'observation' && isPatientObservationsKey(key, patientUuid)) return true;
    return Object.values(key).some((entry) => keyContainsPatientResource(entry, patientUuid, resource));
  }

  return false;
}

export function invalidatePatientEncounters(mutate: ScopedMutator, patientUuid: string, cache?: Cache): void {
  if (!patientUuid) return;
  invalidateMatchingKeys(mutate, (key) => keyContainsPatientResource(key, patientUuid, 'encounter'), cache);
}

export function invalidateCurrentVisit(mutate: ScopedMutator, patientUuid: string): void {
  void mutate(
    (key: string | null) =>
      typeof key === 'string' &&
      key.includes(`${restBaseUrl}/visit?patient=${patientUuid}`) &&
      key.includes('includeInactive=false'),
  );
}

export function invalidateVisitAndEncounterData(mutate: ScopedMutator, patientUuid: string, cache?: Cache): void {
  if (!patientUuid) return;
  invalidateMatchingKeys(
    mutate,
    (key) =>
      keyContainsPatientVisitHistory(key, patientUuid) ||
      keyContainsPatientResource(key, patientUuid, 'encounter') ||
      keyContainsPatientResource(key, patientUuid, 'observation'),
    cache,
  );
}

export function invalidateVisitByUuid(mutate: ScopedMutator, visitUuid: string): void {
  void mutate(new RegExp(`${restBaseUrl}/visit/${visitUuid}`));
}
