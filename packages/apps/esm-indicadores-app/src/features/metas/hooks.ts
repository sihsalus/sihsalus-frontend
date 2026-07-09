import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { deleteMeta, getAllMetas, upsertMeta } from '../../api/metas';
import type { IndicadorMeta, IndicadorMetaCreatePayload } from '../../api/types';

function isMetasKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'metas';
}

export function useMetas() {
  const { data, error, isLoading, mutate } = useSWR<Array<IndicadorMeta>, Error>(['metas'], () => getAllMetas());

  return {
    data,
    error,
    isLoading,
    isError: Boolean(error),
    refetch: mutate,
  };
}

export function useUpsertMeta() {
  const { mutate } = useSWRConfig();

  const upsert = useCallback(
    async (payload: IndicadorMetaCreatePayload) => {
      const result = await upsertMeta(payload);
      await mutate((key) => isMetasKey(key));
      return result;
    },
    [mutate],
  );

  return { upsertMeta: upsert };
}

export function useDeleteMeta() {
  const { mutate } = useSWRConfig();

  const remove = useCallback(
    async (indicador_version_id: string, anio: number) => {
      await deleteMeta(indicador_version_id, anio);
      await mutate((key) => isMetasKey(key));
    },
    [mutate],
  );

  return { deleteMeta: remove };
}
