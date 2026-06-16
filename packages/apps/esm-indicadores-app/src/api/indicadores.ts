import {
  createIndicadorMock,
  createVersionMock,
  deleteIndicadorMock,
  getIndicadorById,
  getSqlPreviewMock,
  listIndicadores,
  resolveDiagnosticosMock,
  resolveLocationsMock,
  resolveOrdenesMock,
  searchDiagnosticosMock,
  searchLocationsMock,
  searchOrdenesMock,
  updateIndicadorMock,
} from '../mocks/indicators-data';
import { fetchJson, toJsonBody, withMockFallback } from './client';
import { getReportesSqlApiPath, getReportesSqlResourcePath } from './config';
import { getMockModeState } from './mock-mode';
import type {
  DefinicionIndicadorForm,
  DiagnosticoOption,
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
  return withMockFallback(
    () => fetchJson<PaginatedResponse<Indicador>>(url),
    () => listIndicadores(page, size),
  );
}

export async function getIndicador(id: string): Promise<IndicadorDetail> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return withMockFallback(
    () => fetchJson<IndicadorDetail>(`${indicadoresPath}/${id}`),
    () => getIndicadorById(id),
  );
}

export async function createIndicador(payload: IndicadorCreatePayload): Promise<Indicador> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return withMockFallback(
    () => fetchJson<Indicador>(`${indicadoresPath}/`, { method: 'POST', ...toJsonBody(payload) }),
    () => createIndicadorMock(payload),
  );
}

export async function updateIndicador(id: string, payload: IndicadorUpdatePayload): Promise<Indicador> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return withMockFallback(
    () => fetchJson<Indicador>(`${indicadoresPath}/${id}`, { method: 'PUT', ...toJsonBody(payload) }),
    () => updateIndicadorMock(id, payload),
  );
}

export async function deleteIndicador(id: string): Promise<void> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return withMockFallback(
    async () => {
      await fetchJson(`${indicadoresPath}/${id}`, { method: 'DELETE' });
    },
    async () => {
      deleteIndicadorMock(id);
    },
  );
}

export async function createVersion(id: string, definicion: DefinicionIndicadorForm): Promise<IndicadorVersion> {
  const indicadoresPath = await getReportesSqlResourcePath('indicadores');
  return withMockFallback(
    () =>
      fetchJson<IndicadorVersion>(`${indicadoresPath}/${id}/versiones`, {
        method: 'POST',
        ...toJsonBody({ definicion }),
      }),
    () => createVersionMock(id, definicion),
  );
}

export async function previewSql(id: string, versionId?: string): Promise<IndicadorSQLPreview> {
  const reportesSqlBase = await getReportesSqlApiPath();
  return withMockFallback(
    () =>
      fetchJson<IndicadorSQLPreview>(ensureQuery(`${reportesSqlBase}/indicadores/${id}/preview-sql`, { versionId })),
    () => getSqlPreviewMock(id, versionId),
  );
}

export async function searchLocations(query: string): Promise<Array<LocationOption>> {
  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      return fetchJson<Array<LocationOption>>(ensureQuery(`${conceptosPath}/locations`, { q: query }));
    },
    () => searchLocationsMock(query),
  );
}

export async function searchDiagnosticos(query: string): Promise<Array<DiagnosticoOption>> {
  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      return fetchJson<Array<DiagnosticoOption>>(ensureQuery(`${conceptosPath}/diagnosticos/buscar`, { q: query }));
    },
    () => searchDiagnosticosMock(query),
  );
}

export async function searchOrdenes(query: string): Promise<Array<OrdenOption>> {
  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      const response = await fetchJson<Array<OpenmrsConcept>>(
        ensureQuery(`${conceptosPath}/buscar`, { q: query, clase: 'Test' }),
      );
      return response.map(mapConceptToOrden);
    },
    () => searchOrdenesMock(query),
  );
}

export async function resolveLocations(uuids: Array<string>): Promise<Array<LocationOption>> {
  if (!uuids.length) {
    return [];
  }

  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      return fetchJson<Array<LocationOption>>(`${conceptosPath}/locations/resolve?uuids=${uuids.join(',')}`);
    },
    () => resolveLocationsMock(uuids),
  );
}

export async function resolveDiagnosticos(uuids: Array<string>): Promise<Array<DiagnosticoOption>> {
  if (!uuids.length) {
    return [];
  }

  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      return fetchJson<Array<DiagnosticoOption>>(`${conceptosPath}/diagnosticos/resolve?uuids=${uuids.join(',')}`);
    },
    () => resolveDiagnosticosMock(uuids),
  );
}

export async function resolveOrdenes(uuids: Array<string>): Promise<Record<string, string>> {
  if (!uuids.length) {
    return {};
  }

  return withMockFallback(
    async () => {
      const conceptosPath = await getReportesSqlResourcePath('conceptos');
      return fetchJson<Record<string, string>>(`${conceptosPath}/buscar/resolve?uuids=${uuids.join(',')}`);
    },
    () => resolveOrdenesMock(uuids),
  );
}

export function isMockModeEnabled() {
  return getMockModeState().isMockMode;
}
