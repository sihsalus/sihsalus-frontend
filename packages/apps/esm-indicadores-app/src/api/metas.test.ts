import { getConfig, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteMeta, getMetaByIndicator, getMetaByVersion, isMetaNotFoundError, upsertMeta } from './metas';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockedGetConfig = vi.mocked(getConfig);

const meta = {
  id: 'meta-a',
  indicador_version_id: 'version-a',
  anio: 2026,
  valor_meta: 1500,
  creado_en: '2026-01-01',
  indicador_nombre: 'Control prenatal',
  version_numero: 3,
};

describe('metas API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockResolvedValue({ reportesSqlApiPath: '/services/reportes-sql' });
  });

  it('looks up the latest active version meta by indicador_id and year', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: meta } as never);

    await expect(getMetaByIndicator('indicator-a', 2026)).resolves.toEqual(meta);
    expect(mockedOpenmrsFetch.mock.calls[0][0]).toBe('/services/reportes-sql/metas?indicador_id=indicator-a&anio=2026');
  });

  it('looks up a meta by exact version and year when explicitly requested', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: meta } as never);

    await expect(getMetaByVersion('version-a', 2026)).resolves.toEqual(meta);
    expect(mockedOpenmrsFetch.mock.calls[0][0]).toBe(
      '/services/reportes-sql/metas?indicador_version_id=version-a&anio=2026',
    );
  });

  it('does not mistake a 500 response for an absent meta', async () => {
    const error = Object.assign(new Error('database failed'), { response: { status: 500 } });
    mockedOpenmrsFetch.mockRejectedValue(error);

    await expect(getMetaByIndicator('indicator-a', 2026)).rejects.toBe(error);
    expect(isMetaNotFoundError(error)).toBe(false);
  });

  it('recognizes only the contractual missing-meta 404 as an absent meta', () => {
    const detail = { field: 'indicador_version_id', message: 'Meta no encontrada' };

    expect(isMetaNotFoundError({ response: { status: 404 }, responseBody: { detail } })).toBe(true);
    expect(isMetaNotFoundError({ status: 404, responseBody: { detail } })).toBe(true);
    expect(isMetaNotFoundError({ response: { status: 404 } })).toBe(false);
    expect(
      isMetaNotFoundError({
        response: { status: 404 },
        responseBody: { detail: { field: 'indicador_id', message: 'No hay versiones activas' } },
      }),
    ).toBe(false);
    expect(isMetaNotFoundError({ response: { status: 422 } })).toBe(false);
    expect(isMetaNotFoundError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('upserts through the real backend and accepts its metadata-light response', async () => {
    const payload = { indicador_version_id: 'version-a', anio: 2026, valor_meta: 1500 };
    const response = { id: 'meta-a', ...payload, creado_en: '2026-01-01' };
    mockedOpenmrsFetch.mockResolvedValue({ data: response } as never);

    await expect(upsertMeta(payload)).resolves.toEqual(response);
    expect(mockedOpenmrsFetch).toHaveBeenCalledWith(
      '/services/reportes-sql/metas/',
      expect.objectContaining({ method: 'PUT', body: payload }),
    );
  });

  it('deletes through the query contract used by reportes-sql', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: undefined } as never);

    await deleteMeta('version-a', 2026);

    expect(mockedOpenmrsFetch).toHaveBeenCalledWith(
      '/services/reportes-sql/metas?indicador_version_id=version-a&anio=2026',
      { method: 'DELETE' },
    );
  });

  const mutations = [
    ['upsert', () => upsertMeta({ indicador_version_id: 'version-a', anio: 2026, valor_meta: 10 })],
    ['delete', () => deleteMeta('version-a', 2026)],
  ] as const;

  it.each(mutations)('%s rejects 422, 500 and network errors without changing mock data', async (_name, invoke) => {
    for (const error of [
      Object.assign(new Error('invalid meta'), { response: { status: 422 } }),
      Object.assign(new Error('database failed'), { response: { status: 500 } }),
      new TypeError('Failed to fetch'),
    ]) {
      mockedOpenmrsFetch.mockRejectedValueOnce(error);
      await expect(invoke()).rejects.toBe(error);
    }
  });
});
