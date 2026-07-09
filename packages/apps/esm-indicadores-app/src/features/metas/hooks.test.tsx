import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteMeta, getAllMetas, upsertMeta } from '../../api/metas';
import type { IndicadorMetaCreatePayload } from '../../api/types';
import { useDeleteMeta, useMetas, useUpsertMeta } from './hooks';

vi.mock('../../api/metas', async () => ({
  ...(await vi.importActual('../../api/metas')),
  getAllMetas: vi.fn(),
  upsertMeta: vi.fn(),
  deleteMeta: vi.fn(),
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return {
    ...actual,
    useSWRConfig: vi.fn(),
  };
});

const mockedUseSWRConfig = vi.mocked(useSWRConfig);
const mockedGetAllMetas = vi.mocked(getAllMetas);
const mockedUpsertMeta = vi.mocked(upsertMeta);
const mockedDeleteMeta = vi.mocked(deleteMeta);

const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

type KeyMatcher = (key: unknown) => boolean | Promise<boolean>;

function captureMatcher(): { matcher: KeyMatcher | null } {
  const captured: { matcher: KeyMatcher | null } = { matcher: null };
  const mutate = ((matcher: KeyMatcher) => {
    captured.matcher = matcher;
    return Promise.resolve();
  }) as unknown as ReturnType<typeof useSWRConfig>['mutate'];
  mockedUseSWRConfig.mockReturnValue({ mutate } as unknown as ReturnType<typeof useSWRConfig>);
  return captured;
}

function expectInvalidatesMetasKeys(matcher: KeyMatcher | null) {
  expect(matcher).not.toBeNull();
  const isInvalidated: KeyMatcher = matcher as KeyMatcher;
  expect(isInvalidated(['metas'])).toBe(true);
  expect(isInvalidated(['metas', 'extra'])).toBe(true);
  expect(isInvalidated(['indicadores', 1, 100])).toBe(false);
  expect(isInvalidated('metas')).toBe(false);
  expect(isInvalidated(null)).toBe(false);
}

const sampleMeta = {
  id: 'meta-1',
  indicador_version_id: 'ver-001-1',
  anio: 2026,
  valor_meta: 1000,
  creado_en: '2026-01-01',
  indicador_nombre: 'Control prenatal',
  version_numero: 1,
};

describe('useMetas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the metas list', async () => {
    mockedGetAllMetas.mockResolvedValue([sampleMeta]);

    const { result } = renderHook(() => useMetas(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].valor_meta).toBe(1000);
    expect(result.current.error).toBeUndefined();
  });

  it('returns an error when the request fails', async () => {
    mockedGetAllMetas.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useMetas(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useUpsertMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpsertMeta.mockResolvedValue(sampleMeta);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates the metas cache after a successful upsert', async () => {
    const capture = captureMatcher();
    const { result } = renderHook(() => useUpsertMeta());

    const payload: IndicadorMetaCreatePayload = {
      indicador_version_id: 'ver-001-1',
      anio: 2026,
      valor_meta: 1500,
    };
    await result.current.upsertMeta(payload);

    expect(mockedUpsertMeta).toHaveBeenCalledTimes(1);
    expect(mockedUpsertMeta).toHaveBeenCalledWith(payload);
    expectInvalidatesMetasKeys(capture.matcher);
  });

  it('surfaces the API error without invalidating the cache on failure', async () => {
    mockedUpsertMeta.mockRejectedValueOnce(new Error('Network error'));
    const capture = captureMatcher();
    const { result } = renderHook(() => useUpsertMeta());

    await expect(
      result.current.upsertMeta({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1500 }),
    ).rejects.toThrow('Network error');

    expect(capture.matcher).toBeNull();
  });
});

describe('useDeleteMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDeleteMeta.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates the metas cache after a successful delete', async () => {
    const capture = captureMatcher();
    const { result } = renderHook(() => useDeleteMeta());

    await result.current.deleteMeta('ver-001-1', 2026);

    expect(mockedDeleteMeta).toHaveBeenCalledTimes(1);
    expect(mockedDeleteMeta).toHaveBeenCalledWith('ver-001-1', 2026);
    expectInvalidatesMetasKeys(capture.matcher);
  });
});
