import { openmrsFetch } from '@openmrs/esm-framework';
import sortBy from 'lodash-es/sortBy';
import useSWR from 'swr';

import type { OpenmrsEncounter } from '../encounter-list/types';

export const clinicalEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),diagnoses:(uuid,diagnosis:(coded:(display))),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

export function useClinicalEncounter(
  encounterTypeUuid: string | null | undefined,
  formUuid: string | null | undefined,
  patientUuid: string | null | undefined,
  conceptUuid: Array<string | null | undefined> | null | undefined,
) {
  const normalizedEncounterTypeUuid = encounterTypeUuid?.trim() ?? '';
  const normalizedFormUuid = formUuid?.trim() ?? '';
  const normalizedPatientUuid = patientUuid?.trim() ?? '';
  const normalizedConceptUuids = conceptUuid?.map((uuid) => uuid?.trim() ?? '') ?? [];
  const hasRequiredUuids = Boolean(
    normalizedEncounterTypeUuid &&
      normalizedFormUuid &&
      normalizedPatientUuid &&
      normalizedConceptUuids.length &&
      normalizedConceptUuids.every(Boolean),
  );
  const params = new URLSearchParams({
    formUuid: normalizedFormUuid,
    patient: normalizedPatientUuid,
    encounterType: normalizedEncounterTypeUuid,
    conceptUuid: normalizedConceptUuids.join(','),
    v: clinicalEncounterRepresentation,
  });
  const url = hasRequiredUuids ? `/ws/rest/v1/encounter?${params.toString()}` : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );
  const sortedClinicalEncounter = sortBy(data?.data?.results, 'encounterDatetime').reverse();
  return {
    encounters: sortedClinicalEncounter,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
