import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib/src/dashboards/createDashboardLink';

import { configSchema } from './config-schema';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-terapia-fisica-app';

const terapiaFisicaDashboardMeta = {
  slot: 'patient-chart-terapia-fisica-dashboard-slot',
  columns: 1,
  title: 'Terapia Física',
  path: 'terapia-fisica',
  icon: 'omrs-icon-movement',
  isLink: true,
};

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const terapiaFisicaDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...terapiaFisicaDashboardMeta, moduleName }),
  {
    featureName: 'terapia-fisica-dashboard-link',
    moduleName,
  },
);

export const terapiaFisicaDashboard = getAsyncLifecycle(
  () => import('./dashboard/physical-therapy-dashboard.component'),
  {
    featureName: 'terapia-fisica-dashboard',
    moduleName,
  },
);
