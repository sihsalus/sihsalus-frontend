import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import { FormsSelectorWorkspace } from '@sihsalus/esm-sihsalus-shared';

import ClinicalEncounterDashboard from './clinical-encounter/dashboard/clinical-encounter-dashboard.component';
import { configSchema } from './config-schema';
import ConsultaExternaDashboard from './consulta-externa/consulta-externa-dashboard.component';
import { consultaExternaDashboardMeta, socialHistoryDashboardMeta } from './dashboard.meta';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-atencion-ambulatoria-app';
const options = {
  featureName: 'patient-clinical-view-app',
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// CLINICAL ENCOUNTERS EXPORTS
// ================================================================================
export const inPatientClinicalEncounter = getSyncLifecycle(ClinicalEncounterDashboard, options);

// ================================================================================
// ASYNC COMPONENTS
// ================================================================================
export const monthlyAppointmentFilterCalendar = getAsyncLifecycle(
  () => import('./ui/appointment-filter-calendar/appointment-filter-calendar'),
  options,
);
export const conditionsFilterWorkspace = getAsyncLifecycle(
  () => import('./ui/conditions-filter/conditions-form.workspace'),
  options,
);
export const conditionFilterDeleteConfirmationDialog = getAsyncLifecycle(
  () => import('./ui/conditions-filter/delete-condition.modal'),
  options,
);
export const genericConditionsOverview = getAsyncLifecycle(
  () => import('./ui/conditions-filter/generic-conditions-overview.component'),
  options,
);

// ================================================================================
// CONSULTA EXTERNA EXPORTS
// ================================================================================
export const consultaExternaDashboard = getSyncLifecycle(ConsultaExternaDashboard, options);
// t('consultaExternaTooltip', 'Consulta externa')
export const consultaExternaDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...consultaExternaDashboardMeta, moduleName }),
  options,
);

// ================================================================================
// SOCIAL HISTORY EXPORTS
// ================================================================================
// t('socialHistoryTooltip', 'Historia social')
export const socialHistoryDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...socialHistoryDashboardMeta, moduleName }),
  options,
);

// ================================================================================
// FORMS SELECTOR (GENERIC WORKSPACE)
// ================================================================================
export const formsSelectorWorkspace = getSyncLifecycle(FormsSelectorWorkspace, options);
