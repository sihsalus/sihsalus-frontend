import { getConfig } from '@openmrs/esm-framework';

import type { ConfigObject } from '../config-schema';

const moduleName = '@sihsalus/esm-indicadores-app';

const defaultReportesSqlApiPath = '/services/reportes-sql';

export async function getReportesSqlApiPath(): Promise<string> {
  const config = (await getConfig(moduleName)) as ConfigObject | undefined;
  return config?.reportesSqlApiPath?.replace(/\/+$/, '') || defaultReportesSqlApiPath;
}

export async function isDemoDataEnabled(): Promise<boolean> {
  const config = (await getConfig(moduleName)) as ConfigObject | undefined;
  return config?.enableDemoData === true;
}

export async function getReportesSqlResourcePath(resource: string): Promise<string> {
  const base = await getReportesSqlApiPath();
  return `${base}/${resource}`;
}
