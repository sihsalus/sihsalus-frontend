import { restBaseUrl } from '@openmrs/esm-framework';
import type { KeyedMutator } from 'swr';

export function invalidateVisitHistory(mutate: KeyedMutator<unknown>, patientUuid: string): void {
  void mutate((key: string | null) => {
    if (typeof key === 'string' && key.includes(`${restBaseUrl}/visit?patient=${patientUuid}`)) {
      const isCurrentVisitKey = key.includes('includeInactive=false');
      const hasHistoryParams = key.includes('limit=') || key.includes('startIndex=') || key.includes('totalCount=');
      const hasNoIncludeInactive = !key.includes('includeInactive');

      return !isCurrentVisitKey && (hasHistoryParams || hasNoIncludeInactive);
    }

    return false;
  });
}

function keyContainsPatientEncounter(key: unknown, patientUuid: string): boolean {
  if (typeof key === 'string') {
    const [path, query = ''] = key.split('?', 2);
    return path.includes(`${restBaseUrl}/encounter`) && new URLSearchParams(query).get('patient') === patientUuid;
  }

  if (Array.isArray(key)) {
    return key.some((entry) => keyContainsPatientEncounter(entry, patientUuid));
  }

  if (key && typeof key === 'object') {
    return Object.values(key).some((entry) => keyContainsPatientEncounter(entry, patientUuid));
  }

  return false;
}

export function invalidatePatientEncounters(mutate: KeyedMutator<unknown>, patientUuid: string): void {
  void mutate((key: unknown) => keyContainsPatientEncounter(key, patientUuid));
}

export function invalidateCurrentVisit(mutate: KeyedMutator<unknown>, patientUuid: string): void {
  void mutate(
    (key: string | null) =>
      typeof key === 'string' &&
      key.includes(`${restBaseUrl}/visit?patient=${patientUuid}`) &&
      key.includes('includeInactive=false'),
  );
}

export function invalidateVisitAndEncounterData(mutate: KeyedMutator<unknown>, patientUuid: string): void {
  invalidateVisitHistory(mutate, patientUuid);
  invalidatePatientEncounters(mutate, patientUuid);
}

export function invalidateVisitByUuid(mutate: KeyedMutator<unknown>, visitUuid: string): void {
  void mutate(new RegExp(`${restBaseUrl}/visit/${visitUuid}`));
}
