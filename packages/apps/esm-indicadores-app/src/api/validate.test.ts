import { describe, expect, it } from 'vitest';

import {
  assertShape,
  isCalcularNowResponse,
  isIdentifiedResource,
  isIndicadorDetail,
  isIndicadorMeta,
  isIndicadorResultado,
  isOptionList,
  isPaginatedResponse,
  isRecalcularAnioResponse,
  isSerieRow,
  isSeriesResponse,
  isSQLPreview,
  isStringRecord,
} from './validate';

describe('isPaginatedResponse', () => {
  const valid = { items: [], total: 0, page: 1, size: 20, pages: 1 };

  it('accepts a well-formed paginated envelope', () => {
    expect(isPaginatedResponse(valid)).toBe(true);
  });

  it('accepts an envelope with extra non-strict fields', () => {
    expect(isPaginatedResponse({ ...valid, links: ['/self'] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not-a-paginated-response'],
    ['an array', []],
    ['a number', 42],
    ['an object without items', { total: 0, page: 1, size: 1, pages: 1 }],
    ['items not an array', { ...valid, items: { oops: true } }],
    ['total not a number', { ...valid, total: '0' }],
    ['page not a number', { ...valid, page: '1' }],
    ['size not a number', { ...valid, size: '20' }],
    ['pages not a number', { ...valid, pages: '1' }],
  ])('rejects %s', (_name, value) => {
    expect(isPaginatedResponse(value)).toBe(false);
  });
});

describe('isSeriesResponse', () => {
  const valid = { items: [], indicador_id: 'ind-001', anio: 2026, granularity: 'mensual' };

  it('accepts a well-formed series envelope', () => {
    expect(isSeriesResponse(valid)).toBe(true);
  });

  it('accepts an envelope with extra fields', () => {
    expect(isSeriesResponse({ ...valid, version_id: 'ver-2' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['no items', { indicador_id: 'ind-001', anio: 2026, granularity: 'mensual' }],
    ['items not an array', { ...valid, items: 'x' }],
    ['indicador_id not a string', { ...valid, indicador_id: 1 }],
    ['anio not a number', { ...valid, anio: '2026' }],
    ['granularity not a string', { ...valid, granularity: 3 }],
  ])('rejects %s', (_name, value) => {
    expect(isSeriesResponse(value)).toBe(false);
  });
});

describe('isSQLPreview', () => {
  const valid = {
    sql: 'SELECT 1',
    params: { anio: 2026 },
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-12-31',
    version_id: 'ver-1',
    version_num: 1,
  };

  it('accepts a well-formed SQL preview envelope', () => {
    expect(isSQLPreview(valid)).toBe(true);
  });

  it('accepts an envelope with extra fields', () => {
    expect(isSQLPreview({ ...valid, indicador_id: 'ind-1' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['no sql', { ...valid, sql: undefined }],
    ['sql not a string', { ...valid, sql: 42 }],
    ['params not a record', { ...valid, params: [] }],
    ['params null', { ...valid, params: null }],
    ['periodo_inicio not a string', { ...valid, periodo_inicio: 20260101 }],
    ['periodo_fin not a string', { ...valid, periodo_fin: 20261231 }],
    ['version_id not a string', { ...valid, version_id: 1 }],
    ['version_num not a number', { ...valid, version_num: '1' }],
  ])('rejects %s', (_name, value) => {
    expect(isSQLPreview(value)).toBe(false);
  });
});

describe('isIndicadorDetail', () => {
  const validVersion = {
    id: 'ver-1',
    indicador_id: 'ind-1',
    version: 1,
    creado_en: '2026-01-01',
    definicion: { tipo: 'conteo_atenciones' },
  };
  const valid = {
    id: 'ind-1',
    nombre: 'Indicador',
    descripcion: 'desc',
    activo: true,
    creado_en: '2026-01-01',
    versiones: [validVersion],
  };

  it('accepts a well-formed indicator detail', () => {
    expect(isIndicadorDetail(valid)).toBe(true);
  });

  it('accepts a detail with null descripcion', () => {
    expect(isIndicadorDetail({ ...valid, descripcion: null })).toBe(true);
  });

  it('accepts extra non-strict fields', () => {
    expect(isIndicadorDetail({ ...valid, links: ['/self'] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['id not a string', { ...valid, id: 1 }],
    ['nombre not a string', { ...valid, nombre: 2 }],
    ['descripcion not string|null', { ...valid, descripcion: 3 }],
    ['activo not a boolean', { ...valid, activo: 'true' }],
    ['creado_en not a string', { ...valid, creado_en: 20260101 }],
    ['versiones not an array', { ...valid, versiones: { oops: true } }],
    ['version missing id', { ...valid, versiones: [{ ...validVersion, id: undefined }] }],
    ['version indicador_id not a string', { ...valid, versiones: [{ ...validVersion, indicador_id: 1 }] }],
    ['version not a number', { ...valid, versiones: [{ ...validVersion, version: '1' }] }],
    ['version creado_en not a string', { ...valid, versiones: [{ ...validVersion, creado_en: 1 }] }],
    ['version definicion not a record', { ...valid, versiones: [{ ...validVersion, definicion: [] }] }],
  ])('rejects %s', (_name, value) => {
    expect(isIndicadorDetail(value)).toBe(false);
  });
});

describe('assertShape', () => {
  it('returns the value unchanged when the guard accepts it', () => {
    const accepted = { items: [], total: 0, page: 1, size: 1, pages: 1 };
    const result = assertShape(accepted, isPaginatedResponse, 'GET /indicadores');
    expect(result).toBe(accepted);
  });

  it('throws a named contract error pointing at the resource when the guard rejects', () => {
    const invalid = { items: 'not-an-array', total: 0, page: 1, size: 1, pages: 1 };
    expect(() => assertShape(invalid, isPaginatedResponse, 'GET /indicadores')).toThrow(
      /reportes-sql devolvió una respuesta inesperada para GET \/indicadores\./,
    );
  });

  it('includes the resource name in the message so contract drift surfaces clearly', () => {
    expect(() => assertShape(null, isSeriesResponse, 'GET /resultados/series')).toThrow(/GET \/resultados\/series/);
  });
});

describe('isIndicadorResultado', () => {
  const valid = {
    id: 'res-1',
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-01-31',
    valor: 12,
    calculado_en: '2026-02-01T00:00:00.000Z',
  };

  it('accepts a well-formed resultado row', () => {
    expect(isIndicadorResultado(valid)).toBe(true);
  });

  it.each([
    ['valor as string', { ...valid, valor: '12' }],
    ['valor as NaN-shaped string', { ...valid, valor: 'NaN' }],
    ['missing calculado_en', { ...valid, calculado_en: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isIndicadorResultado(value)).toBe(false);
  });
});

describe('isSerieRow', () => {
  const valid = { periodo_label: '2026-01', valor: 10, meses_disponibles: 1, anio: 2026 };

  it('accepts a well-formed series row', () => {
    expect(isSerieRow(valid)).toBe(true);
  });

  it.each([
    ['valor as string', { ...valid, valor: '10' }],
    ['missing periodo_label', { ...valid, periodo_label: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isSerieRow(value)).toBe(false);
  });
});

describe('isIndicadorMeta', () => {
  const valid = {
    id: 'meta-1',
    indicador_version_id: 'ver-1',
    anio: 2026,
    valor_meta: 100,
    creado_en: '2026-01-01',
  };

  it('accepts a well-formed meta record', () => {
    expect(isIndicadorMeta(valid)).toBe(true);
  });

  it.each([
    ['valor_meta as string', { ...valid, valor_meta: '100' }],
    ['anio as string', { ...valid, anio: '2026' }],
  ])('rejects %s', (_name, value) => {
    expect(isIndicadorMeta(value)).toBe(false);
  });
});

describe('isIdentifiedResource', () => {
  it('accepts a payload carrying the id the UI navigates with', () => {
    expect(isIdentifiedResource({ id: 'indicator-a' })).toBe(true);
    expect(isIdentifiedResource({ id: 'indicator-a', activo: true, definicion: { tipo: 'x' } })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a bare string', 'indicator-a'],
    ['missing id', { nombre: 'sin id' }],
    ['id not a string', { id: 42 }],
  ])('rejects %s', (_name, value) => {
    expect(isIdentifiedResource(value)).toBe(false);
  });
});

describe('isOptionList', () => {
  const valid = [
    { uuid: 'loc-1', display: 'Centro' },
    { uuid: 'loc-2', nombre: 'Hospital' },
  ];

  it('accepts a list of uuid-bearing options', () => {
    expect(isOptionList(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an object', { uuid: 'loc-1' }],
    ['an item without uuid', [{ display: 'sin uuid' }]],
    ['a non-string uuid', [{ uuid: 7 }]],
    ['a nested non-record', ['loc-1']],
  ])('rejects %s', (_name, value) => {
    expect(isOptionList(value)).toBe(false);
  });
});

describe('isStringRecord', () => {
  it('accepts a uuid → name resolution map', () => {
    expect(isStringRecord({ 'order-a': 'Hemograma', 'order-b': 'Ferritina' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', ['a']],
    ['a non-string value', { 'order-a': 3 }],
  ])('rejects %s', (_name, value) => {
    expect(isStringRecord(value)).toBe(false);
  });
});

describe('isCalcularNowResponse', () => {
  const valid = { calculados: 3, errores: [], total: 3 };

  it('accepts a well-formed calcular-ahora envelope', () => {
    expect(isCalcularNowResponse(valid)).toBe(true);
  });

  it.each([
    ['missing total', { calculados: 1, errores: [] }],
    ['missing calculados', { errores: [], total: 1 }],
    ['errores not an array', { ...valid, errores: 'none' }],
    ['calculados not a number', { ...valid, calculados: '3' }],
  ])('rejects %s', (_name, value) => {
    expect(isCalcularNowResponse(value)).toBe(false);
  });
});

describe('isRecalcularAnioResponse', () => {
  const valid = {
    anio: 2026,
    indicador_id: null,
    meses_procesados: 12,
    indicadores_considerados: 2,
    recalculados: 24,
    errores: [],
    total: 24,
  };

  it('accepts a well-formed recalcular-anio envelope', () => {
    expect(isRecalcularAnioResponse(valid)).toBe(true);
  });

  it('accepts a scoped recalculation with a string indicador_id', () => {
    expect(isRecalcularAnioResponse({ ...valid, indicador_id: 'ind-001' })).toBe(true);
  });

  it.each([
    ['missing meses_procesados', { ...valid, meses_procesados: undefined }],
    ['indicador_id neither string nor null', { ...valid, indicador_id: 7 }],
    ['recalculados not a number', { ...valid, recalculados: '24' }],
    ['errores not an array', { ...valid, errores: {} }],
    ['anio not a number', { ...valid, anio: '2026' }],
  ])('rejects %s', (_name, value) => {
    expect(isRecalcularAnioResponse(value)).toBe(false);
  });
});
