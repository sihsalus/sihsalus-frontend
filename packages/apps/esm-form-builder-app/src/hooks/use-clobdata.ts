import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Form, Schema } from '@types';
import useSWRImmutable from 'swr/immutable';

export const useClobdata = (form?: Form) => {
  const valueReferenceUuid = form?.resources?.find(({ name }) => name === 'JSON schema')?.valueReference;
  const formHasResources = form && form?.resources?.length > 0 && valueReferenceUuid;
  const url = `${restBaseUrl}/clobdata/${valueReferenceUuid}`;

  const { data, error, isLoading, isValidating, mutate } = useSWRImmutable<{ data: Schema }, Error>(
    formHasResources ? url : null,
    openmrsFetch,
  );

  return {
    clobdata: data?.data,
    clobdataError: error,
    isLoadingClobdata: isLoading,
    isValidatingClobdata: isValidating,
    mutate: mutate,
  };
};
