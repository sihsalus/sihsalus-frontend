import { getConfig } from '@openmrs/esm-framework';

import type { Config } from '../config-schema';

const moduleName = '@sihsalus/esm-indicadores-app';
const defaultApiPath = '/ws/module/indicators/api';

export async function getIndicatorsApiPath() {
  const config = (await getConfig(moduleName)) as Config | undefined;
  return config?.indicatorsApiPath?.replace(/\/+$/, '') || defaultApiPath;
}

export async function getIndicadoresResourcePath() {
  const apiPath = await getIndicatorsApiPath();
  return `${apiPath}/indicadores`;
}

export async function getResultadosResourcePath() {
  const apiPath = await getIndicatorsApiPath();
  return `${apiPath}/resultados`;
}

export async function getConceptosResourcePath() {
  const apiPath = await getIndicatorsApiPath();
  return `${apiPath}/conceptos`;
}
