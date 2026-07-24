import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';
import { type CohortMemberResponse } from '../types';

export function usePatientListsForPatient(patientUuid: string) {
  const customRepresentation = 'custom:(uuid,patient:ref,cohort:(uuid,name,startDate,endDate))';
  const url = patientUuid ? `ws/rest/v1/cohortm/cohortmember?patient=${patientUuid}&v=${customRepresentation}` : null;
  const { data, error, isLoading } = useSWR<FetchResponse<CohortMemberResponse>, Error>(url, openmrsFetch, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const cohorts = useMemo(
    () =>
      (data?.data?.results ?? [])
        .filter((ref) => ref?.cohort?.uuid)
        .map((ref) => ({
          uuid: ref.cohort.uuid,
          name: ref.cohort.name,
          startDate: ref.cohort.startDate,
          endDate: ref.cohort.endDate,
        })),
    [data],
  );

  return useMemo(() => ({ cohorts, isLoading: isLoading && !error }), [cohorts, error, isLoading]);
}
