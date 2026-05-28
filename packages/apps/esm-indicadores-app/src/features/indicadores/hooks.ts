import { showSnackbar } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
  createIndicador,
  createVersion,
  deleteIndicador,
  getIndicador,
  getIndicadores,
  previewSql,
  resolveDiagnosticos,
  resolveLocations,
  searchDiagnosticos,
  searchLocations,
  searchOrdenes,
  updateIndicador,
} from '../../api/indicadores';
import type {
  DefinicionIndicadorForm,
  DiagnosticoOption,
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
  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Indicador>, Error>(indicadoresKey(page, size), () => getIndicadores(page, size));
  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useIndicador(id: string) {
  const { data, error, isLoading, mutate } = useSWR<IndicadorDetail, Error>(id ? indicadorKey(id) : null, () => getIndicador(id));
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

  const create = useCallback(async (payload: IndicadorCreatePayload) => {
    const result = await createIndicador(payload);
    await mutate((key) => Array.isArray(key) && key[0] === 'indicadores');
    return result;
  }, [mutate]);

  return { createIndicador: create };
}

export function useUpdateIndicador() {
  const { mutate } = useSWRConfig();

  const update = useCallback(async (id: string, payload: IndicadorUpdatePayload) => {
    const result = await updateIndicador(id, payload);
    await mutate((key) => Array.isArray(key) && (key[0] === 'indicadores' || (key[0] === 'indicador' && key[1] === id)));
    return result;
  }, [mutate]);

  return { updateIndicador: update };
}

export function useDeleteIndicador() {
  const { mutate } = useSWRConfig();

  const remove = useCallback(async (id: string) => {
    await deleteIndicador(id);
    await mutate((key) => Array.isArray(key) && (key[0] === 'indicadores' || (key[0] === 'indicador' && key[1] === id)));
  }, [mutate]);

  return { deleteIndicador: remove };
}

export function useCreateVersion(id: string) {
  const { mutate } = useSWRConfig();

  const create = useCallback(async (definicion: DefinicionIndicadorForm) => {
    const result = await createVersion(id, definicion);
    await mutate(indicadorKey(id));
    return result;
  }, [id, mutate]);

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
  const { data, error, isLoading } = useSWR<Array<LocationOption>, Error>(query.trim() ? ['location-search', query] : null, () => searchLocations(query));
  return { data: data ?? [], error, isLoading };
}

export function useDiagnosticoSearch(query: string) {
  const { data, error, isLoading } = useSWR<Array<DiagnosticoOption>, Error>(query.trim() ? ['diagnostico-search', query] : null, () => searchDiagnosticos(query));
  return { data: data ?? [], error, isLoading };
}

export function useOrdenSearch(query: string) {
  const { data, error, isLoading } = useSWR<Array<OrdenOption>, Error>(query.trim() ? ['orden-search', query] : null, () => searchOrdenes(query));
  return { data: data ?? [], error, isLoading };
}

export function useResolvedLocations(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  const { data, error, isLoading } = useSWR<Array<LocationOption>, Error>(deduped.length ? ['resolved-locations', ...deduped] : null, () => resolveLocations(deduped));
  const displayMap = useMemo(() => new Map((data ?? []).map((item) => [item.uuid, item.display])), [data]);
  return { data: data ?? [], displayMap, error, isLoading };
}

export function useResolvedDiagnosticos(uuids: Array<string>) {
  const deduped = useMemo(() => Array.from(new Set(uuids.filter(Boolean))), [uuids]);
  const { data, error, isLoading } = useSWR<Array<DiagnosticoOption>, Error>(deduped.length ? ['resolved-diagnosticos', ...deduped] : null, () => resolveDiagnosticos(deduped));
  const resolveMap = useMemo(() => new Map((data ?? []).map((item) => [item.uuid, item])), [data]);
  return { data: data ?? [], resolveMap, error, isLoading };
}

export function notifySuccess(message: string) {
  showSnackbar({ title: message, kind: 'success', isLowContrast: true });
}

export function notifyError(message: string) {
  showSnackbar({ title: message, kind: 'error', isLowContrast: true });
}
