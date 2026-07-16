import { usePatientEnrollment } from '../clinical-view-group/clinical-view-group.resource';

export const useActivePatientEnrollment = (patientUuid: string | null | undefined) => {
  const { activePatientEnrollment, error, isLoading } = usePatientEnrollment(patientUuid);

  return {
    activePatientEnrollment,
    error,
    isLoading,
  };
};
