import { defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';

import AppMenuLink from './app-menu-link.component';
import { configSchema } from './config-schema';
import { featureName, moduleName } from './constants';
import Root from './root.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const options = {
  featureName,
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getSyncLifecycle(Root, options);

export const templateAppMenuLink = getSyncLifecycle(AppMenuLink, options);
