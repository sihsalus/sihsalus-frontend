import type { BatchCalcularNowResponse, GetResultadosParams, IndicadorResultado, PaginatedResponse } from './types';
import { getResultadosResourcePath } from './config';
import { calcularAhoraMock, listResultados } from '../mocks/indicators-data';
import { fetchJson, withMockFallback } from './client';

function ensureQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getResultados(params: GetResultadosParams): Promise<PaginatedResponse<IndicadorResultado>> {
  const resultadosPath = await getResultadosResourcePath();
  const queryParams: Record<string, string | number | undefined> = {
    page: params.page,
    size: params.size,
    indicador_id: params.indicador_id,
    periodo_inicio: params.periodo_inicio,
    periodo_fin: params.periodo_fin,
  };

  return withMockFallback(
    () => fetchJson<PaginatedResponse<IndicadorResultado>>(`${resultadosPath}/${ensureQuery(queryParams)}`),
    () => listResultados(params),
  );
}

export async function calcularAhora(): Promise<BatchCalcularNowResponse> {
  const resultadosPath = await getResultadosResourcePath();
  return withMockFallback(
    () => fetchJson<BatchCalcularNowResponse>(`${resultadosPath}/calcular-ahora`, { method: 'POST' }),
    () => calcularAhoraMock(),
  );
}
