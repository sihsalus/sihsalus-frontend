import { type DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-patient-notes-app',
  slot: 'patient-chart-encounters-dashboard-slot',
  title: 'Encounters',
  path: 'Encounters',
  icon: 'omrs-icon-calendar-heat-map',
};
