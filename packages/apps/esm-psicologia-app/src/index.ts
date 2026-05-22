import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib/src/dashboards/createDashboardLink';

import { configSchema } from './config-schema';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-psicologia-app';

const psicologiaDashboardMeta = {
  slot: 'patient-chart-psicologia-dashboard-slot',
  columns: 1,
  title: 'psicologia',
  path: 'psicologia',
  icon: 'omrs-icon-user-follow',
  isLink: true,
};

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const psicologiaDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...psicologiaDashboardMeta, moduleName }),
  {
    featureName: 'psicologia-dashboard-link',
    moduleName,
  },
);

export const psicologiaDashboard = getAsyncLifecycle(() => import('./dashboard/psychology-dashboard.component'), {
  featureName: 'psicologia-dashboard',
  moduleName,
});
