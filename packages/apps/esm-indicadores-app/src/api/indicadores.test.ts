import { getConfig, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createIndicador,
  createVersion,
  deleteIndicador,
  getEncounterTypes,
  getIndicador,
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
    expect(mockedOpenmrsFetch).toHaveBeenCalledWith('/services/reportes-sql/indicadores/?page=1&size=20', {
      rejectOnAuthFailure: true,
    });
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
      rejectOnAuthFailure: true,
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

  describe('getIndicador detail shape validation', () => {
    const validDetail = {
      id: 'indicator-a',
      nombre: 'Indicador A',
      descripcion: 'desc',
      activo: true,
      creado_en: '2026-01-01',
      versiones: [
        {
          id: 'ver-a',
          indicador_id: 'indicator-a',
          version: 1,
          creado_en: '2026-01-01',
          definicion: { tipo: 'conteo_atenciones' },
        },
      ],
    };

    it('resolves when the detail envelope conforms to the contract', async () => {
      mockedOpenmrsFetch.mockResolvedValue({ data: validDetail } as never);

      await expect(getIndicador('indicator-a')).resolves.toEqual(validDetail);
      expect(mockedOpenmrsFetch).toHaveBeenCalledWith('/services/reportes-sql/indicadores/indicator-a', {
        rejectOnAuthFailure: true,
      });
    });

    it('accepts a null descripcion in the detail envelope', async () => {
      const withNull = { ...validDetail, descripcion: null };
      mockedOpenmrsFetch.mockResolvedValue({ data: withNull } as never);

      await expect(getIndicador('indicator-a')).resolves.toEqual(withNull);
    });

    it('throws a contract error when the detail envelope is malformed (activo missing)', async () => {
      const { activo: _activo, ...malformed } = validDetail;
      mockedOpenmrsFetch.mockResolvedValue({ data: malformed } as never);

      await expect(getIndicador('indicator-a')).rejects.toThrow(
        /reportes-sql devolvió una respuesta inesperada para indicadores\/indicator-a\./,
      );
    });

    it('throws a contract error when a version is missing its definicion record', async () => {
      const malformed = {
        ...validDetail,
        versiones: [{ ...validDetail.versiones[0], definicion: undefined }],
      };
      mockedOpenmrsFetch.mockResolvedValue({ data: malformed } as never);

      await expect(getIndicador('indicator-a')).rejects.toThrow(
        /reportes-sql devolvió una respuesta inesperada para indicadores\/indicator-a\./,
      );
    });

    it('throws a contract error when versiones is not an array', async () => {
      const malformed = { ...validDetail, versiones: { oops: true } };
      mockedOpenmrsFetch.mockResolvedValue({ data: malformed } as never);

      await expect(getIndicador('indicator-a')).rejects.toThrow(/indicadores\/indicator-a/);
    });
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

describe('getEncounterTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
      enableDemoData: false,
    });
  });

  it('fetches the full encounter-type list without a query param', async () => {
    const data = [
      { uuid: 'enc-cred', display: 'CRED Neonato' },
      { uuid: 'enc-control', display: 'Control de niño sano' },
    ];
    mockedOpenmrsFetch.mockResolvedValue({ data } as never);

    await expect(getEncounterTypes()).resolves.toEqual(data);
    expect(mockedOpenmrsFetch).toHaveBeenCalledWith('/services/reportes-sql/conceptos/encounter-types', {
      rejectOnAuthFailure: true,
    });
  });

  it('fails closed on network errors when demo data is disabled', async () => {
    const error = new TypeError('Failed to fetch');
    mockedOpenmrsFetch.mockRejectedValue(error);

    await expect(getEncounterTypes()).rejects.toBe(error);
  });

  it('returns the full example list on network errors only when demo data is enabled', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
      enableDemoData: true,
    });
    mockedOpenmrsFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await getEncounterTypes();

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => typeof item.uuid === 'string' && typeof item.display === 'string')).toBe(true);
  });
});
