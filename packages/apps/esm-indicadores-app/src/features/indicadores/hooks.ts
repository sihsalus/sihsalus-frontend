import { showSnackbar } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
  createIndicador,
  createVersion,
  deleteIndicador,
  getEncounterTypes,
  getIndicador,
  getIndicadores,
  previewSql,
  resolveDiagnosticos,
  resolveLocations,
  resolveOrdenes,
  searchDiagnosticos,
  searchLocations,
  searchOrdenes,
  updateIndicador,
} from '../../api/indicadores';
import type {
  DefinicionIndicadorForm,
  DiagnosticoOption,
  EncounterTypeOption,
  Indicador,
  IndicadorCreatePayload,
  IndicadorDetail,
  IndicadorSQLPreview,
  IndicadorUpdatePayload,
  LocationOption,
  OrdenOption,
  PaginatedResponse,
} from '../../api/types';

const indicadoresKey = (page: number, size: number) => ['indicadores', page, size] as const;
const indicadorKey = (id: string) => ['indicador', id] as const;

export function useIndicadores(page: number, size: number) {
  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Indicador>, Error>(
    indicadoresKey(page, size),
    () => getIndicadores(page, size),
  );
  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

// Safety cap to prevent runaway pagination loops against a malicious or
// buggy backend that always reports more items than it returns. 1000 is
// well above any realistic indicador count for this domain.
const ALL_INDICADORES_MAX = 1000;
const ALL_INDICADORES_PAGE_SIZE = 100;
const allIndicadoresKey = () => ['indicadores', 'all'] as const;

export function useAllIndicadores() {
  const { data, error, isLoading, mutate } = useSWR<Array<Indicador>, Error>(allIndicadoresKey(), async () => {
    const items: Array<Indicador> = [];
    let page = 1;
    while (true) {
      const response = await getIndicadores(page, ALL_INDICADORES_PAGE_SIZE);
      const knownIds = new Set(items.map((item) => item.id));
      if (response.page !== page || response.items.some((item) => knownIds.has(item.id))) {
        throw new Error('Invalid indicator pagination');
      }
      items.push(...response.items);
      if (items.length === response.total) break;
      if (
        items.length > response.total ||
        response.items.length < ALL_INDICADORES_PAGE_SIZE ||
        items.length >= ALL_INDICADORES_MAX
      ) {
        throw new Error('Incomplete indicator catalogue');
      }
      page += 1;
    }
    return items;
  });

  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useIndicador(id: string) {
  const { data, error, isLoading, mutate } = useSWR<IndicadorDetail, Error>(id ? indicadorKey(id) : null, () =>
    getIndicador(id),
  );
  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useCreateIndicador() {
  const { mutate } = useSWRConfig();

  const create = useCallback(
    async (payload: IndicadorCreatePayload) => {
      const result = await createIndicador(payload);
      await mutate((key) => Array.isArray(key) && key[0] === 'indicadores');
      return result;
    },
    [mutate],
  );

  return { createIndicador: create };
}

export function useUpdateIndicador() {
  const { mutate } = useSWRConfig();

  const update = useCallback(
    async (id: string, payload: IndicadorUpdatePayload) => {
      const result = await updateIndicador(id, payload);
      await mutate(
        (key) => Array.isArray(key) && (key[0] === 'indicadores' || (key[0] === 'indicador' && key[1] === id)),
      );
      return result;
    },
    [mutate],
  );

  return { updateIndicador: update };
}

export function useDeleteIndicador() {
  const { mutate } = useSWRConfig();

  const remove = useCallback(
    async (id: string) => {
      await deleteIndicador(id);
      await mutate(
        (key) => Array.isArray(key) && (key[0] === 'indicadores' || (key[0] === 'indicador' && key[1] === id)),
      );
    },
    [mutate],
  );

  return { deleteIndicador: remove };
}

export function useCreateVersion(id: string) {
  const { mutate } = useSWRConfig();

  const create = useCallback(
    async (definicion: DefinicionIndicadorForm) => {
      const result = await createVersion(id, definicion);
      await mutate(indicadorKey(id));
      return result;
    },
    [id, mutate],
  );

  return { createVersion: create };
}

export function useSQLPreview(indicadorId: string, versionId?: string) {
  const { data, error, isLoading, mutate } = useSWR<IndicadorSQLPreview, Error>(
    indicadorId ? ['indicador-sql-preview', indicadorId, versionId ?? 'latest'] : null,
    () => previewSql(indicadorId, versionId),
  );

  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useLocationSearch(query: string) {
  const { data, error, isLoading } = useSWR<Array<LocationOption>, Error>(
    query.trim() ? ['location-search', query] : null,
    () => searchLocations(query),
  );
  return { data: data ?? [], error, isLoading };
}

export function useDiagnosticoSearch(query: string) {
  const { data, error, isLoading } = useSWR<Array<DiagnosticoOption>, Error>(
    query.trim() ? ['diagnostico-search', query] : null,
    () => searchDiagnosticos(query),
  );
  return { data: data ?? [], error, isLoading };
}

export function useOrdenSearch(query: string) {
  const { data, error, isLoading } = useSWR<Array<OrdenOption>, Error>(
    query.trim() ? ['orden-search', query] : null,
    () => searchOrdenes(query),
  );
  return { data: data ?? [], error, isLoading };
}

const encounterTypesKey = () => ['encounter-types'] as const;

/**
 * Fetches the full encounter-type list once and keeps it cached. The backend
 * endpoint returns everything; filtering happens client-side by display name.
 */
export function useEncounterTypes() {
  const { data, error, isLoading } = useSWR<Array<EncounterTypeOption>, Error>(encounterTypesKey(), () =>
    getEncounterTypes(),
  );
  return { data: data ?? [], error, isLoading };
}

export function useEncounterTypeSearch(query: string) {
  const { data, error, isLoading } = useEncounterTypes();
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (normalized ? data.filter((item) => item.display.toLowerCase().includes(normalized)) : data),
    [data, normalized],
  );
  return { data: filtered, error, isLoading };
}

export function useResolvedEncounterTypes(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  // Only fetch the full list when there is something to resolve. The key is
  // shared with useEncounterTypes, so SWR dedupes the request when both hooks
  // are mounted.
  const { data, error, isLoading } = useSWR<Array<EncounterTypeOption>, Error>(
    deduped.length ? encounterTypesKey() : null,
    () => getEncounterTypes(),
  );
  const displayMap = useMemo(() => new Map((data ?? []).map((item) => [item.uuid, item.display])), [data]);
  return { data: data ?? [], displayMap, error, isLoading };
}

export function useResolvedLocations(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  const { data, error, isLoading } = useSWR<Array<LocationOption>, Error>(
    deduped.length ? ['resolved-locations', ...deduped] : null,
    () => resolveLocations(deduped),
  );
  const displayMap = useMemo(() => new Map((data ?? []).map((item) => [item.uuid, item.display])), [data]);
  return { data: data ?? [], displayMap, error, isLoading };
}

export function useResolvedDiagnosticos(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  const { data, error, isLoading } = useSWR<Array<DiagnosticoOption>, Error>(
    deduped.length ? ['resolved-diagnosticos', ...deduped] : null,
    () => resolveDiagnosticos(deduped),
  );
  const resolveMap = useMemo(() => new Map((data ?? []).map((item) => [item.uuid, item])), [data]);
  return { data: data ?? [], resolveMap, error, isLoading };
}

export function useResolvedOrdenes(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  const { data, error, isLoading } = useSWR<Record<string, string>, Error>(
    deduped.length ? ['resolved-ordenes', ...deduped] : null,
    () => resolveOrdenes(deduped),
  );
  const displayMap = useMemo(() => new Map(Object.entries(data ?? {})), [data]);
  return { data, displayMap, error, isLoading };
}

export function notifySuccess(message: string) {
  showSnackbar({ title: message, kind: 'success', isLowContrast: true });
}

export function notifyError(message: string) {
  showSnackbar({ title: message, kind: 'error', isLowContrast: true });
}
