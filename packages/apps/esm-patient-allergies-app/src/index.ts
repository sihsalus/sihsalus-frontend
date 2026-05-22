import {
  defineConfigSchema,
  fhirBaseUrl,
  getAsyncLifecycle,
  getSyncLifecycle,
  messageOmrsServiceWorker,
  restBaseUrl,
} from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib/src/dashboards/createDashboardLink';
import allergiesDetailedSummaryComponent from './allergies/allergies-detailed-summary.component';
import allergiesListExtension from './allergies/allergies-list.extension';
import allergiesTileExtension from './allergies/allergies-tile.extension';
import { configSchema } from './config-schema';
import { dashboardMeta } from './dashboard.meta';

const moduleName = '@sihsalus/esm-patient-allergies-app';

const options = {
  featureName: 'patient-allergies',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  void messageOmrsServiceWorker({
    type: 'registerDynamicRoute',
    pattern: `.+${restBaseUrl}/concept.+`,
  });

  void messageOmrsServiceWorker({
    type: 'registerDynamicRoute',
    pattern: `.+${restBaseUrl}/patient/.+/allergy.+`,
  });

  void messageOmrsServiceWorker({
    type: 'registerDynamicRoute',
    pattern: `.+${fhirBaseUrl}/AllergyIntolerance.+`,
  });

  defineConfigSchema(moduleName, configSchema);
}

export const allergiesDetailedSummary = getSyncLifecycle(allergiesDetailedSummaryComponent, options);

// t('Allergies', 'Allergies')
export const allergiesDashboardLink = getSyncLifecycle(
  createDashboardLink({
    ...dashboardMeta,
    moduleName,
  }),
  options,
);

export const allergyFormWorkspace = getAsyncLifecycle(
  () => import('./allergies/allergies-form/allergy-form.workspace'),
  options,
);

export const allergiesTile = getSyncLifecycle(allergiesTileExtension, options);

export const allergiesList = getSyncLifecycle(allergiesListExtension, options);

export const deleteAllergyModal = getAsyncLifecycle(() => import('./allergies/delete-allergy.modal'), options);
