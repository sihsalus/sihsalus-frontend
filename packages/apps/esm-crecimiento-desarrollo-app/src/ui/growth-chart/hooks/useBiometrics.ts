import { fhirBaseUrl, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

export interface MeasurementData {
  eventDate: Date;
  dataValues: {
    weight: string;
    height: string;
    headCircumference: string;
  };
}

interface BiometricsObservationResource {
  effectiveDateTime?: string;
  code?: {
    coding?: Array<{
      code?: string;
    }>;
  };
  valueQuantity?: {
    value?: number;
  };
}

export function useBiometrics(patientUuid: string | null) {
  const { concepts } = useConfig();

  const conceptUuids = useMemo(() => {
    if (!concepts) return '';
    return Object.values(concepts)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(',');
  }, [concepts]);

  const { data, isLoading, error } = useSWR<{ data: { entry: Array<{ resource: BiometricsObservationResource }> } }>(
    patientUuid && conceptUuids
      ? `${fhirBaseUrl}/Observation?subject:Patient=${patientUuid}&code=${conceptUuids}&_sort=-date&_count=100`
      : null,
    openmrsFetch,
  );

  const formattedObs: MeasurementData[] = useMemo(() => {
    if (!data?.data?.entry || !concepts) return [];

    const measurementsMap = new Map<string, MeasurementData>();

    data.data.entry.forEach((entry) => {
      const resource = entry.resource;
      const date = resource?.effectiveDateTime;
      const conceptUuid = resource?.code?.coding?.[0]?.code;
      const value = resource?.valueQuantity?.value;

      if (!date || !conceptUuid || value === undefined || value === null) return;

      const dateKey = new Date(date).toISOString(); // Use ISO string to avoid duplicate keys due to timezones

      if (!measurementsMap.has(dateKey)) {
        measurementsMap.set(dateKey, {
          eventDate: new Date(date),
          dataValues: {
            weight: '',
            height: '',
            headCircumference: '',
          },
        });
      }

      const measurement = measurementsMap.get(dateKey)!;

      switch (conceptUuid) {
        case concepts.heightUuid:
          measurement.dataValues.height = value.toString();
          break;
        case concepts.weightUuid:
          measurement.dataValues.weight = value.toString();
          break;
        case concepts.headCircumferenceUuid:
          measurement.dataValues.headCircumference = value.toString();
          break;
      }
    });

    return Array.from(measurementsMap.values());
  }, [data, concepts]);

  return { data: formattedObs, isLoading, error };
}
