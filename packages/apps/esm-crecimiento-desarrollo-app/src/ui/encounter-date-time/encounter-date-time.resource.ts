import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

export interface EncounterDateTimeData {
  uuid: string;
  encounterDatetime: string;
  encounterType: {
    uuid: string;
    display: string;
  };
  location: {
    uuid: string;
    display: string;
  };
}

export function usePatientEncounters(patientUuid: string, encounterTypeUuid?: string) {
  const customRepresentation =
    'custom:(uuid,display,encounterDatetime,encounterType:(uuid,display),location:(uuid,display))';

  const params = new URLSearchParams({
    patient: patientUuid,
    v: customRepresentation,
    ...(encounterTypeUuid && { encounterType: encounterTypeUuid }),
  });

  const url = `${restBaseUrl}/encounter?${params.toString()}`;

  const { data, isLoading, error, mutate } = useSWR<FetchResponse<{ results: Array<EncounterDateTimeData> }>>(
    patientUuid ? url : null,
    openmrsFetch,
  );

  return {
    encounters: data?.data?.results ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to get encounter date boundaries for a patient
 * @param patientUuid - The UUID of the patient
 * @param encounterTypeUuid - Optional encounter type UUID to filter by
 * @returns first and last encounter dates
 */
export function useEncounterDateBoundaries(patientUuid: string, encounterTypeUuid?: string) {
  const { encounters, isLoading, error } = usePatientEncounters(patientUuid, encounterTypeUuid);

  const encounterDates = encounters
    .map((encounter) => new Date(encounter.encounterDatetime).getTime())
    .sort((a, b) => a - b);

  return {
    firstEncounterDateTime: encounterDates.length > 0 ? encounterDates[0] : undefined,
    lastEncounterDateTime: encounterDates.length > 0 ? encounterDates[encounterDates.length - 1] : undefined,
    isLoading,
    error,
  };
}

/**
 * Get encounters within a specific date range
 * @param encounters - Array of encounters
 * @param startDate - Start date for filtering
 * @param endDate - End date for filtering
 * @returns filtered encounters
 */
export function getEncountersInDateRange(
  encounters: EncounterDateTimeData[],
  startDate?: Date,
  endDate?: Date,
): EncounterDateTimeData[] {
  return encounters.filter((encounter) => {
    const encounterDate = new Date(encounter.encounterDatetime);

    if (startDate && encounterDate < startDate) {
      return false;
    }

    if (endDate && encounterDate > endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Validate encounter date against existing encounters
 * @param selectedDate - The date to validate
 * @param encounters - Array of existing encounters
 * @returns validation result
 */
export function validateEncounterDate(
  selectedDate: Date,
  encounters: EncounterDateTimeData[],
): { isValid: boolean; message?: string } {
  if (!selectedDate) {
    return { isValid: false, message: 'Encounter date is required' };
  }

  const now = new Date();
  if (selectedDate > now) {
    return { isValid: false, message: 'Encounter date cannot be in the future' };
  }

  // Check if there are encounters on the same date
  const sameDate = encounters.some((encounter) => {
    const encounterDate = new Date(encounter.encounterDatetime);
    return (
      encounterDate.getFullYear() === selectedDate.getFullYear() &&
      encounterDate.getMonth() === selectedDate.getMonth() &&
      encounterDate.getDate() === selectedDate.getDate()
    );
  });

  if (sameDate) {
    return {
      isValid: true,
      message: 'There are existing encounters on this date',
    };
  }

  return { isValid: true };
}
