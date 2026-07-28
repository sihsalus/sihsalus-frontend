import { openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { Encounter } from '../types';

export const useEncounters = (
  encounterTypeUuid: string,
  formUuid: string,
  patientUuid: string,
): {
  encounters: Encounter[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  mutate: () => void;
} => {
  const url = `/ws/rest/v1/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&form=${formUuid}&v=full`;
  const { data, isLoading, isValidating, error, mutate } = useSWR<{ data: { results: Array<Encounter> } }>(
    encounterTypeUuid && formUuid && patientUuid ? url : null,
    openmrsFetch,
  );

  const encounters =
    data?.data?.results.filter(
      (encounter) => encounter.encounterType.uuid === encounterTypeUuid && encounter.form.uuid === formUuid,
    ) ?? [];

  return { encounters, isLoading, isValidating, error, mutate };
};

export const physicalTherapyTableHeader = [
  { key: 'encounterDatetime', header: 'Fecha y hora' },
  { key: 'visitType', header: 'Tipo de consulta' },
  { key: 'provider', header: 'Profesional' },
];
