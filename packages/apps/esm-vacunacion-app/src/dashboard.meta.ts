import { type DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-vacunacion-app',
  slot: 'patient-chart-vacunacion-dashboard-slot',
  path: 'Vacunacion',
  title: 'vaccination',
  icon: 'omrs-icon-syringe',
};
