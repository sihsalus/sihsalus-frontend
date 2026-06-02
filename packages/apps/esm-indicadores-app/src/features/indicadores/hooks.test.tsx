import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';

import { resolveOrdenes } from '../../api/indicadores';
import { useResolvedOrdenes } from './hooks';

vi.mock('../../api/indicadores', async () => ({
  ...(await vi.importActual('../../api/indicadores')),
  resolveOrdenes: vi.fn(),
}));

const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
);

const mockResolveOrdenes = vi.mocked(resolveOrdenes);

describe('useResolvedOrdenes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns displayMap with resolved entries on success', async () => {
    mockResolveOrdenes.mockResolvedValue({
      'ord-hemograma': 'Hemograma',
      'ord-ferritina': 'Ferritina sérica',
    });

    const { result } = renderHook(
      () => useResolvedOrdenes(['ord-hemograma', 'ord-ferritina']),
      { wrapper: swrWrapper },
    );

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

    renderHook(
      () => useResolvedOrdenes(['ord-hemograma', 'ord-hemograma', 'ord-hemograma']),
      { wrapper: swrWrapper },
    );

    await waitFor(() => {
      expect(mockResolveOrdenes).toHaveBeenCalledWith(['ord-hemograma']);
    });
  });

  it('returns error state when resolution fails', async () => {
    mockResolveOrdenes.mockRejectedValue(new Error('Resolution failed'));

    const { result } = renderHook(
      () => useResolvedOrdenes(['ord-hemograma']),
      { wrapper: swrWrapper },
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.displayMap.size).toBe(0);
  });

  it('shows isLoading=true initially when UUIDs are provided', () => {
    mockResolveOrdenes.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(
      () => useResolvedOrdenes(['ord-hemograma']),
      { wrapper: swrWrapper },
    );

    expect(result.current.isLoading).toBe(true);
  });
});
