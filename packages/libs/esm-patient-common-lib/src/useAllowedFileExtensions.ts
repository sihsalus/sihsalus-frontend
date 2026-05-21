import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

export interface GlobalProperty {
  property: string;
  uuid: string;
  value: string;
}

export function useAllowedFileExtensions() {
  const allowedFileExtensionsGlobalProperty = 'attachments.allowedFileExtensions';
  const customRepresentation = 'custom:(value)';
  const url = `${restBaseUrl}/systemsetting?&v=${customRepresentation}&q=${allowedFileExtensionsGlobalProperty}`;

  const { data, error, isLoading } = useSWRImmutable<{ data: { results: Array<GlobalProperty> } }>(url, openmrsFetch);

  const allowedFileExtensions = useMemo(() => {
    const firstResult = data?.data?.results?.[0];
    return firstResult?.value?.toLowerCase().split(',') ?? undefined;
  }, [data]);

  return {
    allowedFileExtensions,
    error,
    isLoading,
  };
}
