import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteMeta, getMetaByIndicator, upsertMeta } from '../../api/metas';
import type { IndicadorMetaCreatePayload } from '../../api/types';
import { useDeleteMeta, useMetaByIndicator, useUpsertMeta } from './hooks';

vi.mock('../../api/metas', async () => ({
  ...(await vi.importActual('../../api/metas')),
  getMetaByIndicator: vi.fn(),
  upsertMeta: vi.fn(),
  deleteMeta: vi.fn(),
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return { ...actual, useSWRConfig: vi.fn() };
});

const mockedUseSWRConfig = vi.mocked(useSWRConfig);
const mockedGetMetaByIndicator = vi.mocked(getMetaByIndicator);
const mockedUpsertMeta = vi.mocked(upsertMeta);
const mockedDeleteMeta = vi.mocked(deleteMeta);

const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

type KeyMatcher = (key: unknown) => boolean | Promise<boolean>;

function captureMatcher() {
  const captured: { matcher: KeyMatcher | null } = { matcher: null };
  const mutate = ((matcher: KeyMatcher) => {
    captured.matcher = matcher;
    return Promise.resolve();
  }) as unknown as ReturnType<typeof useSWRConfig>['mutate'];
  mockedUseSWRConfig.mockReturnValue({ mutate } as ReturnType<typeof useSWRConfig>);
  return captured;
}

function expectInvalidatesMetaKeys(matcher: KeyMatcher | null) {
  expect(matcher).not.toBeNull();
  const isInvalidated = matcher as KeyMatcher;
  expect(isInvalidated(['meta', 'indicator', 'indicator-a', 2026])).toBe(true);
  expect(isInvalidated(['indicadores', 1, 100])).toBe(false);
  expect(isInvalidated('meta')).toBe(false);
}

const sampleMeta = {
  id: 'meta-a',
  indicador_version_id: 'version-a',
  anio: 2026,
  valor_meta: 1000,
  creado_en: '2026-01-01',
  indicador_nombre: 'Control prenatal',
  version_numero: 1,
};

describe('useMetaByIndicator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the selected indicator and year only', async () => {
    mockedGetMetaByIndicator.mockResolvedValue(sampleMeta);
    const { result } = renderHook(() => useMetaByIndicator('indicator-a', 2026), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetMetaByIndicator).toHaveBeenCalledWith('indicator-a', 2026);
    expect(result.current.data).toEqual(sampleMeta);
  });

  it('treats the contractual missing-meta 404 as an unconfigured meta', async () => {
    mockedGetMetaByIndicator.mockRejectedValue({
      response: { status: 404 },
      responseBody: { detail: { field: 'indicador_version_id', message: 'Meta no encontrada' } },
    });
    const { result } = renderHook(() => useMetaByIndicator('indicator-a', 2026), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeUndefined();
  });

  it('surfaces a generic 404 because it can mean that the service route is unavailable', async () => {
    mockedGetMetaByIndicator.mockRejectedValue({ response: { status: 404 } });
    const { result } = renderHook(() => useMetaByIndicator('indicator-a', 2026), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces the 404 returned when the indicator has no active version', async () => {
    mockedGetMetaByIndicator.mockRejectedValue({
      response: { status: 404 },
      responseBody: { detail: { field: 'indicador_id', message: 'No hay versiones activas' } },
    });
    const { result } = renderHook(() => useMetaByIndicator('indicator-a', 2026), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it.each([422, 500])('surfaces HTTP %s instead of treating it as no meta', async (status) => {
    mockedGetMetaByIndicator.mockRejectedValue({ response: { status } });
    const { result } = renderHook(() => useMetaByIndicator('indicator-a', 2026), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('does not issue a lookup until both filters exist', () => {
    renderHook(() => useMetaByIndicator('', null), { wrapper: swrWrapper });
    expect(mockedGetMetaByIndicator).not.toHaveBeenCalled();
  });
});

describe('meta mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates meta lookups only after a successful upsert', async () => {
    mockedUpsertMeta.mockResolvedValue(sampleMeta);
    const capture = captureMatcher();
    const { result } = renderHook(() => useUpsertMeta());
    const payload: IndicadorMetaCreatePayload = {
      indicador_version_id: 'version-a',
      anio: 2026,
      valor_meta: 1500,
    };

    await result.current.upsertMeta(payload);

    expect(mockedUpsertMeta).toHaveBeenCalledWith(payload);
    expectInvalidatesMetaKeys(capture.matcher);
  });

  it.each([422, 500])('does not invalidate meta lookups after a failed HTTP %s upsert', async (status) => {
    const error = { response: { status } };
    mockedUpsertMeta.mockRejectedValue(error);
    const capture = captureMatcher();
    const { result } = renderHook(() => useUpsertMeta());

    await expect(
      result.current.upsertMeta({ indicador_version_id: 'version-a', anio: 2026, valor_meta: 1500 }),
    ).rejects.toBe(error);
    expect(capture.matcher).toBeNull();
  });

  it('invalidates meta lookups only after a successful delete', async () => {
    mockedDeleteMeta.mockResolvedValue(undefined);
    const capture = captureMatcher();
    const { result } = renderHook(() => useDeleteMeta());

    await result.current.deleteMeta('version-a', 2026);

    expect(mockedDeleteMeta).toHaveBeenCalledWith('version-a', 2026);
    expectInvalidatesMetaKeys(capture.matcher);
  });

  it('does not invalidate meta lookups after a failed delete', async () => {
    const error = new TypeError('Failed to fetch');
    mockedDeleteMeta.mockRejectedValue(error);
    const capture = captureMatcher();
    const { result } = renderHook(() => useDeleteMeta());

    await expect(result.current.deleteMeta('version-a', 2026)).rejects.toBe(error);
    expect(capture.matcher).toBeNull();
  });
});
