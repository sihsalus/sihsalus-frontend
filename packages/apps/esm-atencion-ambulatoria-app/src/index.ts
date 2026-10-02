import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink, FormsSelectorWorkspace } from '@openmrs/esm-patient-common-lib';

import AntecedentsDashboardLink from './consulta-externa/antecedents-dashboard-link.component';
import ConsultaExternaAntecedents from './consulta-externa/consulta-externa-antecedents.component';
import ClinicalEncounterDashboard from './clinical-encounter/dashboard/clinical-encounter-dashboard.component';
import { configSchema } from './config-schema';
import ConsultaExternaDashboard from './consulta-externa/consulta-externa-dashboard.component';
import { consultaExternaDashboardMeta } from './dashboard.meta';

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
// ================================================================================
// CONSULTA EXTERNA EXPORTS
// ================================================================================
export const consultaExternaDashboard = getSyncLifecycle(ConsultaExternaDashboard, options);
export const historicalOutpatientDocuments = getAsyncLifecycle(
  () => import('./consulta-externa/historical-outpatient-documents.component'),
  options,
);
export const institutionalReferralWorkspace = getAsyncLifecycle(
  () => import('./consulta-externa/institutional-referral-form.workspace'),
  options,
);
export const outpatientMissingDocumentDataModal = getAsyncLifecycle(
  () => import('./consulta-externa/outpatient-missing-document-data.modal'),
  options,
);
// t('consultaExternaTooltip', 'Consulta externa')
export const consultaExternaDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...consultaExternaDashboardMeta, moduleName }),
  options,
);

// ================================================================================
// SOCIAL HISTORY EXPORTS
// ================================================================================
// t('antecedents', 'Antecedents')
export const socialHistoryDashboardLink = getSyncLifecycle(AntecedentsDashboardLink, options);
export const antecedentsDashboard = getSyncLifecycle(ConsultaExternaAntecedents, options);
// ================================================================================
// FORMS SELECTOR (GENERIC WORKSPACE)
// ================================================================================
export const formsSelectorWorkspace = getSyncLifecycle(FormsSelectorWorkspace, options);
