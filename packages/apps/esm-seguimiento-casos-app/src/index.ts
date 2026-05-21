import { defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';

import CaseEncounterOverviewComponent from './case-management/encounters/case-encounter-overview.component';
import MissedFollowUp from './case-management/missed-follow-up/missed-follow-up.component';
import CaseManagementForm from './case-management/workspace/case-management.workspace';
import EndRelationshipWorkspace from './case-management/workspace/case-management-workspace.component';
import WrapComponent from './case-management/wrap/wrap.component';
import { configSchema } from './config-schema';
import { createLeftPanelLink } from './left-panel-link.component';

const moduleName = '@sihsalus/esm-seguimiento-casos-app';
const options = {
  featureName: 'case-monitoring-app',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

export const caseManagementDashboardLink = getSyncLifecycle(
  createLeftPanelLink({
    icon: 'task',
    name: 'case-monitoring',
    title: 'caseMonitoring',
  }),
  options,
);

export const caseEncounterDashboardLink = getSyncLifecycle(
  createDashboardLink({
    icon: 'omrs-icon-group',
    slot: 'patient-chart-case-encounter-slot',
    columns: 1,
    title: 'caseMonitoringEncounters',
    path: 'seguimiento-casos',
    config: {},
    moduleName,
  } as Parameters<typeof createDashboardLink>[0] & { slot: string }),
  options,
);

export const missedFollowUpDashboardLink = getSyncLifecycle(
  createDashboardLink({
    icon: 'omrs-icon-calendar',
    slot: 'patient-chart-missed-follow-up-slot',
    columns: 1,
    title: 'missedFollowUp',
    path: 'perdida-seguimiento',
    config: {},
    moduleName,
  } as Parameters<typeof createDashboardLink>[0] & { slot: string }),
  options,
);

export const caseEncounterTable = getSyncLifecycle(CaseEncounterOverviewComponent, options);
export const missedFollowUpDashboard = getSyncLifecycle(MissedFollowUp, options);
export const caseManagementForm = getSyncLifecycle(CaseManagementForm, options);
export const endRelationshipWorkspace = getSyncLifecycle(EndRelationshipWorkspace, options);
export const wrapComponent = getSyncLifecycle(WrapComponent, options);
