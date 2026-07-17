import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { deleteMeta, getMetaByIndicator, isMetaNotFoundError, upsertMeta } from '../../api/metas';
import type { IndicadorMeta, IndicadorMetaCreatePayload } from '../../api/types';

function isMetaKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === 'meta';
}

export function useMetaByIndicator(indicadorId: string, anio: number | null) {
  const { data, error, isLoading, mutate } = useSWR<IndicadorMeta | null, Error>(
    indicadorId && anio !== null ? ['meta', 'indicator', indicadorId, anio] : null,
    async () => {
      try {
        return await getMetaByIndicator(indicadorId, anio as number);
      } catch (lookupError) {
        if (isMetaNotFoundError(lookupError)) {
          return null;
        }
        throw lookupError;
      }
    },
  );

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
      await mutate((key) => isMetaKey(key));
      return result;
    },
    [mutate],
  );

  return { upsertMeta: upsert };
}

export function useDeleteMeta() {
  const { mutate } = useSWRConfig();

  const remove = useCallback(
    async (indicadorVersionId: string, anio: number) => {
      await deleteMeta(indicadorVersionId, anio);
      await mutate((key) => isMetaKey(key));
    },
    [mutate],
  );

  return { deleteMeta: remove };
}
