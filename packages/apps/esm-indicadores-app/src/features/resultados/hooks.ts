import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { calcularAhora, getResultados, getResultadosSeries } from '../../api/resultados';
import type {
  GetResultadosParams,
  GetSeriesParams,
  IndicadorResultado,
  PaginatedResponse,
  SeriesResponse,
} from '../../api/types';

export function useResultados(params: GetResultadosParams) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<IndicadorResultado>, Error>(
    ['resultados', params],
    () => getResultados(params),
  );

  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useResultadosSeries(params: GetSeriesParams | null) {
  const { data, error, isLoading, mutate } = useSWR<SeriesResponse, Error>(
    params ? ['resultados-series', params] : null,
    () => getResultadosSeries(params!),
  );

  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useCalcularAhora() {
  const { mutate } = useSWRConfig();

  const run = useCallback(async () => {
    const result = await calcularAhora();
    await mutate((key) => Array.isArray(key) && key[0] === 'resultados');
    return result;
  }, [mutate]);

  return { calcularAhora: run };
}
