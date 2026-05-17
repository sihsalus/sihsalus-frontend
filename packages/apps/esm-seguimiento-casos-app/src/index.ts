import { defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
// Case Management
import CaseEncounterOverviewComponent from './case-management/encounters/case-encounter-overview.component';
import CaseManagementForm from './case-management/workspace/case-management.workspace';
import EndRelationshipWorkspace from './case-management/workspace/case-management-workspace.component';
import WrapComponent from './case-management/wrap/wrap.component';
import { createDashboardGroup } from './clinical-view-group/createDashboardGroup';
import { configSchema } from './config-schema';
// Dashboard metas from atencion-ambulatoria config (reused here)
import { createLeftPanelLink } from './left-panel-link.component';
// Specialized Clinics
import GenericDashboard from './specialized-clinics/generic-nav-links/generic-dashboard.component';
import GenericNavLinks from './specialized-clinics/generic-nav-links/generic-nav-links.component';
import DefaulterTracing from './specialized-clinics/hiv-care-and-treatment-services/defaulter-tracing/defaulter-tracing.component';
import {
  defaulterTracingDashboardMeta,
  hivCareAndTreatmentNavGroup,
  htsDashboardMeta,
} from './specialized-clinics/hiv-care-and-treatment-services/hiv-care-and-treatment-dashboard.meta';
import HivTestingEncountersList from './specialized-clinics/hiv-care-and-treatment-services/hiv-testing-services/views/hiv-testing/hiv-testing-services.component';

const moduleName = '@sihsalus/esm-seguimiento-casos-app';
const options = {
  featureName: 'case-monitoring-app',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// CASE MANAGEMENT EXPORTS
// ================================================================================
// t('caseMonitoring', 'Case monitoring')
export const caseManagementDashboardLink = getSyncLifecycle(
  createLeftPanelLink({
    name: 'case-monitoring',
    title: 'caseMonitoring',
  }),
  options,
);
// t('caseMonitoringEncounters', 'Case monitoring encounters')
export const caseEncounterDashboardLink = getSyncLifecycle(
  createDashboardLink({
    ...{
      icon: 'omrs-icon-group',
      slot: 'patient-chart-case-encounter-slot',
      columns: 1,
      title: 'caseMonitoringEncounters',
      path: 'seguimiento-casos',
      config: {},
    },
    moduleName,
  }),
  options,
);
export const caseEncounterTable = getSyncLifecycle(CaseEncounterOverviewComponent, options);
export const caseManagementForm = getSyncLifecycle(CaseManagementForm, options);
export const endRelationshipWorkspace = getSyncLifecycle(EndRelationshipWorkspace, options);
export const wrapComponent = getSyncLifecycle(WrapComponent, options);

// ================================================================================
// SPECIALIZED CLINICS / HIV EXPORTS
// ================================================================================
export const genericDashboard = getSyncLifecycle(GenericDashboard, options);
export const genericNavLinks = getSyncLifecycle(GenericNavLinks, options);
export const hivCareAndTreatMentSideNavGroup = getSyncLifecycle(
  createDashboardGroup(hivCareAndTreatmentNavGroup),
  options,
);
export const defaulterTracing = getSyncLifecycle(DefaulterTracing, options);
export const defaulterTracingLink = getSyncLifecycle(
  createDashboardLink({ ...defaulterTracingDashboardMeta, moduleName }),
  options,
);
export const htsClinicalView = getSyncLifecycle(HivTestingEncountersList, options);
export const htsDashboardLink = getSyncLifecycle(createDashboardLink({ ...htsDashboardMeta, moduleName }), options);
