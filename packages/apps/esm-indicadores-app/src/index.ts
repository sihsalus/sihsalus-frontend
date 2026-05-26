import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';

import { configSchema } from './config-schema';
import RootComponent from './root.component';

const moduleName = '@sihsalus/esm-indicadores-app';
const options = { featureName: 'indicators', moduleName };

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getSyncLifecycle(RootComponent, options);

export const indicadoresAppMenuItem = getAsyncLifecycle(() => import('./indicadores-app-menu-item.component'), options);
