import { defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';

import { configSchema } from './config-schema';
import RootComponent from './root.component';

const moduleName = '@sihsalus/esm-coststructure-app';

const options = {
  featureName: 'cost-structure',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getSyncLifecycle(RootComponent, options);
