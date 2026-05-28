import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import conditionsDetailedSummaryComponent from './conditions/conditions-detailed-summary.component';
import conditionsOverviewComponent from './conditions/conditions-overview.component';
import { configSchema } from './config-schema';
import { dashboardMeta } from './dashboard.meta';

const moduleName = '@sihsalus/esm-patient-conditions-app';

const options = {
  featureName: 'patient-conditions',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const conditionsOverview = getSyncLifecycle(conditionsOverviewComponent, options);

export const conditionsDetailedSummary = getSyncLifecycle(conditionsDetailedSummaryComponent, options);

export const conditionsWidget = getAsyncLifecycle(() => import('./conditions/conditions-widget.component'), options);

export const conditionsDashboardLink =
  // t('Antecedentes', 'Antecedentes')
  getSyncLifecycle(
    createDashboardLink({
      ...dashboardMeta,
      moduleName,
    }),
    options,
  );

export const conditionDeleteConfirmationDialog = getAsyncLifecycle(
  () => import('./conditions/delete-condition.modal'),
  options,
);

// t('recordAntecedent', 'Record antecedent')
export const conditionsFormWorkspace = getAsyncLifecycle(
  () => import('./conditions/conditions-form.workspace'),
  options,
);
