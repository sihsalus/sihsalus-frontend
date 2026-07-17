import { getSeriesMock, listResultados } from '../mocks/indicators-data';
import { fetchJson, mutateJson, toJsonBody, withMockFallback } from './client';
import { getReportesSqlApiPath } from './config';
import type {
  BatchCalcularNowResponse,
  GetResultadosParams,
  GetSeriesParams,
  IndicadorResultado,
  PaginatedResponse,
  RecalcularAnioParams,
  RecalcularAnioResponse,
  SeriesResponse,
} from './types';

function ensureQuery(params: Record<string, string | number | boolean | undefined>) {
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
  return mutateJson<BatchCalcularNowResponse>(`${reportesSqlBase}/resultados/calcular-ahora`, { method: 'POST' });
}

export async function recalcularAnio(params: RecalcularAnioParams): Promise<RecalcularAnioResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  return mutateJson<RecalcularAnioResponse>(`${reportesSqlBase}/resultados/recalcular-anio`, {
    method: 'POST',
    ...toJsonBody(params),
  });
}

export async function getResultadosSeries(params: GetSeriesParams): Promise<SeriesResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const queryParams: Record<string, string | number | boolean | undefined> = {
    indicador_id: params.indicador_id,
    anio: params.anio,
    granularity: params.granularity ?? 'mensual',
    include_meta: params.include_meta,
  };

  return withMockFallback(
    () => fetchJson<SeriesResponse>(`${reportesSqlBase}/resultados/series${ensureQuery(queryParams)}`),
    () => getSeriesMock(params),
  );
}
