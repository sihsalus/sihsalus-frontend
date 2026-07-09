import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllMetasMock, resetMetasMock, upsertMetaMock } from '../mocks/indicators-data';
import { deleteMeta, getAllMetas, getMeta, upsertMeta } from './metas';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);

describe('metas API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMetasMock();
  });

  describe('getAllMetas', () => {
    it('returns metas from the backend when available', async () => {
      const backendMetas = [
        { id: 'meta-1', indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1000, creado_en: '2026-01-01' },
      ];
      mockedOpenmrsFetch.mockResolvedValue({ data: backendMetas } as any);

      const result = await getAllMetas();

      expect(result).toEqual(backendMetas);
    });

    it('falls back to mock metas when the backend fails', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      upsertMetaMock({ indicador_version_id: 'ver-002-1', anio: 2025, valor_meta: 500 });

      const result = await getAllMetas();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        indicador_version_id: 'ver-002-1',
        anio: 2025,
        valor_meta: 500,
      });
    });
  });

  describe('getMeta', () => {
    it('returns a single meta from the backend when available', async () => {
      const backendMeta = { id: 'meta-1', indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1000, creado_en: '2026-01-01' };
      mockedOpenmrsFetch.mockResolvedValue({ data: backendMeta } as any);

      const result = await getMeta('ver-001-1', 2026);

      expect(result).toEqual(backendMeta);
    });

    it('falls back to the mock store for a matching version and year', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      upsertMetaMock({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1200 });

      const result = await getMeta('ver-001-1', 2026);

      expect(result.valor_meta).toBe(1200);
    });

    it('falls back to the mock store for an indicador_id query', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      upsertMetaMock({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1200 });

      const result = await getMeta('ver-001-1', 2026);

      expect(result.indicador_version_id).toBe('ver-001-1');
    });
  });

  describe('upsertMeta', () => {
    it('sends a PUT request and returns the created meta on success', async () => {
      const payload = { indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1500 };
      const backendMeta = { id: 'meta-1', ...payload, creado_en: '2026-01-01' };
      mockedOpenmrsFetch.mockResolvedValue({ data: backendMeta } as any);

      const result = await upsertMeta(payload);

      expect(result).toEqual(backendMeta);
      const [, init] = mockedOpenmrsFetch.mock.calls[0];
      expect(init?.method).toBe('PUT');
      expect((init?.body as any).valor_meta).toBe(1500);
    });

    it('creates a new meta in the mock store when the backend fails', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      const payload = { indicador_version_id: 'ver-003-1', anio: 2024, valor_meta: 750 };

      const result = await upsertMeta(payload);

      expect(result).toMatchObject(payload);
      expect(getAllMetasMock()).toHaveLength(1);
    });

    it('updates an existing meta in the mock store when the backend fails', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      const created = upsertMetaMock({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1000 });

      const result = await upsertMeta({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 2000 });

      expect(result.id).toBe(created.id);
      expect(result.valor_meta).toBe(2000);
      expect(getAllMetasMock()).toHaveLength(1);
    });
  });

  describe('deleteMeta', () => {
    it('sends a DELETE request when the backend is available', async () => {
      mockedOpenmrsFetch.mockResolvedValue({ data: undefined } as any);

      await deleteMeta('ver-001-1', 2026);

      const [url, init] = mockedOpenmrsFetch.mock.calls[0];
      expect(init?.method).toBe('DELETE');
      expect(url).toContain('indicador_version_id=ver-001-1');
      expect(url).toContain('anio=2026');
    });

    it('removes the meta from the mock store when the backend fails', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));
      upsertMetaMock({ indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1000 });

      await deleteMeta('ver-001-1', 2026);

      expect(getAllMetasMock()).toHaveLength(0);
    });

    it('does not throw when deleting a non-existent meta', async () => {
      mockedOpenmrsFetch.mockRejectedValue(new Error('Network error'));

      await expect(deleteMeta('ver-missing', 2026)).resolves.toBeUndefined();
    });
  });
});
