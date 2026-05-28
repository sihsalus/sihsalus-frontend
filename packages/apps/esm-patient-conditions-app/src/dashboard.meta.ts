import { type DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-patient-conditions-app',
  slot: 'patient-chart-conditions-dashboard-slot',
  path: 'Antecedentes',
  title: 'Antecedentes y problemas',
  icon: 'omrs-icon-list-checked',
};

export const proceduresDashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName: '@sihsalus/esm-patient-conditions-app',
  slot: 'patient-chart-procedures-dashboard-slot',
  path: 'Procedimientos-y-cirugias',
  title: 'Procedimientos y cirugías',
  icon: 'omrs-icon-list-checked',
};
