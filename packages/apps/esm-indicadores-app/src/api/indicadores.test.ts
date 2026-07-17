import { getConfig, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createIndicador,
  createVersion,
  deleteIndicador,
  getIndicadores,
  resolveOrdenes,
  updateIndicador,
} from './indicadores';
import type { DefinicionIndicadorForm } from './types';

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockedGetConfig = vi.mocked(getConfig);

const definicion: DefinicionIndicadorForm = {
  tipo: 'conteo_atenciones',
  evento: {
    ordenes: [{ concepto_uuid: 'order-a' }, { concepto_uuid: 'order-b' }],
  },
};

const createPayload = {
  nombre: 'Indicador de órdenes',
  descripcion: null,
  definicion,
};

describe('indicadores API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
      enableDemoData: false,
    });
  });

  it('uses the paginated metadata-only list contract', async () => {
    const response = {
      items: [
        {
          id: 'indicator-a',
          nombre: 'Indicador A',
          descripcion: null,
          activo: true,
          creado_en: '2026-01-01',
        },
      ],
      total: 1,
      page: 1,
      size: 20,
      pages: 1,
    };
    mockedOpenmrsFetch.mockResolvedValue({ data: response } as never);

    await expect(getIndicadores(1, 20)).resolves.toEqual(response);
    expect(mockedOpenmrsFetch).toHaveBeenCalledWith('/services/reportes-sql/indicadores/?page=1&size=20', undefined);
  });

  it('sends the canonical order payload on create', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: { id: 'indicator-a', ...createPayload, activo: true } } as never);

    await createIndicador(createPayload);

    expect(mockedOpenmrsFetch).toHaveBeenCalledWith(
      '/services/reportes-sql/indicadores/',
      expect.objectContaining({ method: 'POST', body: createPayload }),
    );
    expect((mockedOpenmrsFetch.mock.calls[0][1]?.body as typeof createPayload).definicion.evento?.ordenes).toEqual([
      { concepto_uuid: 'order-a' },
      { concepto_uuid: 'order-b' },
    ]);
  });

  it('updates only supported metadata fields', async () => {
    const payload = { nombre: 'Actualizado', descripcion: 'Descripción' };
    mockedOpenmrsFetch.mockResolvedValue({ data: { id: 'indicator-a', ...payload } } as never);

    await updateIndicador('indicator-a', payload);

    expect(mockedOpenmrsFetch).toHaveBeenCalledWith(
      '/services/reportes-sql/indicadores/indicator-a',
      expect.objectContaining({ method: 'PUT', body: payload }),
    );
    expect(mockedOpenmrsFetch.mock.calls[0][1]?.body).not.toHaveProperty('activo');
  });

  it('uses the real DELETE endpoint to deactivate an indicator', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: undefined } as never);

    await deleteIndicador('indicator-a');

    expect(mockedOpenmrsFetch).toHaveBeenCalledWith('/services/reportes-sql/indicadores/indicator-a', {
      method: 'DELETE',
    });
  });

  it('uses the real POST endpoint to create an immutable version', async () => {
    mockedOpenmrsFetch.mockResolvedValue({ data: { id: 'version-b' } } as never);

    await createVersion('indicator-a', definicion);

    expect(mockedOpenmrsFetch).toHaveBeenCalledWith(
      '/services/reportes-sql/indicadores/indicator-a/versiones',
      expect.objectContaining({ method: 'POST', body: { definicion } }),
    );
  });

  const mutations = [
    ['create', () => createIndicador(createPayload)],
    ['update', () => updateIndicador('indicator-a', { nombre: 'A', descripcion: null })],
    ['delete', () => deleteIndicador('indicator-a')],
    ['createVersion', () => createVersion('indicator-a', definicion)],
  ] as const;

  it.each(mutations)('%s rejects 422, 500 and network failures without a mock result', async (_name, invoke) => {
    for (const error of [
      Object.assign(new Error('validation details'), { response: { status: 422 } }),
      Object.assign(new Error('database details'), { response: { status: 500 } }),
      new TypeError('Failed to fetch'),
    ]) {
      mockedOpenmrsFetch.mockRejectedValueOnce(error);
      await expect(invoke()).rejects.toBe(error);
    }
  });
});

describe('resolveOrdenes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
      enableDemoData: false,
    });
  });

  it('returns an empty record without calling the backend for empty input', async () => {
    await expect(resolveOrdenes([])).resolves.toEqual({});
    expect(mockedOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('returns the backend resolution map', async () => {
    const data = { 'order-a': 'Hemograma', 'order-b': 'Ferritina sérica' };
    mockedOpenmrsFetch.mockResolvedValue({ data } as never);

    await expect(resolveOrdenes(['order-a', 'order-b'])).resolves.toEqual(data);
  });

  it('fails closed on network errors when demo data is disabled', async () => {
    const error = new TypeError('Failed to fetch');
    mockedOpenmrsFetch.mockRejectedValue(error);

    await expect(resolveOrdenes(['order-a'])).rejects.toBe(error);
  });

  it('uses examples on network errors only when demo data is explicitly enabled', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
      enableDemoData: true,
    });
    mockedOpenmrsFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(resolveOrdenes(['ord-hemograma', 'unknown'])).resolves.toEqual({
      'ord-hemograma': 'Hemograma',
    });
  });
});
