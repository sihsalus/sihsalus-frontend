import type { BatchCalcularNowResponse, GetResultadosParams, GetSeriesParams, IndicadorResultado, PaginatedResponse, SeriesResponse } from './types';
import { getReportesSqlApiPath } from './config';
import { calcularAhoraMock, getSeriesMock, listResultados } from '../mocks/indicators-data';
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
  const reportesSqlBase = await getReportesSqlApiPath();
  const queryParams: Record<string, string | number | undefined> = {
    page: params.page,
    size: params.size,
    indicador_id: params.indicador_id,
    periodo_inicio: params.periodo_inicio,
    periodo_fin: params.periodo_fin,
  };

  return withMockFallback(
    () => fetchJson<PaginatedResponse<IndicadorResultado>>(`${reportesSqlBase}/resultados/${ensureQuery(queryParams)}`),
    () => listResultados(params),
  );
}

export async function calcularAhora(): Promise<BatchCalcularNowResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  return withMockFallback(
    () => fetchJson<BatchCalcularNowResponse>(`${reportesSqlBase}/resultados/calcular-ahora`, { method: 'POST' }),
    () => calcularAhoraMock(),
  );
}

export async function getResultadosSeries(params: GetSeriesParams): Promise<SeriesResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const queryParams: Record<string, string | number | undefined> = {
    indicador_id: params.indicador_id,
    anio: params.anio,
    granularity: params.granularity ?? 'mensual',
  };

  return withMockFallback(
    () => fetchJson<SeriesResponse>(`${reportesSqlBase}/resultados/series${ensureQuery(queryParams)}`),
    () => getSeriesMock(params),
  );
}
