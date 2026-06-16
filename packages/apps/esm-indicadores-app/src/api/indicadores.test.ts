import { openmrsFetch } from '@openmrs/esm-framework';
import { describe, expect, it, vi } from 'vitest';

import { resolveOrdenes } from './indicadores';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);

describe('resolveOrdenes', () => {
  it('returns empty Record for empty input without calling fetch', async () => {
    mockedOpenmrsFetch.mockReset();

    const result = await resolveOrdenes([]);

    expect(result).toEqual({});
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('returns resolved Record from the API on success', async () => {
    const mockData = { 'ord-hemograma': 'Hemograma', 'ord-ferritina': 'Ferritina sérica' };
    mockedOpenmrsFetch.mockResolvedValue({ data: mockData } as any);

    const result = await resolveOrdenes(['ord-hemograma', 'ord-ferritina']);

    expect(result).toEqual(mockData);
  });

  it('falls back to mock on fetch error', async () => {
    mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));

    const result = await resolveOrdenes(['ord-hemograma', 'ord-fluor']);

    expect(result).toEqual({
      'ord-hemograma': 'Hemograma',
      'ord-fluor': 'Aplicación de flúor',
    });
  });

  it('excludes unknown UUIDs when falling back to mock', async () => {
    mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));

    const result = await resolveOrdenes(['ord-hemograma', 'unknown-uuid']);

    expect(result).toEqual({ 'ord-hemograma': 'Hemograma' });
    expect(result['unknown-uuid']).toBeUndefined();
  });
});
