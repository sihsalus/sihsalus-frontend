import { fetchJson, mutateJson, toJsonBody } from './client';
import { getReportesSqlApiPath } from './config';
import {
  assertShape,
  isBatchResponse,
  isIndicadorResultado,
  isPaginatedResponse,
  isSerieRow,
  isSeriesResponse,
} from './validate';
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
  const queryParams: Record<string, string | number | boolean | undefined> = {
    page: params.page,
    size: params.size,
    indicador_id: params.indicador_id,
    periodo_inicio: params.periodo_inicio,
    periodo_fin: params.periodo_fin,
    include_historicos: params.include_historicos,
    version_id: params.version_id,
  };

  const data = await fetchJson<PaginatedResponse<IndicadorResultado>>(
    `${reportesSqlBase}/resultados/${ensureQuery(queryParams)}`,
  );
  assertShape(data, isPaginatedResponse, 'resultados');
  for (const item of data.items) {
    assertShape(item, isIndicadorResultado, 'resultados');
  }
  return data;
}

export async function calcularAhora(): Promise<BatchCalcularNowResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const data = await mutateJson<BatchCalcularNowResponse>(`${reportesSqlBase}/resultados/calcular-ahora`, {
    method: 'POST',
  });
  return assertShape(data, isBatchResponse, 'resultados/calcular-ahora');
}

export async function recalcularAnio(params: RecalcularAnioParams): Promise<RecalcularAnioResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const data = await mutateJson<RecalcularAnioResponse>(`${reportesSqlBase}/resultados/recalcular-anio`, {
    method: 'POST',
    ...toJsonBody(params),
  });
  return assertShape(data, isBatchResponse, 'resultados/recalcular-anio');
}

export async function getResultadosSeries(params: GetSeriesParams): Promise<SeriesResponse> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const queryParams: Record<string, string | number | boolean | undefined> = {
    indicador_id: params.indicador_id,
    anio: params.anio,
    granularity: params.granularity ?? 'mensual',
    include_meta: params.include_meta,
  };

  const data = await fetchJson<SeriesResponse>(`${reportesSqlBase}/resultados/series${ensureQuery(queryParams)}`);
  assertShape(data, isSeriesResponse, 'series');
  for (const item of data.items) {
    assertShape(item, isSerieRow, 'series');
  }
  return data;
}
