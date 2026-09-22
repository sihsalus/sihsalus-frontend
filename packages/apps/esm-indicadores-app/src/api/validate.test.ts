import { describe, expect, it } from 'vitest';

import { assertShape, isIndicadorDetail, isPaginatedResponse, isSeriesResponse, isSQLPreview } from './validate';

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
