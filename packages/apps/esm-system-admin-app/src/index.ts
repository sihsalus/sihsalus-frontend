import { defineConfigSchema, getAsyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';
import type { i18n } from 'i18next';

import { configSchema } from './config-schema';

const moduleName = '@sihsalus/esm-system-admin-app';

const options = {
  featureName: 'system-administration',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);

  registerBreadcrumbs([
    {
      path: `${globalThis.spaBase}/system-administration`,
      title: () => Promise.resolve((globalThis.i18next as i18n).t('systemAdmin', 'System Administration')),
      parent: `${globalThis.spaBase}/home`,
    },
  ]);
}

export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const systemAdminAppMenuLink = getAsyncLifecycle(
  () => import('./system-admin-app-menu-link.component'),
  options,
);

export const systemAdminAppMenuItem = getAsyncLifecycle(
  () => import('./system-admin-app-menu-item.component'),
  options,
);

export const legacySystemAdminPageCardLink = getAsyncLifecycle(
  () => import('./dashboard/legacy-admin-page-link.component'),
  options,
);
