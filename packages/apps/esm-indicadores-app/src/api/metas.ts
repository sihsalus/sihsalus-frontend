import { getMetaByIndicatorMock } from '../mocks/indicators-data';
import { fetchJson, mutateJson, toJsonBody, withMockFallback } from './client';
import { getReportesSqlResourcePath } from './config';
import type { IndicadorMeta, IndicadorMetaCreatePayload, IndicadorMetaRecord } from './types';

function ensureQuery(params: Record<string, string | number>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    search.set(key, String(value));
  });
  return `?${search.toString()}`;
}

export function isMetaNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number;
    response?: { status?: number };
    responseBody?: { detail?: { field?: unknown; message?: unknown } };
  };
  const detail = candidate.responseBody?.detail;

  // The 404 + field name is the structural contract; the human message is
  // not — the backend may reword it without changing the semantics.
  return (candidate.status === 404 || candidate.response?.status === 404) && detail?.field === 'indicador_version_id';
}

export async function getMetaByIndicator(indicadorId: string, anio: number): Promise<IndicadorMeta> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return withMockFallback(
    () => fetchJson<IndicadorMeta>(`${metasPath}${ensureQuery({ indicador_id: indicadorId, anio })}`),
    () => getMetaByIndicatorMock(indicadorId, anio),
  );
}

export async function upsertMeta(payload: IndicadorMetaCreatePayload): Promise<IndicadorMetaRecord> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return mutateJson<IndicadorMetaRecord>(`${metasPath}/`, { method: 'PUT', ...toJsonBody(payload) });
}

export async function deleteMeta(indicadorVersionId: string, anio: number): Promise<void> {
  const metasPath = await getReportesSqlResourcePath('metas');
  await mutateJson<void>(`${metasPath}${ensureQuery({ indicador_version_id: indicadorVersionId, anio })}`, {
    method: 'DELETE',
  });
}
