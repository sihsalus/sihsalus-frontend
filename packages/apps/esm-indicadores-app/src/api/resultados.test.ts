import { openmrsFetch } from '@openmrs/esm-framework';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReportesSqlApiPath } from './config';
import { getIndicadores, previewSql } from './indicadores';
import { calcularAhora, getResultados } from './resultados';

vi.mock('./config');

const mockedOpenmrsFetch = vi.mocked(openmrsFetch);
const mockedGetReportesSqlApiPath = vi.mocked(getReportesSqlApiPath);

describe('previewSql routing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls openmrsFetch with /services/reportes-sql/indicadores/{id}/preview-sql', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { sql: 'SELECT 1', params: {}, periodo_inicio: '', periodo_fin: '', version_id: '', version_num: 1 },
    } as any);

    await previewSql('ind-abc');

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/services/reportes-sql/indicadores/ind-abc/preview-sql');
  });

  it('appends versionId as query param when provided', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { sql: 'SELECT 1', params: {}, periodo_inicio: '', periodo_fin: '', version_id: '', version_num: 1 },
    } as any);

    await previewSql('ind-abc', 'v2');

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('versionId=v2');
  });

  it('does NOT use indicatorsApiPath for previewSql', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { sql: 'SELECT 1', params: {}, periodo_inicio: '', periodo_fin: '', version_id: '', version_num: 1 },
    } as any);

    await previewSql('ind-abc');

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('/ws/module/indicators/api');
  });
});

describe('getResultados routing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls openmrsFetch with a URL starting with /services/reportes-sql', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    } as any);

    await getResultados({ page: 1, size: 10 });

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^\/services\/reportes-sql\/resultados\//);
  });

  it('includes query parameters in the URL', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    } as any);

    await getResultados({ page: 2, size: 25, indicador_id: 'ind-1' });

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('size=25');
    expect(calledUrl).toContain('indicador_id=ind-1');
  });

  it('does NOT use indicatorsApiPath for getResultados', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    } as any);

    await getResultados({ page: 1, size: 10 });

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('/ws/module/indicators/api');
  });
});

describe('calcularAhora routing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls openmrsFetch with /services/reportes-sql/resultados/calcular-ahora', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { calculados: 3, errores: [], total: 3 },
    } as any);

    await calcularAhora();

    const calledUrl = mockedOpenmrsFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/services/reportes-sql/resultados/calcular-ahora');
  });

  it('uses POST method', async () => {
    mockedGetReportesSqlApiPath.mockResolvedValue('/services/reportes-sql');
    mockedOpenmrsFetch.mockResolvedValue({
      data: { calculados: 0, errores: [], total: 0 },
    } as any);

    await calcularAhora();

    const fetchOptions = mockedOpenmrsFetch.mock.calls[0][1];
    expect(fetchOptions).toBeDefined();
    expect(fetchOptions?.method).toBe('POST');
  });
});

describe('regression: existing API flows remain on indicatorsApiPath', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getIndicadores does NOT route through reportes-sql base', async () => {
    mockedOpenmrsFetch.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    } as any);

    await getIndicadores(1, 10);

    const calledUrl = mockedOpenmrsFetch.mock.calls[0]?.[0] as string | undefined;
    expect(calledUrl).toBeDefined();
    expect(calledUrl).not.toContain('/services/reportes-sql');
  });
});
