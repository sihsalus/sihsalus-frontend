import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { calcularAhora, getResultados, getResultadosSeries, recalcularAnio } from '../../api/resultados';
import type {
  GetResultadosParams,
  GetSeriesParams,
  IndicadorResultado,
  PaginatedResponse,
  RecalcularAnioParams,
  RecalcularAnioResponse,
  SeriesResponse,
} from '../../api/types';

function isResultadosKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'resultados';
}

function isResultadosSeriesKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'resultados-series';
}

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
    await mutate((key) => isResultadosKey(key) || isResultadosSeriesKey(key));
    return result;
  }, [mutate]);

  return { calcularAhora: run };
}

export function useRecalcularAnio() {
  const { mutate } = useSWRConfig();

  const run = useCallback(async (params: RecalcularAnioParams): Promise<RecalcularAnioResponse> => {
    const result = await recalcularAnio(params);
    await mutate((key) => isResultadosKey(key) || isResultadosSeriesKey(key));
    return result;
  }, [mutate]);

  return { recalcularAnio: run };
}
