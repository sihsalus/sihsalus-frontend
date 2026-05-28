import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import conditionsDetailedSummaryComponent from './conditions/conditions-detailed-summary.component';
import conditionsOverviewComponent from './conditions/conditions-overview.component';
import { configSchema } from './config-schema';
import { dashboardMeta, proceduresDashboardMeta } from './dashboard.meta';

const moduleName = '@sihsalus/esm-patient-conditions-app';

const options = {
  featureName: 'patient-conditions',
  moduleName,
};

type ConditionsOverviewLifecycleProps = React.ComponentProps<typeof conditionsOverviewComponent>;
type ConditionsDetailedSummaryLifecycleProps = React.ComponentProps<typeof conditionsDetailedSummaryComponent>;

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const conditionsOverview = getSyncLifecycle(conditionsOverviewComponent, options);

export const activeProblemsOverview = getSyncLifecycle(
  (props: ConditionsOverviewLifecycleProps) =>
    React.createElement(conditionsOverviewComponent, { ...props, section: 'active-problems' }),
  options,
);

export const pastDiagnosesOverview = getSyncLifecycle(
  (props: ConditionsOverviewLifecycleProps) =>
    React.createElement(conditionsOverviewComponent, { ...props, section: 'past-diagnoses' }),
  options,
);

export const proceduresOverview = getSyncLifecycle(
  (props: ConditionsOverviewLifecycleProps) =>
    React.createElement(conditionsOverviewComponent, { ...props, section: 'procedures' }),
  options,
);

export const conditionsDetailedSummary = getSyncLifecycle(conditionsDetailedSummaryComponent, options);

export const proceduresDetailedSummary = getSyncLifecycle(
  (props: ConditionsDetailedSummaryLifecycleProps) =>
    React.createElement(conditionsDetailedSummaryComponent, { ...props, section: 'procedures' }),
  options,
);

export const conditionsWidget = getAsyncLifecycle(() => import('./conditions/conditions-widget.component'), options);

export const conditionsDashboardLink =
  // t('Antecedentes y problemas', 'Antecedentes y problemas')
  getSyncLifecycle(
    createDashboardLink({
      ...dashboardMeta,
      moduleName,
    }),
    options,
  );

export const proceduresDashboardLink =
  // t('Procedimientos y cirugías', 'Procedimientos y cirugías')
  getSyncLifecycle(
    createDashboardLink({
      ...proceduresDashboardMeta,
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
