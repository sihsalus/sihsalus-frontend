import { getConfig } from '@openmrs/esm-framework';
import { describe, expect, it, vi } from 'vitest';

import { getReportesSqlApiPath, getReportesSqlResourcePath } from './config';

const mockedGetConfig = vi.mocked(getConfig);

describe('getReportesSqlApiPath', () => {
  it('returns default /services/reportes-sql when no config override exists', async () => {
    mockedGetConfig.mockResolvedValue({});

    const result = await getReportesSqlApiPath();

    expect(result).toBe('/services/reportes-sql');
  });

  it('returns default when config is undefined', async () => {
    mockedGetConfig.mockResolvedValue(undefined);

    const result = await getReportesSqlApiPath();

    expect(result).toBe('/services/reportes-sql');
  });

  it('returns custom reportesSqlApiPath from config', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: 'http://reportes-sql.internal:8080',
    });

    const result = await getReportesSqlApiPath();

    expect(result).toBe('http://reportes-sql.internal:8080');
  });

  it('strips trailing slashes from the configured path', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql///',
    });

    const result = await getReportesSqlApiPath();

    expect(result).toBe('/services/reportes-sql');
  });

  it('preserves absolute URLs as-is', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: 'http://reportes-sql.internal:8080',
    });

    const result = await getReportesSqlApiPath();

    expect(result).toBe('http://reportes-sql.internal:8080');
  });

  it('does not prepend /openmrs before returning the path', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
    });

    const result = await getReportesSqlApiPath();

    // openmrsFetch will handle the /openmrs prefix; the resolver must not add it.
    expect(result).not.toContain('/openmrs');
  });
});

describe('getReportesSqlResourcePath', () => {
  it('appends a resource path to the reportes-sql base', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
    });

    const result = await getReportesSqlResourcePath('indicadores/abc/preview-sql');

    expect(result).toBe('/services/reportes-sql/indicadores/abc/preview-sql');
  });

  it('avoids double slash when base has no trailing slash', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql',
    });

    const result = await getReportesSqlResourcePath('resultados/');

    expect(result).toBe('/services/reportes-sql/resultados/');
  });

  it('avoids double slash when base had trailing slashes (already stripped)', async () => {
    mockedGetConfig.mockResolvedValue({
      reportesSqlApiPath: '/services/reportes-sql///',
    });

    const result = await getReportesSqlResourcePath('resultados/');

    expect(result).toBe('/services/reportes-sql/resultados/');
  });
});
