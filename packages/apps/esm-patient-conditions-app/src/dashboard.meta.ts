import { type DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-patient-conditions-app',
  slot: 'patient-chart-conditions-dashboard-slot',
  path: 'Antecedentes',
  title: 'Antecedentes',
  icon: 'omrs-icon-list-checked',
};
