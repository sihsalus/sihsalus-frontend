import {
  deleteMetaMock,
  getAllMetasMock,
  getMetaMock,
  upsertMetaMock,
} from '../mocks/indicators-data';
import { fetchJson, toJsonBody, withMockFallback } from './client';
import { getReportesSqlResourcePath } from './config';
import type { IndicadorMeta, IndicadorMetaCreatePayload } from './types';

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

export async function getAllMetas(): Promise<Array<IndicadorMeta>> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return withMockFallback(
    () => fetchJson<Array<IndicadorMeta>>(`${metasPath}/`),
    () => getAllMetasMock(),
  );
}

export async function getMeta(
  indicador_version_id: string,
  anio: number,
): Promise<IndicadorMeta> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return withMockFallback(
    () => fetchJson<IndicadorMeta>(`${metasPath}/${ensureQuery({ indicador_version_id, anio })}`),
    () => getMetaMock(indicador_version_id, anio),
  );
}

export async function upsertMeta(payload: IndicadorMetaCreatePayload): Promise<IndicadorMeta> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return withMockFallback(
    () => fetchJson<IndicadorMeta>(`${metasPath}/`, { method: 'PUT', ...toJsonBody(payload) }),
    () => upsertMetaMock(payload),
  );
}

export async function deleteMeta(indicador_version_id: string, anio: number): Promise<void> {
  const metasPath = await getReportesSqlResourcePath('metas');
  return withMockFallback(
    async () => {
      await fetchJson(`${metasPath}/${ensureQuery({ indicador_version_id, anio })}`, { method: 'DELETE' });
    },
    async () => {
      deleteMetaMock(indicador_version_id, anio);
    },
  );
}
