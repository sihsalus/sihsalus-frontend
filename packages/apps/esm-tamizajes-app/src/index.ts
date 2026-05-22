import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib/src/dashboards/createDashboardLink';

import { configSchema } from './config-schema';
import { createLeftPanelLink } from './left-panel-link.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-tamizajes-app';

const tamizajesDashboardMeta = {
  slot: 'patient-chart-tamizajes-dashboard-slot',
  columns: 1,
  title: 'Tamizajes',
  path: 'tamizajes',
  icon: 'omrs-icon-lab-order',
  isLink: true,
};

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const tamizajesHomeLink = getSyncLifecycle(
  createLeftPanelLink({
    name: 'tamizajes',
    title: 'tamizajes',
  }),
  {
    featureName: 'tamizajes-home-link',
    moduleName,
  },
);

export const root = getAsyncLifecycle(() => import('./home.component'), {
  featureName: 'tamizajes-home',
  moduleName,
});

export const tamizajesDashboardLink = getSyncLifecycle(createDashboardLink({ ...tamizajesDashboardMeta, moduleName }), {
  featureName: 'tamizajes-dashboard-link',
  moduleName,
});

export const tamizajesDashboard = getAsyncLifecycle(
  () => import('./hiv-testing-services/views/hiv-testing/hiv-testing-services.component'),
  {
    featureName: 'tamizajes-dashboard',
    moduleName,
  },
);
