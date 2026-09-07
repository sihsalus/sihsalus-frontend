import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

export interface GlobalProperty {
  property: string;
  uuid: string;
  value: string;
}

const safeFileExtensionPattern = /^[a-z0-9]{1,16}$/;

/**
 * Treat the server-side allowlist as security configuration.
 *
 * Missing, empty, wildcard, or malformed values deliberately produce an empty
 * list so upload surfaces fail closed. Restricting each value to alphanumeric
 * file extensions also prevents server-controlled values from being reused as
 * unsafe regular-expression fragments by consumers.
 */
export function parseAllowedFileExtensions(value?: string | null): Array<string> {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((extension) => extension.trim().toLowerCase().replace(/^\.+/, ''))
        .filter((extension) => safeFileExtensionPattern.test(extension)),
    ),
  ];
}

export function useAllowedFileExtensions(enabled = true) {
  const allowedFileExtensionsGlobalProperty = 'attachments.allowedFileExtensions';
  const customRepresentation = 'custom:(value)';
  const url = `${restBaseUrl}/systemsetting?&v=${customRepresentation}&q=${allowedFileExtensionsGlobalProperty}`;

  const { data, error, isLoading } = useSWRImmutable<{ data: { results: Array<GlobalProperty> } }>(
    enabled ? url : null,
    openmrsFetch,
  );

  const allowedFileExtensions = useMemo(() => {
    const firstResult = data?.data?.results?.[0];
    return parseAllowedFileExtensions(firstResult?.value);
  }, [data]);

  return {
    allowedFileExtensions,
    error,
    isConfigured: enabled && !isLoading && !error && allowedFileExtensions.length > 0,
    isLoading: enabled ? isLoading : false,
  };
}
