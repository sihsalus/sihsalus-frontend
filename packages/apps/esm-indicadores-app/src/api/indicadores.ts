import { restBaseUrl } from '@openmrs/esm-framework';

import type {
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
  DefinicionIndicadorForm,
} from './types';
import { getIndicatorsApiPath } from './config';
import {
  createIndicadorMock,
  createVersionMock,
  deleteIndicadorMock,
  getIndicadorById,
  getSqlPreviewMock,
  listIndicadores,
  resolveDiagnosticosMock,
  resolveLocationsMock,
  searchDiagnosticosMock,
  searchLocationsMock,
  searchOrdenesMock,
  updateIndicadorMock,
} from '../mocks/indicators-data';
import { fetchJson, toJsonBody, withMockFallback } from './client';
import { getMockModeState } from './mock-mode';

interface OpenmrsLocation {
  uuid: string;
  display: string;
  name?: string;
}

interface OpenmrsConcept {
  uuid: string;
  display: string;
  mappings?: Array<{ display?: string }>;
}

interface OpenmrsResultsResponse<T> {
  results: Array<T>;
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

function locationRepresentation() {
  return 'custom:(uuid,display,name)';
}

function conceptRepresentation() {
  return 'custom:(uuid,display,mappings:(display))';
}

function mapLocation(location: OpenmrsLocation): LocationOption {
  return {
    uuid: location.uuid,
    display: location.name || location.display,
  };
}

function mapConceptToDiagnostico(concept: OpenmrsConcept): DiagnosticoOption {
  const mappingDisplay = concept.mappings?.find((mapping) => mapping.display)?.display;
  const codigo = mappingDisplay?.split(':').pop()?.trim();

  return {
    uuid: concept.uuid,
    codigo: codigo || undefined,
    nombre: concept.display,
  };
}

function mapConceptToOrden(concept: OpenmrsConcept): OrdenOption {
  return {
    uuid: concept.uuid,
    display: concept.display,
  };
}

export async function getIndicadores(page: number, size: number): Promise<PaginatedResponse<Indicador>> {
  const apiPath = await getIndicatorsApiPath();
  const url = ensureQuery(`${apiPath}/indicators`, { page, size });
  return withMockFallback(() => fetchJson<PaginatedResponse<Indicador>>(url), () => listIndicadores(page, size));
}

export async function getIndicador(id: string): Promise<IndicadorDetail> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(() => fetchJson<IndicadorDetail>(`${apiPath}/indicators/${id}`), () => getIndicadorById(id));
}

export async function createIndicador(payload: IndicadorCreatePayload): Promise<Indicador> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(
    () => fetchJson<Indicador>(`${apiPath}/indicators`, { method: 'POST', ...toJsonBody(payload) }),
    () => createIndicadorMock(payload),
  );
}

export async function updateIndicador(id: string, payload: IndicadorUpdatePayload): Promise<Indicador> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(
    () => fetchJson<Indicador>(`${apiPath}/indicators/${id}`, { method: 'PUT', ...toJsonBody(payload) }),
    () => updateIndicadorMock(id, payload),
  );
}

export async function deleteIndicador(id: string): Promise<void> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(
    async () => {
      await fetchJson(`${apiPath}/indicators/${id}`, { method: 'DELETE' });
    },
    async () => {
      deleteIndicadorMock(id);
    },
  );
}

export async function createVersion(id: string, definicion: DefinicionIndicadorForm): Promise<IndicadorVersion> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(
    () => fetchJson<IndicadorVersion>(`${apiPath}/indicators/${id}/versions`, { method: 'POST', ...toJsonBody(definicion) }),
    () => createVersionMock(id, definicion),
  );
}

export async function previewSql(id: string, versionId?: string): Promise<IndicadorSQLPreview> {
  const apiPath = await getIndicatorsApiPath();
  return withMockFallback(
    () => fetchJson<IndicadorSQLPreview>(ensureQuery(`${apiPath}/indicators/${id}/preview-sql`, { versionId })),
    () => getSqlPreviewMock(id, versionId),
  );
}

export async function searchLocations(query: string): Promise<Array<LocationOption>> {
  return withMockFallback(
    async () => {
      const response = await fetchJson<OpenmrsResultsResponse<OpenmrsLocation>>(
        ensureQuery(`${restBaseUrl}/location`, { q: query, v: locationRepresentation() }),
      );
      return response.results.map(mapLocation);
    },
    () => searchLocationsMock(query),
  );
}

export async function searchDiagnosticos(query: string): Promise<Array<DiagnosticoOption>> {
  return withMockFallback(
    async () => {
      const response = await fetchJson<OpenmrsResultsResponse<OpenmrsConcept>>(
        ensureQuery(`${restBaseUrl}/concept`, { q: query, v: conceptRepresentation() }),
      );
      return response.results.map(mapConceptToDiagnostico);
    },
    () => searchDiagnosticosMock(query),
  );
}

export async function searchOrdenes(query: string): Promise<Array<OrdenOption>> {
  return withMockFallback(
    async () => {
      const response = await fetchJson<OpenmrsResultsResponse<OpenmrsConcept>>(
        ensureQuery(`${restBaseUrl}/concept`, { q: query, v: conceptRepresentation() }),
      );
      return response.results.map(mapConceptToOrden);
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
      const resolved = await Promise.all(
        uuids.map((uuid) => fetchJson<OpenmrsLocation>(`${restBaseUrl}/location/${uuid}?v=${locationRepresentation()}`)),
      );
      return resolved.map(mapLocation);
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
      const response = await fetchJson<OpenmrsResultsResponse<OpenmrsConcept>>(
        `${restBaseUrl}/concept?references=${uuids.join(',')}&v=${conceptRepresentation()}`,
      );
      return response.results.map(mapConceptToDiagnostico);
    },
    () => resolveDiagnosticosMock(uuids),
  );
}

export function isMockModeEnabled() {
  return getMockModeState().isMockMode;
}
