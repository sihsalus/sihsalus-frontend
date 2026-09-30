import { fetchJson, mutateJson, toJsonBody } from './client';
import { getReportesSqlApiPath, getReportesSqlResourcePath } from './config';
import { assertShape, isIndicadorDetail, isPaginatedResponse, isSQLPreview } from './validate';
import type {
  DefinicionIndicadorForm,
  DiagnosticoOption,
  EncounterTypeOption,
  Indicador,
  IndicadorCreatePayload,
  IndicadorDetail,
  IndicadorSQLPreview,
  IndicadorUpdatePayload,
  IndicadorVersion,
  LocationOption,
  OrdenOption,
  PaginatedResponse,
} from './types';

interface OpenmrsConcept {
  uuid: string;
  display: string;
}

function queryParams(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

function ensureQuery(url: string, params: Record<string, string | number | undefined>) {
  const query = queryParams(params);
  return query ? `${url}?${query}` : url;
}

function mapConceptToOrden(concept: OpenmrsConcept): OrdenOption {
  return {
    uuid: concept.uuid,
    display: concept.display,
  };
}

export async function getIndicadores(page: number, size: number): Promise<PaginatedResponse<Indicador>> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  const url = ensureQuery(`${indicadoresPath}/`, { page, size });
  const data = await fetchJson<PaginatedResponse<Indicador>>(url);
  return assertShape(data, isPaginatedResponse, 'indicadores');
}

export async function getIndicador(id: string): Promise<IndicadorDetail> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  const data = await fetchJson<IndicadorDetail>(`${indicadoresPath}/${id}`);
  return assertShape(data, isIndicadorDetail, `indicadores/${id}`);
}

export async function createIndicador(payload: IndicadorCreatePayload): Promise<Indicador> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return mutateJson<Indicador>(`${indicadoresPath}/`, { method: 'POST', ...toJsonBody(payload) });
}

export async function updateIndicador(id: string, payload: IndicadorUpdatePayload): Promise<Indicador> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return mutateJson<Indicador>(`${indicadoresPath}/${id}`, { method: 'PUT', ...toJsonBody(payload) });
}

export async function deleteIndicador(id: string): Promise<void> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  await mutateJson<void>(`${indicadoresPath}/${id}`, { method: 'DELETE' });
}

export async function createVersion(id: string, definicion: DefinicionIndicadorForm): Promise<IndicadorVersion> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return mutateJson<IndicadorVersion>(`${indicadoresPath}/${id}/versiones`, {
    method: 'POST',
    ...toJsonBody({ definicion }),
  });
}

export async function previewSql(id: string, versionId?: string): Promise<IndicadorSQLPreview> {
  const reportesSqlBase = await getReportesSqlApiPath();
  const data = await fetchJson<IndicadorSQLPreview>(
    ensureQuery(`${reportesSqlBase}/indicadores/${id}/preview-sql`, { versionId }),
  );
  return assertShape(data, isSQLPreview, 'preview-sql');
}

export async function searchLocations(query: string): Promise<Array<LocationOption>> {
  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Array<LocationOption>>(ensureQuery(`${conceptosPath}/locations`, { q: query }));
}

export async function searchDiagnosticos(query: string): Promise<Array<DiagnosticoOption>> {
  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Array<DiagnosticoOption>>(ensureQuery(`${conceptosPath}/diagnosticos/buscar`, { q: query }));
}

export async function searchOrdenes(query: string): Promise<Array<OrdenOption>> {
  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  const response = await fetchJson<Array<OpenmrsConcept>>(
    ensureQuery(`${conceptosPath}/buscar`, { q: query, clase: 'Test' }),
  );
  return response.map(mapConceptToOrden);
}

/**
 * Returns every OpenMRS encounter type. The backend does not filter this
 * endpoint; the client filters the full list by display name (e.g. "CRED").
 */
export async function getEncounterTypes(): Promise<Array<EncounterTypeOption>> {
  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Array<EncounterTypeOption>>(`${conceptosPath}/encounter-types`);
}

export async function resolveLocations(uuids: Array<string>): Promise<Array<LocationOption>> {
  if (!uuids.length) {
    return [];
  }

  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Array<LocationOption>>(
    ensureQuery(`${conceptosPath}/locations/resolve`, { uuids: uuids.join(',') }),
  );
}

export async function resolveDiagnosticos(uuids: Array<string>): Promise<Array<DiagnosticoOption>> {
  if (!uuids.length) {
    return [];
  }

  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Array<DiagnosticoOption>>(
    ensureQuery(`${conceptosPath}/diagnosticos/resolve`, { uuids: uuids.join(',') }),
  );
}

export async function resolveOrdenes(uuids: Array<string>): Promise<Record<string, string>> {
  if (!uuids.length) {
    return {};
  }

  const conceptosPath = await getReportesSqlResourcePath('conceptos');
  return fetchJson<Record<string, string>>(ensureQuery(`${conceptosPath}/buscar/resolve`, { uuids: uuids.join(',') }));
}
