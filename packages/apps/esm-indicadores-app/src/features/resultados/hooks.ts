import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { calcularAhora, getResultados } from '../../api/resultados';
import type { GetResultadosParams, IndicadorResultado, PaginatedResponse } from '../../api/types';

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

export function useCalcularAhora() {
  const { mutate } = useSWRConfig();

  const run = useCallback(async () => {
    const result = await calcularAhora();
    await mutate((key) => Array.isArray(key) && key[0] === 'resultados');
    return result;
  }, [mutate]);

  return { calcularAhora: run };
}
