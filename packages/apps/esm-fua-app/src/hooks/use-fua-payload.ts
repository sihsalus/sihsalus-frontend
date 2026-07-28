import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { Config } from '../config-schema';
import { mockFuaPayload } from '../mocks/fua-payload.mock';
import type { FuaPayload } from '../types';

const USE_MOCK = process.env.NODE_ENV === 'development' && !process.env.SIHSALUS_FUA_BACKEND;

export function useFuaPayload(fuaUuid: string | undefined) {
  const config = useConfig<Config>();

  const { data, error, isLoading } = useSWR<{ data: { payload: FuaPayload } }, Error>(
    fuaUuid && !USE_MOCK ? `${config.fuaApiBasePath}/${fuaUuid}` : null,
    openmrsFetch,
  );

  if (USE_MOCK && fuaUuid) {
    return { data: mockFuaPayload, error: null, isLoading: false };
  }

  return {
    data: data?.data?.payload,
    error,
    isLoading,
  };
}
