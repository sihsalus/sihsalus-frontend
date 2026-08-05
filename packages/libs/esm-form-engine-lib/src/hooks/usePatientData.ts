import { exactAgeAsDuration, usePatient } from '@openmrs/esm-framework/src/internal';

const patientGenderMap = {
  female: 'F',
  male: 'M',
  other: 'O',
  unknown: 'U',
};

type AugmentedPatient = fhir.Patient & {
  age?: number;
  sex?: string;
  gender?: keyof typeof patientGenderMap;
  birthDate?: string;
};

export const usePatientData = (
  patientUuid: string,
): {
  patient: AugmentedPatient | undefined;
  isLoadingPatient: boolean;
  patientError: Error | undefined;
} => {
  const {
    patient,
    isLoading: isLoadingPatient,
    error: patientError,
  } = usePatient(patientUuid) as {
    patient?: AugmentedPatient;
    isLoading: boolean;
    error?: Error;
  };

  const normalizedPatient =
    patient && !isLoadingPatient && typeof patient.birthDate === 'string'
      ? {
          ...patient,
          // birthDate may be date-only ('YYYY-MM-DD') and must be interpreted in local time;
          // new Date() would parse it as UTC midnight, shifting the birthday (and the age
          // for a whole day) in timezones west of UTC. exactAgeAsDuration parses it locally.
          age: exactAgeAsDuration(patient.birthDate)?.years,
          sex: patient.gender ? (patientGenderMap[patient.gender] ?? 'U') : 'U',
        }
      : patient;

  return { patient: normalizedPatient, isLoadingPatient, patientError };
};
