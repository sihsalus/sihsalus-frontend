import { type DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-patient-programs-app',
  slot: 'patient-chart-programs-dashboard-slot',
  path: 'Programs',
  title: 'Programs',
  icon: 'omrs-icon-programs',
};
