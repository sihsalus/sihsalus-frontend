import { openmrsFetch } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

interface StandardFormSchemaResponse {
  data?: {
    properties?: Record<string, unknown>;
  };
}

export function useStandardFormSchema() {
  const url = 'https://json.openmrs.org/form.schema.json';
  const { data, error, isLoading } = useSWRImmutable<StandardFormSchemaResponse, Error>(url, openmrsFetch);

  return {
    schema: data?.data,
    schemaProperties: data?.data.properties,
    error,
    isLoading,
  };
}
