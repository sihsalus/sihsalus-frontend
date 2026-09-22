import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getIndicadores, resolveOrdenes } from '../../api/indicadores';
import type { Indicador, PaginatedResponse } from '../../api/types';
import { useAllIndicadores, useResolvedOrdenes } from './hooks';

vi.mock('../../api/indicadores', async () => ({
  ...(await vi.importActual('../../api/indicadores')),
  getIndicadores: vi.fn(),
  resolveOrdenes: vi.fn(),
}));

const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

const mockResolveOrdenes = vi.mocked(resolveOrdenes);
const mockGetIndicadores = vi.mocked(getIndicadores);

function page<T>(items: Array<T>, total: number, pageNumber: number, size: number): PaginatedResponse<T> {
  return {
    items,
    total,
    page: pageNumber,
    size,
    pages: Math.ceil(total / size),
  };
}

function makeIndicador(id: string): Indicador {
  return { id, nombre: `Indicador ${id}`, descripcion: null, activo: true, creado_en: '2026-01-01' };
}

describe('useResolvedOrdenes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns displayMap with resolved entries on success', async () => {
    mockResolveOrdenes.mockResolvedValue({
      'ord-hemograma': 'Hemograma',
      'ord-ferritina': 'Ferritina sérica',
    });

    const { result } = renderHook(() => useResolvedOrdenes(['ord-hemograma', 'ord-ferritina']), {
      wrapper: swrWrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.displayMap.get('ord-hemograma')).toBe('Hemograma');
    expect(result.current.displayMap.get('ord-ferritina')).toBe('Ferritina sérica');
    expect(result.current.error).toBeUndefined();
  });

  it('returns empty displayMap with empty UUIDs', () => {
    const { result } = renderHook(() => useResolvedOrdenes([]), { wrapper: swrWrapper });

    expect(mockResolveOrdenes).not.toHaveBeenCalled();
    expect(result.current.displayMap.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('deduplicates UUIDs before resolving', async () => {
    mockResolveOrdenes.mockResolvedValue({
      'ord-hemograma': 'Hemograma',
    });

    renderHook(() => useResolvedOrdenes(['ord-hemograma', 'ord-hemograma', 'ord-hemograma']), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(mockResolveOrdenes).toHaveBeenCalledWith(['ord-hemograma']);
    });
  });

  it('returns error state when resolution fails', async () => {
    mockResolveOrdenes.mockRejectedValue(new Error('Resolution failed'));

    const { result } = renderHook(() => useResolvedOrdenes(['ord-hemograma']), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.displayMap.size).toBe(0);
  });

  it('shows isLoading=true initially when UUIDs are provided', () => {
    mockResolveOrdenes.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useResolvedOrdenes(['ord-hemograma']), { wrapper: swrWrapper });

    expect(result.current.isLoading).toBe(true);
  });
});

describe('useAllIndicadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` does not reset `mockResolvedValueOnce` queues, so the
    // per-test once-sequences would leak across tests. Reset the mock fully.
    mockGetIndicadores.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('auto-paginates across every page until all items are collected', async () => {
    // The hook requests pages of size 100. With total=150 it takes 2 pages:
    // the first returns a full 100-item page (no early stop), the second
    // returns the remaining 50 (fewer than size → terminate the loop).
    const firstPageItems = Array.from({ length: 100 }, (_, idx) =>
      makeIndicador(`ind-${String(idx + 1).padStart(3, '0')}`),
    );
    const secondPageItems = Array.from({ length: 50 }, (_, idx) =>
      makeIndicador(`ind-${String(idx + 101).padStart(3, '0')}`),
    );

    mockGetIndicadores
      .mockResolvedValueOnce(page(firstPageItems, 150, 1, 100))
      .mockResolvedValueOnce(page(secondPageItems, 150, 2, 100));

    const { result } = renderHook(() => useAllIndicadores(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetIndicadores).toHaveBeenCalledTimes(2);
    expect(mockGetIndicadores).toHaveBeenNthCalledWith(1, 1, 100);
    expect(mockGetIndicadores).toHaveBeenNthCalledWith(2, 2, 100);
    expect(result.current.data).toHaveLength(150);
    expect(result.current.error).toBeUndefined();
  });

  it('stops after a single page when the first page returns fewer items than size', async () => {
    const singlePageItems = Array.from({ length: 40 }, (_, idx) => makeIndicador(`ind-${idx + 1}`));

    mockGetIndicadores.mockResolvedValueOnce(page(singlePageItems, 40, 1, 100));

    const { result } = renderHook(() => useAllIndicadores(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetIndicadores).toHaveBeenCalledTimes(1);
    expect(result.current.data).toHaveLength(40);
  });

  it('rejects a truncated page instead of returning a partial catalogue', async () => {
    mockGetIndicadores.mockResolvedValueOnce(page([makeIndicador('ind-1')], 150, 1, 100));
    const { result } = renderHook(() => useAllIndicadores(), { wrapper: swrWrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('rejects repeated pages instead of presenting duplicated indicators', async () => {
    const items = Array.from({ length: 100 }, (_, index) => makeIndicador(`ind-${index}`));
    mockGetIndicadores.mockResolvedValueOnce(page(items, 200, 1, 100)).mockResolvedValueOnce(page(items, 200, 2, 100));
    const { result } = renderHook(() => useAllIndicadores(), { wrapper: swrWrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces an error when a page request fails', async () => {
    mockGetIndicadores.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useAllIndicadores(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
