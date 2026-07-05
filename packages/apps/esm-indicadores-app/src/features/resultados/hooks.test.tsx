import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calcularAhora, getResultados, getResultadosSeries, recalcularAnio } from '../../api/resultados';
import type { GetResultadosParams, GetSeriesParams } from '../../api/types';
import { useCalcularAhora, useRecalcularAnio, useResultados, useResultadosSeries } from './hooks';

vi.mock('../../api/resultados', async () => ({
  ...(await vi.importActual('../../api/resultados')),
  calcularAhora: vi.fn(),
  recalcularAnio: vi.fn(),
  getResultados: vi.fn(),
  getResultadosSeries: vi.fn(),
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return {
    ...actual,
    useSWRConfig: vi.fn(),
  };
});

// Mocked handles for mutation hook tests
const mockedUseSWRConfig = vi.mocked(useSWRConfig);
const mockedCalcularAhora = vi.mocked(calcularAhora);
const mockedRecalcularAnio = vi.mocked(recalcularAnio);

// Mocked handles for fetching hook tests
const mockGetResultados = vi.mocked(getResultados);
const mockGetResultadosSeries = vi.mocked(getResultadosSeries);

// Wrapper that provides an isolated SWR cache for the fetching hook tests
const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

type KeyMatcher = (key: unknown) => boolean | Promise<boolean>;

/**
 * Captures the matcher predicate the hook passes to `mutate(...)` so the
 * test can call it against representative SWR cache keys and verify that
 * the right namespaces are invalidated.
 */
function captureMatcher(): { matcher: KeyMatcher | null } {
  const captured: { matcher: KeyMatcher | null } = { matcher: null };
  const mutate = ((matcher: KeyMatcher) => {
    captured.matcher = matcher;
    return Promise.resolve();
  }) as unknown as ReturnType<typeof useSWRConfig>['mutate'];
  mockedUseSWRConfig.mockReturnValue({
    mutate,
  } as unknown as ReturnType<typeof useSWRConfig>);
  return captured;
}

function expectInvalidatesResultadosKeys(matcher: KeyMatcher | null) {
  expect(matcher).not.toBeNull();
  // Capture into a local with a narrowed type so the rest of the body can
  // call the matcher without non-null assertion warnings.
  const isInvalidated: KeyMatcher = matcher as KeyMatcher;
  // The hook must invalidate the `resultados` namespace, regardless of the
  // payload that follows the first element (params, fetcher, etc.).
  expect(isInvalidated(['resultados', { page: 1, size: 10 }])).toBe(true);
  expect(isInvalidated(['resultados', { indicador_id: 'ind-001' }])).toBe(true);
  // And the `resultados-series` namespace too.
  expect(isInvalidated(['resultados-series', { indicador_id: 'ind-001', anio: 2026 }])).toBe(true);
  expect(
    isInvalidated(['resultados-series', { indicador_id: 'ind-002', anio: 2026, granularity: 'trimestral' }]),
  ).toBe(true);
  // Other namespaces must NOT be touched.
  expect(isInvalidated(['indicadores', 1, 10])).toBe(false);
  expect(isInvalidated(['indicador', 'ind-001'])).toBe(false);
  expect(isInvalidated(['indicador-sql-preview', 'ind-001', 'latest'])).toBe(false);
  expect(isInvalidated(['location-search', 'materno'])).toBe(false);
  // Non-array keys must NOT be touched (SWR passes the key as-is; the
  // predicate should not throw or return true on a non-array).
  expect(isInvalidated('resultados')).toBe(false);
  expect(isInvalidated(null)).toBe(false);
  expect(isInvalidated(undefined)).toBe(false);
}

const resultadosParams = {
  page: 0,
  size: 20,
  indicador_id: 'ind-001',
  periodo_inicio: '2026-01-01',
  periodo_fin: '2026-01-31',
} satisfies GetResultadosParams;

const seriesParams = {
  indicador_id: 'ind-001',
  anio: 2026,
  granularity: 'mensual',
} satisfies GetSeriesParams;

describe('useCalcularAhora', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCalcularAhora.mockResolvedValue({
      calculados: 2,
      errores: [],
      total: 2,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes a predicate to mutate that invalidates resultados and resultados-series keys', async () => {
    const capture = captureMatcher();
    const { result } = renderHook(() => useCalcularAhora());

    await result.current.calcularAhora();

    // The hook invoked the API
    expect(mockedCalcularAhora).toHaveBeenCalledTimes(1);
    // The hook handed a predicate to mutate
    expectInvalidatesResultadosKeys(capture.matcher);
  });

  it('still calls mutate even when the API response has errors', async () => {
    const capture = captureMatcher();
    mockedCalcularAhora.mockResolvedValueOnce({
      calculados: 0,
      errores: [{ indicador_id: 'ind-001', indicador_nombre: 'X', error: 'boom' }],
      total: 1,
    });

    const { result } = renderHook(() => useCalcularAhora());

    await result.current.calcularAhora();

    expect(mockedCalcularAhora).toHaveBeenCalledTimes(1);
    // Cache invalidation still runs so the table reflects any partial work
    // the backend managed to commit.
    expectInvalidatesResultadosKeys(capture.matcher);
  });
});

describe('useRecalcularAnio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRecalcularAnio.mockResolvedValue({
      anio: 2026,
      indicador_id: null,
      meses_procesados: 12,
      indicadores_considerados: 1,
      recalculados: 12,
      errores: [],
      total: 12,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes a predicate to mutate that invalidates resultados and resultados-series keys', async () => {
    const capture = captureMatcher();
    const { result } = renderHook(() => useRecalcularAnio());

    await result.current.recalcularAnio({ anio: 2026 });

    expect(mockedRecalcularAnio).toHaveBeenCalledTimes(1);
    expect(mockedRecalcularAnio).toHaveBeenCalledWith({ anio: 2026 });
    expectInvalidatesResultadosKeys(capture.matcher);
  });

  it('forwards the indicador_id scope to the API and still invalidates both cache namespaces', async () => {
    const capture = captureMatcher();
    const { result } = renderHook(() => useRecalcularAnio());

    await result.current.recalcularAnio({ anio: 2025, indicador_id: 'ind-001' });

    expect(mockedRecalcularAnio).toHaveBeenCalledWith({ anio: 2025, indicador_id: 'ind-001' });
    expectInvalidatesResultadosKeys(capture.matcher);
  });
});

describe('useResultados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads resultados and returns loading state correctly', async () => {
    mockGetResultados.mockResolvedValue({
      items: [],
      total: 0,
      page: 0,
      size: 20,
      pages: 0,
    });

    const { result } = renderHook(() => useResultados(resultadosParams), {
      wrapper: swrWrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBeUndefined();
    });

    expect(result.current.data?.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns an error when resultados request fails', async () => {
    mockGetResultados.mockRejectedValue(new Error('Falla'));

    const { result } = renderHook(() => useResultados(resultadosParams), {
      wrapper: swrWrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useResultadosSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads resultados series when params are provided', async () => {
    mockGetResultadosSeries.mockResolvedValue({
      items: [
        {
          periodo_label: '2026-01',
          valor: 10,
          meses_disponibles: 1,
          anio: 2026,
          mes_referencia: '2026-01',
        },
      ],
      indicador_id: 'ind-001',
      anio: 2026,
      granularity: 'mensual',
    });

    const { result } = renderHook(() => useResultadosSeries(seriesParams), {
      wrapper: swrWrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBeUndefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not call resultados series API when params are null', () => {
    mockGetResultadosSeries.mockResolvedValue({
      items: [],
      indicador_id: 'ind-001',
      anio: 2026,
      granularity: 'mensual',
    });

    renderHook(() => useResultadosSeries(null), { wrapper: swrWrapper });

    expect(mockGetResultadosSeries).not.toHaveBeenCalled();
  });
});
