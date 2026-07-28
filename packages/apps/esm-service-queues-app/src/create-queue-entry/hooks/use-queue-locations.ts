import { fhirBaseUrl, getLocale, useFhirFetchAll } from '@openmrs/esm-framework';
import { useMemo } from 'react';

type LocationTag = fhir.Coding & { name?: string };

export function isVisitLocation(location: fhir.Location): boolean {
  return Boolean(
    location.meta?.tag?.some((tag: LocationTag) =>
      [tag.code, tag.name, tag.display].some((value) => value?.trim().toLowerCase() === 'visit location'),
    ),
  );
}

export function useQueueLocations() {
  const apiUrl = `${fhirBaseUrl}/Location?_summary=data&_tag=queue location`;
  const { data, error, isLoading } = useFhirFetchAll<fhir.Location>(apiUrl, { immutable: true });

  const queueLocations = useMemo(
    () => data?.slice().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', getLocale())) ?? [],
    [data],
  );

  return { queueLocations, isLoading, error };
}
