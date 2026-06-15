import { fhirBaseUrl, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import {
  type BiometricsObservationResource,
  buildBiometricMeasurements,
  getBiometricConceptUuids,
  type MeasurementData,
} from './biometrics-utils';

export function useBiometrics(patientUuid: string | null) {
  const { concepts } = useConfig();

  const conceptUuids = useMemo(() => {
    return getBiometricConceptUuids(concepts).join(',');
  }, [concepts]);

  const { data, isLoading, error } = useSWR<{ data: { entry: Array<{ resource: BiometricsObservationResource }> } }>(
    patientUuid && conceptUuids
      ? `${fhirBaseUrl}/Observation?subject:Patient=${patientUuid}&code=${conceptUuids}&_sort=-date&_count=300`
      : null,
    openmrsFetch,
  );

  const formattedObs: MeasurementData[] = useMemo(() => {
    return buildBiometricMeasurements(
      data?.data?.entry?.map((entry) => entry.resource),
      concepts,
    );
  }, [data, concepts]);

  return { data: formattedObs, isLoading, error };
}
