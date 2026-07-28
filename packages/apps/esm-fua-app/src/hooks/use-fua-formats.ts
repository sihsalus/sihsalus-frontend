import { openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';

import { FuaFormatRestURL } from '../constant';

export interface FuaFormat {
  id: number;
  uuid: string;
  createdBy: string;
  updatedBy: string | null;
  active: boolean;
  inactiveBy: string | null;
  inactiveAt: string | null;
  inactiveReason: string | null;
  codeName: string;
  versionTag: string;
  versionNumber: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FuaFormatResponse {
  results: Array<FuaFormat>;
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
}

export function useFuaFormats() {
  const { data, error, mutate, isLoading, isValidating } = useSWR<{ data: FuaFormatResponse }>(
    FuaFormatRestURL,
    openmrsFetch,
  );

  return {
    fuaFormats: data?.data?.results ?? [],
    isLoading,
    isError: error,
    mutate,
    isValidating,
  };
}

export default useFuaFormats;
