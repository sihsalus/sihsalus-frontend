import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { PatientProgram } from '../types';

const customRepresentation =
  'custom:(uuid,display,program:(uuid,name,display),dateEnrolled,dateCompleted,voided,location:(uuid,display))';

interface PatientEnrollmentResponse {
  data: {
    results: Array<PatientProgram>;
  };
}

const getEnrollmentTimestamp = (enrollment: PatientProgram): number | null => {
  const timestamp = Date.parse(enrollment.dateEnrolled);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const sortEnrollmentsByNewest = (enrollments: Array<PatientProgram>): Array<PatientProgram> =>
  enrollments.slice().sort((first, second) => {
    const firstTimestamp = getEnrollmentTimestamp(first);
    const secondTimestamp = getEnrollmentTimestamp(second);

    if (firstTimestamp === null) return secondTimestamp === null ? 0 : 1;
    if (secondTimestamp === null) return -1;
    return secondTimestamp - firstTimestamp;
  });

const deduplicateByProgram = (enrollments: Array<PatientProgram>): Array<PatientProgram> => {
  const seenProgramUuids = new Set<string>();

  return enrollments.filter((enrollment) => {
    const programUuid = enrollment.program?.uuid?.trim();

    // A malformed enrollment must not cause every other malformed enrollment to be
    // collapsed under an undefined key. Valid records are still deduplicated by program.
    if (!programUuid) return true;
    if (seenProgramUuids.has(programUuid)) return false;

    seenProgramUuids.add(programUuid);
    return true;
  });
};

export const usePatientEnrollment = (patientUuid: string | null | undefined) => {
  const normalizedPatientUuid = patientUuid?.trim();
  const { data, error, isLoading, isValidating } = useSWR<PatientEnrollmentResponse>(
    normalizedPatientUuid
      ? `${restBaseUrl}/programenrollment?patient=${normalizedPatientUuid}&v=${customRepresentation}`
      : null,
    openmrsFetch,
  );

  const sortedResults = useMemo(
    () => sortEnrollmentsByNewest((data?.data?.results ?? []).filter((enrollment) => !enrollment.voided)),
    [data?.data?.results],
  );

  const activePatientEnrollment = useMemo(
    () => sortedResults.filter((enrollment) => !enrollment.dateCompleted),
    [sortedResults],
  );

  const uniqueActiveEnrollments = useMemo(
    () => deduplicateByProgram(activePatientEnrollment),
    [activePatientEnrollment],
  );

  const uniqueAllEnrollments = useMemo(() => deduplicateByProgram(sortedResults), [sortedResults]);

  return {
    activePatientEnrollment: uniqueActiveEnrollments,
    patientEnrollments: uniqueAllEnrollments,
    error,
    isLoading,
    isValidating,
  };
};
