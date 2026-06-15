import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { PatientProgram } from '@openmrs/esm-patient-common-lib';
import uniqBy from 'lodash-es/uniqBy';
import { useMemo } from 'react';
import useSWR from 'swr';

const customRepresentation = `custom:(uuid,display,program,dateEnrolled,dateCompleted,location:(uuid,display))`;

interface PatientEnrollmentResponse {
  data: {
    results: Array<PatientProgram>;
  };
}

export const usePatientEnrollment = (patientUuid: string | null | undefined) => {
  const { data, error, isLoading, isValidating } = useSWR<PatientEnrollmentResponse>(
    patientUuid ? `${restBaseUrl}/programenrollment?patient=${patientUuid}&v=${customRepresentation}` : null,
    openmrsFetch,
  );

  const sortedResults = useMemo(() => {
    const results = data?.data.results ?? [];
    return results.sort((a, b) => {
      if (!a.dateEnrolled || !b.dateEnrolled) return 0;
      return new Date(b.dateEnrolled).getTime() - new Date(a.dateEnrolled).getTime();
    });
  }, [data?.data?.results]);

  const activePatientEnrollment = useMemo(
    () => sortedResults.filter((enrollment) => !enrollment.dateCompleted),
    [sortedResults],
  );

  const uniqueActiveEnrollments = useMemo(
    () => uniqBy(activePatientEnrollment, (program) => program.program?.uuid),
    [activePatientEnrollment],
  );

  const uniqueAllEnrollments = useMemo(
    () => uniqBy(sortedResults, (program) => program.program?.uuid),
    [sortedResults],
  );

  return {
    activePatientEnrollment: uniqueActiveEnrollments,
    patientEnrollments: uniqueAllEnrollments,
    error,
    isLoading,
    isValidating,
  };
};
