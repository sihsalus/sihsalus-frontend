import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';

import { configSchema } from './config-schema';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-odontologia-app';

const odontologiaDashboardMeta = {
  slot: 'patient-chart-odontologia-slot',
  columns: 1,
  title: 'Atención odontológica',
  path: 'atencion-odontologica',
  icon: 'omrs-icon-procedure-order',
  isLink: true,
};

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

// Standalone dev page
export const root = getAsyncLifecycle(() => import('./root.component'), {
  featureName: 'odontologia-root',
  moduleName,
});

export const odontologiaDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...odontologiaDashboardMeta, moduleName }),
  {
    featureName: 'odontologia-dashboard-link',
    moduleName,
  },
);

export const odontologiaDashboard = getAsyncLifecycle(
  () => import('./odontologia-dashboard/odontologia-dashboard.component'),
  {
    featureName: 'odontologia-dashboard',
    moduleName,
  },
);

export const odontologiaOdontogramWorkspace = getAsyncLifecycle(
  () => import('./odontogram-workspace/odontogram-workspace.component'),
  {
    featureName: 'odontologia-odontogram-form-workspace',
    moduleName,
  },
);
